import os
import json
import asyncio
import threading
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from dotenv import load_dotenv

load_dotenv()

# ── API key pool (round-robin) ─────────────────────────────

_KEYS = list(dict.fromkeys(filter(None, [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
]))) or [""]  # 4개 키 중복 제거 후 풀 공유
_key_idx = 0
_key_lock = threading.Lock()

def _next_key() -> str:
    global _key_idx
    with _key_lock:
        key = _KEYS[_key_idx % len(_KEYS)]
        _key_idx += 1
        return key

MODEL = "gemini-3-flash-preview"

# ── Intent classification ──────────────────────────────────

_IDEA_KEYWORDS = [
    "추가", "개선", "어떨까", "어떻게", "방법", "도입", "변경",
    "리팩", "제안", "방안", "좋을까", "하면", "구현", "적용",
]

_INTENT_PROMPT = """사용자 질문이 아이디어/기능 개선/방법 논의인지, 단순 정보 질문인지 판단하세요.

질문: {question}

반드시 JSON 하나만 반환하세요:
{{"intent": "discussion"}} — 아이디어, 개선, 방법, 기능 추가 등 논의가 필요한 질문
{{"intent": "query"}} — 사실 확인, 문서 검색, 단순 질문"""

# ── Agent definitions ──────────────────────────────────────

AGENTS = [
    {
        "name": "분석가",
        "color": "#dc2626",
        "temp": 0.3,
        "system": (
            "당신은 분석가입니다. 문서 근거를 바탕으로 현실적 타당성을 판단합니다.\n"
            "- 문서나 기존 계획 기반으로 발언하세요\n"
            "- 실현 가능성 중심으로 평가하세요\n"
            "- 2-3문장으로 간결하게 말하세요\n"
            "- 다른 에이전트 발언에 동의/반론을 명확히 하세요\n"
            "- 절대 환각(hallucination) 하지 마세요"
        ),
    },
    {
        "name": "비평가",
        "color": "#d97706",
        "temp": 0.4,
        "system": (
            "당신은 비평가입니다. 리스크와 약점을 지적하고 구현 난이도를 체크합니다.\n"
            "- 잠재적 문제점과 엣지 케이스를 찾으세요\n"
            "- 구현 복잡도와 사이드 이펙트를 언급하세요\n"
            "- 2-3문장으로 간결하게 말하세요\n"
            "- 근거 없는 비판은 하지 마세요"
        ),
    },
    {
        "name": "제안자",
        "color": "#16a34a",
        "temp": 0.5,
        "system": (
            "당신은 제안자입니다. 구체적이고 실행 가능한 방향을 제시합니다.\n"
            "- 비현실적이거나 지나치게 창의적인 제안은 피하세요\n"
            "- 분석가·비평가 의견을 반영한 절충안을 찾으세요\n"
            "- 2-3문장으로 간결하게 말하세요\n"
            "- '~하는 건 어떨까요?' 식으로 제안하세요"
        ),
    },
]

# ── Prompts ────────────────────────────────────────────────

_AGENT_PROMPT = """{context_block}{discussion_block}

사용자 질문: {question}
{agent_name}로서 발언하세요 (2-3문장):"""

_CONTINUE_PROMPT = """다음은 AI 에이전트들의 토론입니다.

{discussion}

토론이 충분히 이루어졌고 실행 가능한 방향이 도출됐나요?
반드시 JSON 하나만 반환하세요:
{{"continue": false}} — 종합 단계로 넘어가도 됨
{{"continue": true}} — 추가 라운드 필요"""

_SUMMARY_PROMPT = """다음은 AI 에이전트 토론 내용입니다.

{discussion}

사용자 질문: {question}

위 토론을 종합해서 아래 형식으로 요약하세요:

**합의된 방향**
(1-2문장)

**실행 제안**
- 제안 1
- 제안 2
- 제안 3

**주의할 점**
(1문장)"""


# ── Core helpers ───────────────────────────────────────────

def _sync_generate(api_key: str, system: str | None, prompt: str, temp: float) -> str:
    with _key_lock:
        genai.configure(api_key=api_key)
        kwargs = {"system_instruction": system} if system else {}
        model = genai.GenerativeModel(model_name=MODEL, **kwargs)
        cfg = GenerationConfig(temperature=temp)
        return model.generate_content(prompt, generation_config=cfg).text.strip()


async def _generate(system: str | None, prompt: str, temp: float) -> str:
    key = _next_key()
    return await asyncio.to_thread(_sync_generate, key, system, prompt, temp)


# ── Orchestrator ───────────────────────────────────────────

class MultiAgentOrchestrator:

    def classify_intent(self, question: str) -> str:
        if not any(kw in question for kw in _IDEA_KEYWORDS):
            return "query"
        try:
            key = _next_key()
            result = asyncio.get_event_loop().run_until_complete(
                _generate(None, _INTENT_PROMPT.format(question=question), 0.0)
            )
        except RuntimeError:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                key = _next_key()
                future = pool.submit(_sync_generate, key, None, _INTENT_PROMPT.format(question=question), 0.0)
                result = future.result()
        try:
            text = result.replace("```json", "").replace("```", "").strip()
            return json.loads(text).get("intent", "query")
        except Exception:
            return "query"

    async def classify_intent_async(self, question: str) -> str:
        if not any(kw in question for kw in _IDEA_KEYWORDS):
            return "query"
        try:
            result = await _generate(None, _INTENT_PROMPT.format(question=question), 0.0)
            text = result.replace("```json", "").replace("```", "").strip()
            return json.loads(text).get("intent", "query")
        except Exception:
            return "query"

    async def _call_agent(self, agent: dict, question: str, discussion_log: list[str], rag_context: str) -> str:
        context_block = f"[참고 문서]\n{rag_context}\n" if rag_context.strip() else ""
        discussion_block = ""
        if discussion_log:
            discussion_block = "\n[이전 발언]\n" + "\n".join(discussion_log)

        prompt = _AGENT_PROMPT.format(
            context_block=context_block,
            discussion_block=discussion_block,
            question=question,
            agent_name=agent["name"],
        )
        return await _generate(agent["system"], prompt, agent["temp"])

    async def _should_continue(self, discussion_log: list[str]) -> bool:
        discussion_text = "\n".join(discussion_log)
        try:
            result = await _generate(None, _CONTINUE_PROMPT.format(discussion=discussion_text), 0.0)
            text = result.replace("```json", "").replace("```", "").strip()
            return json.loads(text).get("continue", False)
        except Exception:
            return False

    async def _summarize(self, question: str, discussion_log: list[str]) -> str:
        discussion_text = "\n".join(discussion_log)
        return await _generate(None, _SUMMARY_PROMPT.format(discussion=discussion_text, question=question), 0.3)

    async def stream_discussion(
        self,
        question: str,
        rag_context: str,
    ):
        """AsyncGenerator yielding SSE-formatted strings."""
        discussion_log: list[str] = []
        MAX_ROUNDS = 3

        for round_num in range(1, MAX_ROUNDS + 1):
            yield _sse("round_start", {"round": round_num})

            for agent in AGENTS:
                text = await self._call_agent(agent, question, discussion_log, rag_context)
                discussion_log.append(f"{agent['name']}: {text}")
                yield _sse("agent_message", {
                    "round": round_num,
                    "agent": agent["name"],
                    "color": agent["color"],
                    "text": text,
                })

            yield _sse("round_complete", {"round": round_num})

            # 조기 종료 체크 (마지막 라운드 전까지)
            if round_num < MAX_ROUNDS:
                should_continue = await self._should_continue(discussion_log)
                if not should_continue:
                    break

        summary = await self._summarize(question, discussion_log)
        yield _sse("summary", {"text": summary})
        yield _sse("done", {})


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# 싱글턴
orchestrator = MultiAgentOrchestrator()
