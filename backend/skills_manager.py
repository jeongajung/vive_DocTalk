import os
import re
import uuid
import shutil
from datetime import datetime

SKILLS_DIR = os.path.join(os.path.dirname(__file__), "skills")

# File types that can be indexed for RAG
INDEXABLE_EXTS = {".md", ".txt", ".html", ".json"}


def _migrate_flat_skills():
    """Migrate old flat {id}.md files to {id}/SKILL.md directory structure."""
    os.makedirs(SKILLS_DIR, exist_ok=True)
    for filename in os.listdir(SKILLS_DIR):
        if not filename.endswith(".md"):
            continue
        skill_id = filename[:-3]
        flat_path = os.path.join(SKILLS_DIR, filename)
        new_dir = os.path.join(SKILLS_DIR, skill_id)
        if os.path.isdir(new_dir):
            continue
        os.makedirs(new_dir, exist_ok=True)
        os.rename(flat_path, os.path.join(new_dir, "SKILL.md"))


def _parse_md(content: str) -> dict:
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", content, re.DOTALL)
    if not match:
        return {"name": "", "description": "", "system_prompt": content.strip()}
    meta_block, body = match.group(1), match.group(2).strip()
    meta = {}
    for line in meta_block.splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return {
        "name": meta.get("name", ""),
        "description": meta.get("description", ""),
        "system_prompt": body,
    }


def _skill_dir(skill_id: str) -> str:
    return os.path.join(SKILLS_DIR, skill_id)


def _skill_path(skill_id: str) -> str:
    return os.path.join(SKILLS_DIR, skill_id, "SKILL.md")


def _to_md(name: str, description: str, system_prompt: str) -> str:
    return f"---\nname: {name}\ndescription: {description}\n---\n\n{system_prompt}\n"


def _safe_abs(skill_id: str, rel_path: str) -> str | None:
    """Resolve rel_path within the skill dir, reject path traversal."""
    base = os.path.realpath(_skill_dir(skill_id))
    target = os.path.realpath(os.path.join(base, rel_path))
    if not target.startswith(base + os.sep) and target != base:
        return None
    # Disallow overwriting SKILL.md
    if os.path.basename(target) == "SKILL.md":
        return None
    return target


# ── Skills CRUD ─────────────────────────────────────────

def list_skills() -> list[dict]:
    _migrate_flat_skills()
    os.makedirs(SKILLS_DIR, exist_ok=True)
    skills = []
    for entry in sorted(os.listdir(SKILLS_DIR)):
        entry_path = os.path.join(SKILLS_DIR, entry)
        if not os.path.isdir(entry_path):
            continue
        skill_path = os.path.join(entry_path, "SKILL.md")
        if not os.path.exists(skill_path):
            continue
        with open(skill_path, "r", encoding="utf-8") as f:
            parsed = _parse_md(f.read())
        mtime = os.path.getmtime(skill_path)
        updated_at = datetime.fromtimestamp(mtime).strftime("%Y년 %-m월 %-d일")
        skills.append({
            "id": entry,
            "updated_at": updated_at,
            "files": list_files(entry),
            **parsed,
        })
    return skills


def get_skill(skill_id: str) -> dict | None:
    path = _skill_path(skill_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        parsed = _parse_md(f.read())
    return {"id": skill_id, "files": list_files(skill_id), **parsed}


def create_skill(name: str, description: str, system_prompt: str) -> dict:
    skill_id = str(uuid.uuid4())[:8]
    os.makedirs(_skill_dir(skill_id), exist_ok=True)
    with open(_skill_path(skill_id), "w", encoding="utf-8") as f:
        f.write(_to_md(name, description, system_prompt))
    return {"id": skill_id, "name": name, "description": description,
            "system_prompt": system_prompt, "files": []}


def update_skill(skill_id: str, name: str, description: str, system_prompt: str) -> dict | None:
    path = _skill_path(skill_id)
    if not os.path.exists(path):
        return None
    with open(path, "w", encoding="utf-8") as f:
        f.write(_to_md(name, description, system_prompt))
    return {"id": skill_id, "name": name, "description": description,
            "system_prompt": system_prompt, "files": list_files(skill_id)}


def delete_skill(skill_id: str) -> bool:
    d = _skill_dir(skill_id)
    if not os.path.exists(d):
        return False
    shutil.rmtree(d)
    return True


# ── File tree ────────────────────────────────────────────

def list_files(skill_id: str) -> list[dict]:
    """Return a flat list of all files under the skill dir (excluding SKILL.md)."""
    base = _skill_dir(skill_id)
    if not os.path.exists(base):
        return []
    result = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for fname in sorted(filenames):
            if fname == "SKILL.md":
                continue
            abs_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(abs_path, base)
            folder = os.path.dirname(rel_path) or ""
            ext = os.path.splitext(fname)[1].lower()
            result.append({
                "path": rel_path,           # e.g. "references/prd_template.md"
                "name": fname,
                "folder": folder,           # e.g. "references" or ""
                "ext": ext.lstrip("."),     # e.g. "md"
                "size": os.path.getsize(abs_path),
                "updated_at": datetime.fromtimestamp(
                    os.path.getmtime(abs_path)
                ).strftime("%Y년 %-m월 %-d일"),
                "indexable": ext in INDEXABLE_EXTS,
            })
    return result


def get_file_content(skill_id: str, rel_path: str) -> str | None:
    abs_path = _safe_abs(skill_id, rel_path)
    if not abs_path or not os.path.isfile(abs_path):
        return None
    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def add_file(skill_id: str, rel_path: str, content: bytes) -> dict | None:
    """Save content to skill_dir/rel_path, creating subdirs as needed."""
    abs_path = _safe_abs(skill_id, rel_path)
    if abs_path is None:
        return None
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "wb") as f:
        f.write(content)
    ext = os.path.splitext(rel_path)[1].lower()
    return {
        "path": rel_path,
        "name": os.path.basename(rel_path),
        "folder": os.path.dirname(rel_path),
        "ext": ext.lstrip("."),
        "size": len(content),
        "indexable": ext in INDEXABLE_EXTS,
    }


def delete_file(skill_id: str, rel_path: str) -> bool:
    abs_path = _safe_abs(skill_id, rel_path)
    if not abs_path or not os.path.isfile(abs_path):
        return False
    os.remove(abs_path)
    # Remove empty parent dirs (but not the skill root)
    parent = os.path.dirname(abs_path)
    skill_root = os.path.realpath(_skill_dir(skill_id))
    while os.path.realpath(parent) != skill_root:
        if os.path.isdir(parent) and not os.listdir(parent):
            os.rmdir(parent)
            parent = os.path.dirname(parent)
        else:
            break
    return True


# ── Backward-compat aliases (used by existing code) ─────

def list_references(skill_id: str) -> list[dict]:
    return list_files(skill_id)


def add_reference(skill_id: str, filename: str, content: bytes) -> dict | None:
    return add_file(skill_id, f"references/{filename}", content)


def delete_reference(skill_id: str, filename: str) -> bool:
    return delete_file(skill_id, f"references/{filename}")
