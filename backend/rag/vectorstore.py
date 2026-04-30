import os
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "./data/chroma_db")


class VectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.ef = DefaultEmbeddingFunction()
        # 글로벌 컬렉션 (레거시 / 프로젝트 미지정 문서)
        self.collection = self.client.get_or_create_collection(
            name="doctalk_docs",
            embedding_function=self.ef,
        )

    # ── Internal helpers ──────────────────────────────────

    def _get_or_create(self, name: str):
        return self.client.get_or_create_collection(name=name, embedding_function=self.ef)

    def _try_get(self, name: str):
        try:
            return self.client.get_collection(name=name, embedding_function=self.ef)
        except Exception:
            return None

    # ── Global docs (legacy) ──────────────────────────────

    def add_chunks(self, chunks: list[dict]):
        self.collection.add(
            ids=[c["id"] for c in chunks],
            documents=[c["text"] for c in chunks],
            metadatas=[c["metadata"] for c in chunks],
        )

    def list_documents(self) -> list[dict]:
        all_meta = self.collection.get(include=["metadatas"])["metadatas"]
        seen: dict[str, dict] = {}
        for m in all_meta:
            if m["doc_id"] not in seen:
                seen[m["doc_id"]] = {"doc_id": m["doc_id"], "filename": m["filename"]}
        return list(seen.values())

    # ── Project docs ──────────────────────────────────────

    def add_project_chunks(self, project_id: str, chunks: list[dict]):
        coll = self._get_or_create(f"project_{project_id}_docs")
        coll.add(
            ids=[c["id"] for c in chunks],
            documents=[c["text"] for c in chunks],
            metadatas=[c["metadata"] for c in chunks],
        )

    def delete_project_doc(self, project_id: str, doc_id: str):
        coll = self._try_get(f"project_{project_id}_docs")
        if not coll:
            return
        results = coll.get(where={"doc_id": doc_id})
        if results["ids"]:
            coll.delete(ids=results["ids"])

    def list_project_documents(self, project_id: str) -> list[dict]:
        coll = self._try_get(f"project_{project_id}_docs")
        if not coll or coll.count() == 0:
            return []
        all_meta = coll.get(include=["metadatas"])["metadatas"]
        seen: dict[str, dict] = {}
        for m in all_meta:
            if m["doc_id"] not in seen:
                seen[m["doc_id"]] = {"doc_id": m["doc_id"], "filename": m["filename"]}
        return list(seen.values())

    # ── Skill reference docs ──────────────────────────────

    def add_skill_chunks(self, skill_id: str, chunks: list[dict]):
        coll = self._get_or_create(f"skill_{skill_id}_refs")
        coll.add(
            ids=[c["id"] for c in chunks],
            documents=[c["text"] for c in chunks],
            metadatas=[c["metadata"] for c in chunks],
        )

    def delete_skill_doc(self, skill_id: str, doc_id: str):
        coll = self._try_get(f"skill_{skill_id}_refs")
        if not coll:
            return
        results = coll.get(where={"doc_id": doc_id})
        if results["ids"]:
            coll.delete(ids=results["ids"])

    # ── Unified search ────────────────────────────────────

    def search(
        self,
        query: str,
        n_results: int = 5,
        skill_id: str | None = None,
        project_id: str | None = None,
    ) -> list[dict]:
        results = []

        def _query(coll, label: str, limit: int):
            count = coll.count()
            if count == 0:
                return
            r = coll.query(query_texts=[query], n_results=min(limit, count))
            for doc, meta, dist in zip(r["documents"][0], r["metadatas"][0], r["distances"][0]):
                results.append({
                    "text": doc,
                    "metadata": {**meta, "source_type": label},
                    "score": round(1 - dist, 3),
                })

        # 1. 스킬 참조 문서 (최우선)
        if skill_id:
            coll = self._try_get(f"skill_{skill_id}_refs")
            if coll:
                _query(coll, "skill_ref", n_results)

        # 2. 프로젝트 knowledge (우선)
        if project_id:
            coll = self._try_get(f"project_{project_id}_docs")
            if coll:
                remaining = max(n_results - len(results), 2)
                _query(coll, "project_doc", remaining)

        # 3. 글로벌 docs — 프로젝트 미지정일 때만 (프로젝트 격리)
        if not project_id:
            remaining = max(n_results - len(results), 2)
            if self.collection.count() > 0:
                _query(self.collection, "global", remaining)

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:n_results]
