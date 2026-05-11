import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from rag.vectorstore import VectorStore
from agent.prompts import RAG_USER_TEMPLATE, NO_CONTEXT_TEMPLATE
import skills_manager
import projects_manager
import conversation_store

load_dotenv()

_vectorstore = VectorStore()
MODEL = "gemini-3-flash-preview"

from agent.multi_agent import _next_key as _get_next_key

ROUTER_PROMPT = """당신은 사용자의 질문을 분석하여 스킬이 필요한지 판단합니다.

사용 가능한 스킬 목록:
{skill_list}

사용자 질문: {question}

판단 기준:
- 업로드된 문서 검색/참조가 필요한 질문 → 적합한 스킬 선택
- 특정 작업(PPT 제작, 문서 작성 등) 요청 → 적합한 스킬 선택
- 일반적인 질문/대화 (지식, 개념, 잡담 등) → null 반환

JSON으로만 반환하세요.
스킬 필요: {{"skill_id": "doc_search"}}
스킬 불필요: {{"skill_id": null}}"""

HISTORY_PREFIX = """[이전 대화 이력]
{history}

[현재 질문]
"""


class DocTalkAgent:
    def __init__(self):
        self.vectorstore = _vectorstore

    def _route_skill(self, question: str, skills: list[dict]) -> dict | None:
        if not skills:
            return None

        skill_list = "\n".join(
            f'- id: {s["id"]}, name: {s["name"]}, description: {s["description"]}'
            for s in skills
        )
        genai.configure(api_key=_get_next_key())
        router = genai.GenerativeModel(model_name=MODEL)
        response = router.generate_content(
            ROUTER_PROMPT.format(skill_list=skill_list, question=question)
        )
        try:
            text = response.text.strip().replace("```json", "").replace("```", "").strip()
            skill_id = json.loads(text).get("skill_id")
            if not skill_id:
                return None
            return next((s for s in skills if s["id"] == skill_id), None)
        except Exception:
            return None

    def _build_history_context(self, session_id: str, project_id: str | None, limit: int = 5) -> str:
        conv = conversation_store.get_conversation(session_id, project_id)
        if not conv or not conv.get("messages"):
            return ""
        recent = conv["messages"][-limit:]
        lines = []
        for m in recent:
            lines.append(f"Q: {m['question']}")
            answer_preview = m["answer"][:500] + ("..." if len(m["answer"]) > 500 else "")
            lines.append(f"A: {answer_preview}")
        return "\n".join(lines)

    async def answer(
        self,
        question: str,
        session_id: str,
        project_id: str | None = None,
    ) -> dict:
        all_skills = skills_manager.list_skills()
        if project_id:
            enabled = projects_manager.get_enabled_skills(project_id)
            skills = [s for s in all_skills if s["id"] in enabled]
        else:
            skills = all_skills
        selected_skill = self._route_skill(question, skills)

        # 스킬 없으면 일반 LLM 답변
        if selected_skill is None:
            system_prompt = "당신은 친절한 AI 어시스턴트입니다. 한국어로 답변하세요."
            if project_id:
                project = projects_manager.get_project(project_id)
                if project and project.get("instructions"):
                    system_prompt = f"{project['instructions']}\n\n{system_prompt}"

            history = self._build_history_context(session_id, project_id)
            full_question = (
                HISTORY_PREFIX.format(history=history) + question if history else question
            )
            genai.configure(api_key=_get_next_key())
            model = genai.GenerativeModel(model_name=MODEL, system_instruction=system_prompt)
            response = model.generate_content(full_question)
            answer_text = response.text
            conversation_store.add_message(session_id, question, answer_text, None, project_id)
            return self._build_a2ui_response(answer_text, [], None)

        # 스킬 있으면 RAG 처리
        system_prompt = selected_skill["system_prompt"]
        if project_id:
            project = projects_manager.get_project(project_id)
            if project and project.get("instructions"):
                system_prompt = f"{project['instructions']}\n\n{system_prompt}"
            pinned = projects_manager.get_pinned_contents(project_id)
            if pinned:
                pinned_block = "\n\n---\n\n".join(f"[{fname}]\n{content}" for fname, content in pinned)
                system_prompt += f"\n\n---\n\n[항상 참조할 컨텍스트 파일]\n{pinned_block}"

        chunks = self.vectorstore.search(
            question, n_results=5,
            skill_id=selected_skill.get("id"),
            project_id=project_id,
        )

        history = self._build_history_context(session_id, project_id)
        full_question = (
            HISTORY_PREFIX.format(history=history) + question if history else question
        )

        genai.configure(api_key=_get_next_key())
        model = genai.GenerativeModel(model_name=MODEL, system_instruction=system_prompt)

        if not chunks:
            response = model.generate_content(
                NO_CONTEXT_TEMPLATE.format(question=full_question)
            )
        else:
            context = "\n\n---\n\n".join(
                f"[출처: {c['metadata']['filename']}]\n{c['text']}" for c in chunks
            )
            response = model.generate_content(
                RAG_USER_TEMPLATE.format(context=context, question=full_question)
            )
        answer_text = response.text

        conversation_store.add_message(session_id, question, answer_text, selected_skill["name"], project_id)

        sources = [
            {"filename": c["metadata"]["filename"], "score": c["score"], "chunk_index": c["metadata"]["chunk_index"]}
            for c in chunks
        ] if chunks else []
        return self._build_a2ui_response(answer_text, sources, selected_skill)

    def _build_a2ui_response(self, answer: str, sources: list[dict], skill: dict | None) -> dict:
        source_chips = [
            {"id": f"source_{i}", "component": {"Chip": {"label": f"{s['filename']} (관련도 {s['score']})"}}}
            for i, s in enumerate(sources)
        ]
        components = []
        if skill:
            components.append({"id": "skill_badge", "component": {"Chip": {"label": f"스킬: {skill['name']}"}}})
        components.append({"id": "answer_card", "component": {"Card": {"children": [
            {"id": "answer_text", "component": {"Text": {"text": answer}}}
        ]}}})
        if source_chips:
            components.append({
                "id": "sources_section",
                "component": {"Card": {"children": [
                    {"id": "sources_label", "component": {"Text": {"text": "출처 문서", "variant": "subtitle"}}},
                    *source_chips,
                ]}},
            })
        return {"surfaceUpdate": {"surfaceId": "answer", "components": components}}
