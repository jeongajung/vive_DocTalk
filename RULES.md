# DocTalk — 작업 규칙

> Claude Code가 DocTalk 작업 시 반드시 지켜야 할 규칙.
> 세션 시작 시 TODO.md → CONTEXT.md → RULES.md 순서로 읽을 것.

## 절대 규칙

- **모델명 변경 금지**: `gemini-3-flash-preview` 고정. 다른 모델명으로 바꾸면 전체 채팅 중단됨
- **이모지 사용 금지**: UI 및 코드 전체에서 이모지 금지. 아이콘은 `lucide-react` SVG만 사용
- **한국어 응답**: 사용자에게 한국어로 답변할 것

## 코드 규칙

- 주석 최소화 — 자명한 코드에 주석 달지 않기
- 에러 핸들링은 시스템 경계(API 엔드포인트)에서만
- 불필요한 추상화, 헬퍼 함수 생성 금지
- 기존 파일 수정 우선, 새 파일 생성 최소화

## 프론트엔드 규칙

- 스타일링: Inline CSS만 사용 (CSS 파일, CSS-in-JS 라이브러리 도입 금지)
- 상태 관리: React useState/useEffect만 사용 (Redux, Zustand 등 금지)
- 타입스크립트: 작업 후 `npx tsc --noEmit`으로 반드시 타입 체크

## 백엔드 규칙

- 패키지 추가 시 `uv add {패키지명}` 사용
- Python 문법 체크: `python3 -m py_compile {파일}`
- API 엔드포인트 추가 시 routes.py에만 작성

## 서버 실행

```bash
# 백엔드
cd backend && uv run uvicorn main:app --reload --port 8000

# 프론트엔드
cd frontend && npm run dev
```

## 작업 완료 후

1. TODO.md 완료 항목을 아카이브 섹션으로 이동
2. 주요 변경 시 CONTEXT.md 업데이트
3. 컨플루언스 문서 업데이트 요청 시 사용자에게 확인 후 진행
