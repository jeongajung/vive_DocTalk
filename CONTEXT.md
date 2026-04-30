# DocTalk — 프로젝트 컨텍스트

## 무엇인가
RAG 기반 AI 문서 Q&A 플랫폼. 사용자가 문서를 업로드하면 ChromaDB에 인덱싱되고, 자연어 질문에 Gemini가 문서 기반으로 답변한다.

## 기술 스택
- **백엔드**: Python 3.12 / FastAPI / uv / ChromaDB / Google Gemini (`gemini-3-flash-preview`)
- **프론트엔드**: TypeScript / React 18 / Vite (포트 5173) / lucide-react / react-markdown
- **API 프록시**: Vite `/api` → `localhost:8000`

## 디렉토리 구조
```
doctalk/
├── backend/
│   ├── agent/
│   │   ├── doctalk_agent.py     # 단일 RAG 에이전트 (스킬 라우팅 + 답변 생성)
│   │   ├── multi_agent.py       # API 키 풀 관리 전용 (_next_key round-robin)
│   │   └── prompts.py           # RAG_USER_TEMPLATE, NO_CONTEXT_TEMPLATE
│   ├── rag/
│   │   ├── vectorstore.py       # ChromaDB 컬렉션 관리, 프로젝트 격리
│   │   └── document_processor.py
│   ├── api/routes.py            # FastAPI 라우터
│   ├── projects_manager.py      # 프로젝트 CRUD + Knowledge + 핀 메타데이터
│   ├── skills_manager.py        # 스킬 CRUD + 참조 파일
│   └── conversation_store.py    # 대화 저장
├── frontend/
│   └── src/
│       ├── App.tsx              # 라우팅, History API, LNB
│       └── components/
│           ├── ChatInterface.tsx     # 채팅 (fetch /api/ask)
│           ├── ProjectDetail.tsx     # 프로젝트 상세 (Knowledge, 핀, 아카이브)
│           ├── SkillsPanel.tsx
│           ├── A2UIRenderer.tsx
│           └── DocumentUpload.tsx
├── TODO.md      ← 할 일 목록 (항상 먼저 읽을 것)
├── CONTEXT.md   ← 이 파일
└── RULES.md     ← 작업 규칙
```

## 핵심 동작 흐름
```
사용자 질문
→ POST /api/ask
→ doctalk_agent: 스킬 라우팅 (2개 이상일 때만 API 호출)
→ 프로젝트 지침 + 핀된 파일 → system prompt
→ ChromaDB RAG 검색 (스킬 refs → 프로젝트 Knowledge → 글로벌)
→ Gemini 답변 생성 (RAG 있으면 RAG_USER_TEMPLATE, 없으면 NO_CONTEXT_TEMPLATE)
→ A2UI JSON 반환
```

## Knowledge 파일 상태
- **활성**: `knowledge/` 폴더, RAG 인덱싱됨
- **핀됨**: `KNOWLEDGE_META.json`에 `pinned: true`, 매 대화 system prompt에 직접 주입
- **아카이브**: `knowledge/_archive/` 폴더, RAG에서 제외

## 현재 버전
v4.1 — 단일 에이전트, Knowledge 핀/아카이브, 4개 키 round-robin
