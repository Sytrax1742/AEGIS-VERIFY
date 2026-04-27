from __future__ import annotations

import asyncio
import json
from typing import Any, Sequence, TypedDict, cast

import vertexai
from langgraph.graph import END, START, StateGraph
from vertexai.generative_models import GenerationConfig, GenerativeModel
from vertexai.language_models import TextEmbeddingModel

from core.config import settings
from services.firestore_db import FirestoreSieveStore
from services.vertex_llm import VertexLLMService


class DynamicSieve(TypedDict):
    sieve_name: str
    objective: str
    required_tool: str


class AutopsyState(TypedDict):
    file_bytes: bytes
    mime_type: str
    user_prompt: str
    prompt_embedding: list[float]
    active_sieves: list[DynamicSieve]
    findings: dict[str, Any]
    autopsy_report_ready: bool


_EMBEDDING_MODEL_NAME = "text-embedding-004"
_SIEVE_FORGE_MODEL_NAME = "gemini-1.5-pro-preview-0409"
_ALLOWED_TOOLS = {"vision", "osint_grounding", "metadata"}

vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
_embedding_model = TextEmbeddingModel.from_pretrained(_EMBEDDING_MODEL_NAME)
_sieve_forge_model = GenerativeModel(_SIEVE_FORGE_MODEL_NAME)
_firestore_store = FirestoreSieveStore()
_vertex_llm_service = VertexLLMService()


def _normalize_dynamic_sieve(raw: dict[str, Any]) -> DynamicSieve:
    sieve_name = str(raw.get("sieve_name", "")).strip()
    objective = str(raw.get("objective", "")).strip()
    required_tool = str(raw.get("required_tool", "")).strip()

    if not sieve_name or not objective:
        raise ValueError("Dynamic sieve must include non-empty sieve_name and objective")
    if required_tool not in _ALLOWED_TOOLS:
        raise ValueError("required_tool must be one of: vision, osint_grounding, metadata")

    return DynamicSieve(
        sieve_name=sieve_name,
        objective=objective,
        required_tool=required_tool,
    )


async def _embed_user_prompt(user_prompt: str) -> list[float]:
    def _embed() -> list[float]:
        embeddings = _embedding_model.get_embeddings([user_prompt])
        if not embeddings:
            raise ValueError("Vertex embedding API returned no vectors")

        first_embedding = embeddings[0]
        values = getattr(first_embedding, "values", None)
        if values is None:
            raise ValueError("Vertex embedding response does not include values")

        return [float(value) for value in values]

    return await asyncio.to_thread(_embed)


def _coerce_cached_sieves(cached_payload: dict[str, Any] | None) -> list[DynamicSieve]:
    if not cached_payload:
        return []

    generated = cached_payload.get("generated_sieve")
    if isinstance(generated, dict):
        return [_normalize_dynamic_sieve(cast(dict[str, Any], generated))]
    if isinstance(generated, list):
        return [
            _normalize_dynamic_sieve(cast(dict[str, Any], item))
            for item in generated
            if isinstance(item, dict)
        ]
    return []


async def memory_router_node(state: AutopsyState) -> dict[str, Any]:
    """Computes prompt embedding, checks Firestore cache, and routes to forge on miss."""
    prompt_embedding = await _embed_user_prompt(state["user_prompt"])
    cache_result = await _firestore_store.search_ephemeral_sieves(prompt_embedding)

    if cache_result.get("cache_hit"):
        cached_sieves = _coerce_cached_sieves(
            cast(dict[str, Any] | None, cache_result.get("sieve"))
        )
        return {
            "prompt_embedding": prompt_embedding,
            "active_sieves": cached_sieves,
            "findings": {
                **state.get("findings", {}),
                "cache_hit": True,
                "cache_distance": cache_result.get("distance"),
            },
        }

    return {
        "prompt_embedding": prompt_embedding,
        "findings": {
            **state.get("findings", {}),
            "cache_hit": False,
        },
    }


async def executor_node(state: AutopsyState) -> dict[str, Any]:
    """Executes grounded forensic sieves and merges results into findings."""
    file_bytes = state["file_bytes"]
    mime_type = state["mime_type"]
    user_prompt = state["user_prompt"]
    active_sieves = state.get("active_sieves", [])

    existing_findings = dict(state.get("findings", {}))

    raw_response = await _vertex_llm_service.execute_forensic_sieves(
        file_bytes=file_bytes,
        mime_type=mime_type,
        user_prompt=user_prompt,
        active_sieves=active_sieves,
    )

    parsed_response: dict[str, Any]
    if isinstance(raw_response, str):
        try:
            loaded = json.loads(raw_response)
        except json.JSONDecodeError:
            return {
                "autopsy_report_ready": True,
                "findings": {
                    **existing_findings,
                    "executor_status": "failed",
                    "executor_error": "Failed to decode execute_forensic_sieves JSON response",
                },
            }

        if isinstance(loaded, dict):
            parsed_response = loaded
        else:
            parsed_response = {
                "executor_status": "failed",
                "executor_error": "execute_forensic_sieves returned non-object JSON",
            }
    else:
        parsed_response = cast(dict[str, Any], raw_response)

    return {
        "autopsy_report_ready": True,
        "findings": {
            **existing_findings,
            **parsed_response,
            "executor_status": "completed",
        },
    }


async def sieve_forge_node(state: AutopsyState) -> dict[str, Any]:
    """Generates 2-3 dynamic sieves with Vertex AI and persists them to Firestore."""
    prompt_embedding = state.get("prompt_embedding") or await _embed_user_prompt(
        state["user_prompt"]
    )

    forge_instruction = (
        "You are generating DynamicSieve definitions for a digital forensics workflow. "
        "Return ONLY JSON as an array with 2 or 3 objects. Each object must include: "
        "sieve_name (string), objective (string), required_tool (one of: vision, "
        "osint_grounding, metadata). No markdown. No extra keys.\n\n"
        f"User Prompt: {state['user_prompt']}"
    )

    response = await asyncio.to_thread(
        _sieve_forge_model.generate_content,
        forge_instruction,
        generation_config=GenerationConfig(
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )

    payload = json.loads((response.text or "").strip())
    if not isinstance(payload, list):
        raise ValueError("Sieve forge response must be a JSON array")
    if len(payload) < 2 or len(payload) > 3:
        raise ValueError("Sieve forge must return 2 to 3 sieves")

    sieves: list[DynamicSieve] = []
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Each forged sieve must be a JSON object")
        sieves.append(_normalize_dynamic_sieve(cast(dict[str, Any], item)))

    for sieve in sieves:
        await _firestore_store.save_generated_sieve(
            user_prompt=state["user_prompt"],
            prompt_embedding=prompt_embedding,
            generated_sieve=sieve,
        )

    return {
        "prompt_embedding": prompt_embedding,
        "active_sieves": sieves,
        "findings": {
            **state.get("findings", {}),
            "forged_sieves_count": len(sieves),
        },
    }


def _route_after_memory_router(state: AutopsyState) -> str:
    return "executor_node" if bool(state.get("findings", {}).get("cache_hit")) else "sieve_forge_node"


graph_builder = StateGraph(AutopsyState)
graph_builder.add_node("memory_router_node", memory_router_node)
graph_builder.add_node("sieve_forge_node", sieve_forge_node)
graph_builder.add_node("executor_node", executor_node)
graph_builder.add_edge(START, "memory_router_node")
graph_builder.add_conditional_edges(
    "memory_router_node",
    _route_after_memory_router,
    {
        "executor_node": "executor_node",
        "sieve_forge_node": "sieve_forge_node",
    },
)
graph_builder.add_edge("sieve_forge_node", "executor_node")
graph_builder.add_edge("executor_node", END)

compiled_autopsy_graph = graph_builder.compile()
