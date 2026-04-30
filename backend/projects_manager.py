import os
import re
import uuid
import json
import shutil
from datetime import datetime

PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "projects")
INDEXABLE_EXTS = {".pdf", ".md", ".txt", ".html", ".json"}


# ── Path helpers ─────────────────────────────────────────

def _project_dir(pid: str) -> str:
    return os.path.join(PROJECTS_DIR, pid)

def _project_path(pid: str) -> str:
    return os.path.join(PROJECTS_DIR, pid, "PROJECT.md")

def _knowledge_dir(pid: str) -> str:
    return os.path.join(PROJECTS_DIR, pid, "knowledge")

def _conv_dir(pid: str) -> str:
    return os.path.join(PROJECTS_DIR, pid, "conversations")

def _archive_dir(pid: str) -> str:
    return os.path.join(PROJECTS_DIR, pid, "knowledge", "_archive")

def _meta_path(pid: str) -> str:
    return os.path.join(PROJECTS_DIR, pid, "KNOWLEDGE_META.json")


# ── Markdown serialization ────────────────────────────────

def _to_md(name: str, description: str, instructions: str = "") -> str:
    return f"---\nname: {name}\ndescription: {description}\n---\n\n{instructions}\n"

def _parse_md(content: str) -> dict:
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", content, re.DOTALL)
    if not match:
        return {"name": "", "description": "", "instructions": content.strip()}
    meta = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    return {
        "name": meta.get("name", ""),
        "description": meta.get("description", ""),
        "instructions": match.group(2).strip(),
    }


# ── Project CRUD ──────────────────────────────────────────

def list_projects() -> list[dict]:
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    result = []
    for entry in os.listdir(PROJECTS_DIR):
        path = _project_path(entry)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            parsed = _parse_md(f.read())
        mtime = os.path.getmtime(path)
        result.append({
            "id": entry,
            "updated_at": datetime.fromtimestamp(mtime).isoformat(),
            **parsed,
        })
    result.sort(key=lambda p: p["updated_at"], reverse=True)
    return result


def get_project(pid: str) -> dict | None:
    path = _project_path(pid)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        parsed = _parse_md(f.read())
    return {"id": pid, **parsed}


def create_project(name: str, description: str, instructions: str = "") -> dict:
    pid = str(uuid.uuid4())[:8]
    os.makedirs(_conv_dir(pid), exist_ok=True)
    os.makedirs(_knowledge_dir(pid), exist_ok=True)
    with open(_project_path(pid), "w", encoding="utf-8") as f:
        f.write(_to_md(name, description, instructions))
    return {"id": pid, "name": name, "description": description, "instructions": instructions}


def update_project(pid: str, name: str, description: str, instructions: str) -> dict | None:
    if not os.path.exists(_project_path(pid)):
        return None
    with open(_project_path(pid), "w", encoding="utf-8") as f:
        f.write(_to_md(name, description, instructions))
    return {"id": pid, "name": name, "description": description, "instructions": instructions}


def delete_project(pid: str) -> bool:
    d = _project_dir(pid)
    if not os.path.exists(d):
        return False
    shutil.rmtree(d)
    return True


# ── Knowledge (RAG files) ─────────────────────────────────

def _get_meta(pid: str) -> dict:
    path = _meta_path(pid)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def _set_meta(pid: str, meta: dict):
    with open(_meta_path(pid), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

def set_knowledge_pinned(pid: str, filename: str, pinned: bool):
    meta = _get_meta(pid)
    meta.setdefault(filename, {})["pinned"] = pinned
    _set_meta(pid, meta)

def get_pinned_contents(pid: str) -> list[tuple[str, str]]:
    meta = _get_meta(pid)
    result = []
    for fname, props in meta.items():
        if not props.get("pinned"):
            continue
        path = os.path.join(_knowledge_dir(pid), fname)
        if os.path.isfile(path):
            try:
                with open(path, encoding="utf-8") as f:
                    result.append((fname, f.read()))
            except Exception:
                pass
    return result

def list_knowledge(pid: str) -> list[dict]:
    kdir = _knowledge_dir(pid)
    adir = _archive_dir(pid)
    meta = _get_meta(pid)
    if not os.path.exists(kdir):
        return []
    result = []
    for fname in sorted(os.listdir(kdir)):
        abs_path = os.path.join(kdir, fname)
        if not os.path.isfile(abs_path):
            continue
        ext = os.path.splitext(fname)[1].lower()
        result.append({
            "doc_id": fname, "filename": fname,
            "ext": ext.lstrip("."), "size": os.path.getsize(abs_path),
            "updated_at": datetime.fromtimestamp(os.path.getmtime(abs_path)).isoformat(),
            "indexable": ext in INDEXABLE_EXTS,
            "archived": False,
            "pinned": meta.get(fname, {}).get("pinned", False),
        })
    if os.path.exists(adir):
        for fname in sorted(os.listdir(adir)):
            abs_path = os.path.join(adir, fname)
            if not os.path.isfile(abs_path):
                continue
            ext = os.path.splitext(fname)[1].lower()
            result.append({
                "doc_id": fname, "filename": fname,
                "ext": ext.lstrip("."), "size": os.path.getsize(abs_path),
                "updated_at": datetime.fromtimestamp(os.path.getmtime(abs_path)).isoformat(),
                "indexable": ext in INDEXABLE_EXTS,
                "archived": True,
                "pinned": False,
            })
    return result


def add_knowledge_file(pid: str, filename: str, content: bytes) -> dict | None:
    if not os.path.exists(_project_path(pid)):
        return None
    kdir = _knowledge_dir(pid)
    os.makedirs(kdir, exist_ok=True)
    abs_path = os.path.join(kdir, filename)
    with open(abs_path, "wb") as f:
        f.write(content)
    ext = os.path.splitext(filename)[1].lower()
    return {
        "doc_id": filename, "filename": filename,
        "ext": ext.lstrip("."), "size": len(content),
        "indexable": ext in INDEXABLE_EXTS, "archived": False,
    }


def archive_knowledge_file(pid: str, filename: str) -> bool:
    src = os.path.join(_knowledge_dir(pid), filename)
    if not os.path.isfile(src):
        return False
    adir = _archive_dir(pid)
    os.makedirs(adir, exist_ok=True)
    shutil.move(src, os.path.join(adir, filename))
    return True


def unarchive_knowledge_file(pid: str, filename: str) -> bytes | None:
    src = os.path.join(_archive_dir(pid), filename)
    if not os.path.isfile(src):
        return None
    with open(src, "rb") as f:
        content = f.read()
    shutil.move(src, os.path.join(_knowledge_dir(pid), filename))
    return content


def delete_knowledge_file(pid: str, filename: str) -> bool:
    for d in [_knowledge_dir(pid), _archive_dir(pid)]:
        abs_path = os.path.join(d, filename)
        if os.path.isfile(abs_path):
            os.remove(abs_path)
            return True
    return False


