from __future__ import annotations

import asyncio
import json
from typing import Any, Mapping, Sequence, TypedDict

import vertexai
from vertexai.generative_models import GenerationConfig, GenerativeModel, Part, Tool

from core.config import settings

try:
    from vertexai.generative_models import grounding
except ImportError:  # pragma: no cover - SDK compatibility guard
    grounding = None

try:
    from vertexai.generative_models import GoogleSearchRetrieval
except ImportError:  # pragma: no cover - SDK compatibility guard
    GoogleSearchRetrieval = None


class VertexLLMResponse(TypedDict):
    critical_red_flags: list[str]
    missing_metadata: list[str]
    contextual_verdict: str


class DynamicSieve(TypedDict):
    sieve_name: str
    objective: str
    required_tool: str


class VertexLLMService:
    """Wrapper around Vertex Gemini for grounded sieve-guided analysis."""

    MODEL_NAME = "gemini-1.5-pro-preview-0409"

    def __init__(self) -> None:
        vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        self._model = GenerativeModel(self.MODEL_NAME)
        self._grounding_tools = self._build_grounding_tools()

    def _build_grounding_tools(self) -> list[Tool]:
        if grounding is not None and hasattr(grounding, "GoogleSearchRetrieval"):
            return [Tool(google_search_retrieval=grounding.GoogleSearchRetrieval())]

        if hasattr(Tool, "from_google_search_retrieval"):
            return [Tool.from_google_search_retrieval()]

        if GoogleSearchRetrieval is not None:
            return [Tool(google_search_retrieval=GoogleSearchRetrieval())]

        raise RuntimeError(
            "Google Search Grounding is unavailable in the installed Vertex AI SDK"
        )

    async def generate_grounded_forensic_json(
        self,
        user_prompt: str,
        image_bytes: bytes,
        active_sieves: Sequence[Mapping[str, Any]],
    ) -> VertexLLMResponse:
        """Generates strict forensic JSON from prompt, image evidence, and active sieves."""
        sieve_context = json.dumps(list(active_sieves), ensure_ascii=True)

        instruction = (
            "You are Aegis-Verify, a digital forensics engine. Analyze the provided image "
            "using the user prompt and active sieves. Return ONLY strict JSON with exactly "
            "these keys: critical_red_flags (string array), missing_metadata (string array), "
            "contextual_verdict (string). No extra keys, no markdown, no prose outside JSON.\n\n"
            f"User Prompt: {user_prompt}\n"
            f"Active Sieves: {sieve_context}"
        )

        parts = [
            Part.from_data(data=image_bytes, mime_type="image/jpeg"),
            instruction,
        ]

        generation_config = GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json",
        )

        response = await asyncio.to_thread(
            self._model.generate_content,
            parts,
            generation_config=generation_config,
            tools=self._grounding_tools,
        )

        response_text = (response.text or "").strip()
        parsed = json.loads(response_text)

        if not isinstance(parsed, dict):
            raise ValueError("Vertex response must be a JSON object")

        expected_keys = {
            "critical_red_flags",
            "missing_metadata",
            "contextual_verdict",
        }
        if set(parsed.keys()) != expected_keys:
            raise ValueError("Vertex response JSON must contain only required keys")

        red_flags = parsed.get("critical_red_flags")
        missing_metadata = parsed.get("missing_metadata")
        contextual_verdict = parsed.get("contextual_verdict")

        if not isinstance(red_flags, list) or not all(
            isinstance(item, str) for item in red_flags
        ):
            raise ValueError("critical_red_flags must be a list of strings")
        if not isinstance(missing_metadata, list) or not all(
            isinstance(item, str) for item in missing_metadata
        ):
            raise ValueError("missing_metadata must be a list of strings")
        if not isinstance(contextual_verdict, str):
            raise ValueError("contextual_verdict must be a string")

        return VertexLLMResponse(
            critical_red_flags=red_flags,
            missing_metadata=missing_metadata,
            contextual_verdict=contextual_verdict,
        )

    async def execute_forensic_sieves(
        self,
        file_bytes: bytes,
        mime_type: str,
        user_prompt: str,
        active_sieves: list[DynamicSieve],
    ) -> VertexLLMResponse:
        """Executes grounded forensic analysis for uploaded evidence using active sieves."""
        system_prompt = (
            "You are Aegis-Verify, an enterprise digital forensics executor. "
            "Analyze the uploaded evidence using the provided user context and active sieves. "
            "Apply each sieve objective rigorously and use grounded web retrieval evidence when needed "
            "to validate authenticity, manipulation indicators, and contextual consistency. "
            "Return ONLY strict JSON with exactly these keys: critical_red_flags (array of strings), "
            "missing_metadata (array of strings), contextual_verdict (string). "
            "Do not include markdown, explanations, confidence scores, or any extra keys."
        )

        sieve_context = json.dumps(active_sieves, ensure_ascii=True)
        user_instruction = (
            f"User Prompt: {user_prompt}\n"
            f"Active Sieves: {sieve_context}\n"
            "Execute the forensic sieves against the provided file evidence."
        )

        grounded_model = GenerativeModel(
            self.MODEL_NAME,
            system_instruction=system_prompt,
        )

        response = await asyncio.to_thread(
            grounded_model.generate_content,
            [
                Part.from_data(data=file_bytes, mime_type=mime_type),
                user_instruction,
            ],
            generation_config=GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
            tools=self._grounding_tools,
        )

        response_text = (response.text or "").strip()
        parsed = json.loads(response_text)

        if not isinstance(parsed, dict):
            raise ValueError("Vertex response must be a JSON object")

        expected_keys = {
            "critical_red_flags",
            "missing_metadata",
            "contextual_verdict",
        }
        if set(parsed.keys()) != expected_keys:
            raise ValueError("Vertex response JSON must contain only required keys")

        red_flags = parsed.get("critical_red_flags")
        missing_metadata = parsed.get("missing_metadata")
        contextual_verdict = parsed.get("contextual_verdict")

        if not isinstance(red_flags, list) or not all(
            isinstance(item, str) for item in red_flags
        ):
            raise ValueError("critical_red_flags must be a list of strings")
        if not isinstance(missing_metadata, list) or not all(
            isinstance(item, str) for item in missing_metadata
        ):
            raise ValueError("missing_metadata must be a list of strings")
        if not isinstance(contextual_verdict, str):
            raise ValueError("contextual_verdict must be a string")

        return VertexLLMResponse(
            critical_red_flags=red_flags,
            missing_metadata=missing_metadata,
            contextual_verdict=contextual_verdict,
        )
