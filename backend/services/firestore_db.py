from __future__ import annotations

from typing import Any, Mapping, Sequence

from google.cloud import firestore
from google.cloud.firestore_v1 import AsyncClient
from google.cloud.firestore_v1.async_vector_query import AsyncVectorQuery
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector

from core.config import settings


class FirestoreSieveStore:
    """Handles cache lookup and persistence for adaptive sieves in Firestore."""

    COLLECTION_NAME = "ephemeral_sieves"
    VECTOR_FIELD = "prompt_embedding"
    DISTANCE_RESULT_FIELD = "distance"
    CACHE_HIT_DISTANCE_THRESHOLD = 0.15

    def __init__(self, client: AsyncClient | None = None) -> None:
        self._client = client or AsyncClient(project=settings.GCP_PROJECT_ID)
        self._collection = self._client.collection(self.COLLECTION_NAME)

    async def search_ephemeral_sieves(
        self,
        prompt_embedding: Sequence[float],
    ) -> dict[str, Any]:
        """Searches for nearest sieve and returns cache hit when distance < 0.15."""
        query: AsyncVectorQuery = self._collection.find_nearest(
            vector_field=self.VECTOR_FIELD,
            query_vector=Vector(prompt_embedding),
            limit=1,
            distance_measure=DistanceMeasure.COSINE,
            distance_result_field=self.DISTANCE_RESULT_FIELD,
        )

        async for snapshot in query.stream():
            payload = snapshot.to_dict() or {}
            distance = float(payload.get(self.DISTANCE_RESULT_FIELD, 1.0))

            if distance < self.CACHE_HIT_DISTANCE_THRESHOLD:
                payload.pop(self.DISTANCE_RESULT_FIELD, None)
                return {
                    "cache_hit": True,
                    "distance": distance,
                    "sieve_id": snapshot.id,
                    "sieve": payload,
                }

            return {
                "cache_hit": False,
                "distance": distance,
                "sieve_id": snapshot.id,
                "sieve": None,
            }

        return {
            "cache_hit": False,
            "distance": None,
            "sieve_id": None,
            "sieve": None,
        }

    async def save_generated_sieve(
        self,
        user_prompt: str,
        prompt_embedding: Sequence[float],
        generated_sieve: Mapping[str, Any],
    ) -> str:
        """Saves a newly generated sieve document in Firestore."""
        document_ref = self._collection.document()

        await document_ref.set(
            {
                "user_prompt": user_prompt,
                self.VECTOR_FIELD: Vector(prompt_embedding),
                "generated_sieve": dict(generated_sieve),
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )

        return document_ref.id
