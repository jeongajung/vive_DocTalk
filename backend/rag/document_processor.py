import uuid
import io
from pypdf import PdfReader
from rag.vectorstore import VectorStore

_vectorstore = VectorStore()

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


class DocumentProcessor:
    def __init__(self):
        self.vectorstore = _vectorstore

    # ── Global upload (legacy) ────────────────────────────

    async def process(self, filename: str, content: bytes) -> str:
        doc_id = str(uuid.uuid4())
        text = self._extract_text(filename, content)
        chunks = self._chunk_text(text, filename, doc_id)
        self.vectorstore.add_chunks(chunks)
        return doc_id

    # ── Project knowledge indexing ────────────────────────

    async def process_project_doc(self, project_id: str, filename: str, content: bytes) -> str:
        doc_id = filename  # 파일명을 stable doc_id로 사용 (재업로드 시 교체)
        text = self._extract_text(filename, content)
        if not text.strip():
            return doc_id
        chunks = self._chunk_text(text, filename, doc_id, project_id=project_id)
        self.vectorstore.add_project_chunks(project_id, chunks)
        return doc_id

    def remove_project_doc(self, project_id: str, filename: str):
        self.vectorstore.delete_project_doc(project_id, filename)

    def list_project_documents(self, project_id: str) -> list[dict]:
        return self.vectorstore.list_project_documents(project_id)

    # ── Skill file indexing ───────────────────────────────

    async def process_skill_ref(self, skill_id: str, rel_path: str, content: bytes) -> str:
        doc_id = f"{skill_id}__{rel_path.replace('/', '__')}"
        filename = rel_path.split("/")[-1]
        text = self._extract_text(filename, content)
        if not text.strip():
            return doc_id
        chunks = self._chunk_text(text, rel_path, doc_id, skill_id=skill_id)
        self.vectorstore.add_skill_chunks(skill_id, chunks)
        return doc_id

    def remove_skill_ref(self, skill_id: str, rel_path: str):
        doc_id = f"{skill_id}__{rel_path.replace('/', '__')}"
        self.vectorstore.delete_skill_doc(skill_id, doc_id)

    # ── Helpers ───────────────────────────────────────────

    def _extract_text(self, filename: str, content: bytes) -> str:
        name = filename.lower()
        if name.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        if name.endswith(".html"):
            import re
            text = content.decode("utf-8", errors="ignore")
            return re.sub(r"<[^>]+>", " ", text)
        if name.endswith(".json"):
            import json
            try:
                return json.dumps(json.loads(content), ensure_ascii=False, indent=2)
            except Exception:
                pass
        return content.decode("utf-8", errors="ignore")

    def _chunk_text(
        self,
        text: str,
        filename: str,
        doc_id: str,
        skill_id: str | None = None,
        project_id: str | None = None,
    ) -> list[dict]:
        words = text.split()
        chunks = []
        step = CHUNK_SIZE - CHUNK_OVERLAP
        for i, start in enumerate(range(0, len(words), step)):
            chunk_text = " ".join(words[start: start + CHUNK_SIZE])
            if not chunk_text.strip():
                continue
            metadata = {"filename": filename, "doc_id": doc_id, "chunk_index": i}
            if skill_id:
                metadata["skill_id"] = skill_id
            if project_id:
                metadata["project_id"] = project_id
            chunks.append({"id": f"{doc_id}_{i}", "text": chunk_text, "metadata": metadata})
        return chunks

    def list_documents(self) -> list[dict]:
        return self.vectorstore.list_documents()
