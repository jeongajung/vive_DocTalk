# DocTalk — 개발 TODO

> AI 코딩 세션 시작 시 이 파일을 먼저 읽어 현재 상태를 파악할 것.
> 완료된 항목은 archive 섹션으로 이동. 메인에 남기지 말 것 (토큰 낭비).

---

## 현재 상태 (v4.2)

**스택:** FastAPI + ChromaDB + Gemini(`gemini-3-flash-preview`) / React 18 + Vite + TypeScript  
**실행:** `backend/` → `uv run uvicorn main:app --reload --port 8000` / `frontend/` → `npm run dev`  
**모델명 절대 변경 금지** — gemini-3-flash-preview 고정

---

## 진행 예정

- [ ] 컨플루언스 문서 업데이트 (v4.2 변경사항 반영)

---

## 완료 (아카이브)

### v4.2 — 2026-05-11
- [x] Agentic 스킬 라우팅 — LLM이 스킬 필요 여부 직접 판단 (일반 질문은 스킬 없이 LLM으로 답변)
- [x] 프로젝트별 스킬 ON/OFF — ProjectDetail 스킬 탭에서 토글 제어, 기본값 전체 OFF
- [x] SKILLS.json으로 프로젝트별 활성 스킬 관리
- [x] GET/PATCH /projects/{id}/skills/{skill_id} API 추가
- [x] 글로벌 채팅에서 프로젝트 파일 노출 버그 수정 (레거시 글로벌 컬렉션 정리)

### v4.1 — 2026-04-28
- [x] Knowledge 파일 핀 기능 — 핀된 파일은 RAG 없이 매 대화 system prompt에 직접 주입
- [x] PATCH /knowledge/{filename} — archived/pinned 통합 처리

### v4.0 — 2026-04-28
- [x] 단일 에이전트로 단순화 (멀티 에이전트 토론 제거)
- [x] RAG 결과 없을 때 LLM 자체 지식으로 답변 (NO_CONTEXT_TEMPLATE)
- [x] 4개 Gemini API 키 통합 round-robin 풀
- [x] 스킬 1개일 때 라우팅 API 호출 생략
- [x] `/api/ask` 에러 핸들링 — 429/500 → 사용자 친화적 메시지 반환
- [x] 오류 응답도 conversation_store에 저장
- [x] 오류 시 스킬 뱃지 비노출 (skillName === "오류")
- [x] Knowledge 파일 아카이브 기능 (knowledge/_archive/ 폴더로 이동, RAG 제외)

### v3.0 — 2026-04-27
- [x] 멀티 에이전트 토론 시스템 구현 후 v4.0에서 제거
- [x] SSE 스트리밍 구현 후 v4.0에서 제거
- [x] API 키 풀 구조 (multi_agent.py의 _next_key() 유지)

### v2.x — 2026-04-27
- [x] 프로젝트 워크스페이스 (ProjectDetail, Knowledge, 지침)
- [x] RAG 프로젝트 격리 버그 수정 (project_id 지정 시 글로벌 검색 차단)
- [x] 브라우저 뒤로가기 History API 적용
- [x] 새로고침 시 항상 New Chat으로 시작
- [x] 이모지 전면 금지 → lucide-react SVG 아이콘으로 대체

### v1.x — 2026-04-25~26
- [x] RAG + 스킬 라우팅 + A2UI 응답 최초 구현
- [x] 대화 히스토리 (최근 5개 Q&A 컨텍스트 주입)
- [x] 스킬 파일 트리 (서브폴더 + MD/HTML/JSON 뷰어)
