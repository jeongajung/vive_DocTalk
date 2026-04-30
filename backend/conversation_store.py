import json
import os
from datetime import datetime

PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "projects")
# 프로젝트 미소속 대화 저장 경로 (기존 호환)
ORPHAN_DIR = os.path.join(os.path.dirname(__file__), "data", "conversations")


def _project_conv_path(project_id: str, session_id: str) -> str:
    return os.path.join(PROJECTS_DIR, project_id, "conversations", f"{session_id}.json")


def _orphan_conv_path(session_id: str) -> str:
    return os.path.join(ORPHAN_DIR, f"{session_id}.json")


def _load_conv_file(path: str) -> dict | None:
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def _save_conv_file(path: str, conv: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(conv, f, ensure_ascii=False, indent=2)


# ── Read ──────────────────────────────────────────────────

def list_conversations(project_id: str | None = None) -> list[dict]:
    """project_id 지정 시 해당 프로젝트 대화만, 없으면 프로젝트+미소속 전체."""
    result = []

    if project_id:
        conv_dir = os.path.join(PROJECTS_DIR, project_id, "conversations")
        if os.path.exists(conv_dir):
            for fname in os.listdir(conv_dir):
                if fname.endswith(".json"):
                    conv = _load_conv_file(os.path.join(conv_dir, fname))
                    if conv:
                        result.append(conv)
        result.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
        return result

    # 모든 프로젝트 대화
    if os.path.exists(PROJECTS_DIR):
        for pid in os.listdir(PROJECTS_DIR):
            if os.path.isdir(os.path.join(PROJECTS_DIR, pid)):
                result.extend(list_conversations(pid))

    # 프로젝트 미소속 대화
    if os.path.exists(ORPHAN_DIR):
        for fname in os.listdir(ORPHAN_DIR):
            if fname.endswith(".json"):
                conv = _load_conv_file(os.path.join(ORPHAN_DIR, fname))
                if conv:
                    result.append(conv)

    result.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return result


def get_conversation(session_id: str, project_id: str | None = None) -> dict | None:
    # 프로젝트 지정 시 해당 경로 우선
    if project_id:
        conv = _load_conv_file(_project_conv_path(project_id, session_id))
        if conv:
            return conv

    # 프로젝트 전체 검색
    if os.path.exists(PROJECTS_DIR):
        for pid in os.listdir(PROJECTS_DIR):
            path = _project_conv_path(pid, session_id)
            conv = _load_conv_file(path)
            if conv:
                return conv

    # 미소속 대화 검색
    return _load_conv_file(_orphan_conv_path(session_id))


# ── Write ─────────────────────────────────────────────────

def add_message(
    session_id: str,
    question: str,
    answer: str,
    skill_name: str,
    project_id: str | None = None,
):
    now = datetime.now().isoformat()

    # 저장 경로 결정
    if project_id:
        path = _project_conv_path(project_id, session_id)
    else:
        # project_id 없으면 기존 대화에서 찾아서 해당 위치에 저장
        existing = get_conversation(session_id)
        if existing and existing.get("project_id"):
            project_id = existing["project_id"]
            path = _project_conv_path(project_id, session_id)
        else:
            # 프로젝트 미소속 대화로 저장
            path = _orphan_conv_path(session_id)

    # 기존 대화 로드 or 새 대화 생성
    conv = _load_conv_file(path)
    if not conv:
        conv = {
            "id": session_id,
            "project_id": project_id,
            "title": question[:40] + ("..." if len(question) > 40 else ""),
            "created_at": now,
            "updated_at": now,
            "messages": [],
        }

    conv["messages"].append({
        "question": question,
        "answer": answer,
        "skill_name": skill_name,
        "timestamp": now,
    })
    conv["updated_at"] = now

    _save_conv_file(path, conv)
