from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from agent.doctalk_agent import DocTalkAgent
from rag.document_processor import DocumentProcessor
import skills_manager
import projects_manager
import conversation_store
import json

router = APIRouter()
agent = DocTalkAgent()
processor = DocumentProcessor()


# ── Request models ────────────────────────────────────────

class QuestionRequest(BaseModel):
    question: str
    session_id: str = "default"
    project_id: str | None = None


class SkillRequest(BaseModel):
    name: str
    description: str
    system_prompt: str


class ProjectRequest(BaseModel):
    name: str
    description: str = ""
    instructions: str = ""


class KnowledgePatchRequest(BaseModel):
    archived: bool | None = None
    pinned: bool | None = None

class SkillToggleRequest(BaseModel):
    enabled: bool






# ── Chat ──────────────────────────────────────────────────

@router.post("/ask")
async def ask_question(request: QuestionRequest):
    try:
        return await agent.answer(request.question, request.session_id, request.project_id)
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "quota" in err_msg.lower() or "RESOURCE_EXHAUSTED" in err_msg:
            msg = "API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요. (무료 티어 일일 한도)"
        else:
            msg = f"오류가 발생했습니다: {err_msg[:200]}"
        conversation_store.add_message(
            request.session_id, request.question, msg, "오류", request.project_id
        )
        return {
            "surfaceUpdate": {
                "surfaceId": "answer",
                "components": [{"id": "err", "component": {"Card": {"children": [
                    {"id": "err_text", "component": {"Text": {"text": msg}}}
                ]}}}],
            }
        }




# ── Projects ──────────────────────────────────────────────

@router.get("/projects")
async def list_projects():
    return {"projects": projects_manager.list_projects()}


@router.post("/projects")
async def create_project(body: ProjectRequest):
    return projects_manager.create_project(body.name, body.description, body.instructions)


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    project = projects_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectRequest):
    project = projects_manager.update_project(project_id, body.name, body.description, body.instructions)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    # ChromaDB 컬렉션도 함께 삭제
    try:
        processor.vectorstore.client.delete_collection(f"project_{project_id}_docs")
    except Exception:
        pass
    if not projects_manager.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted"}


# ── Project conversations ─────────────────────────────────

@router.get("/projects/{project_id}/conversations")
async def list_project_conversations(project_id: str):
    if not projects_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"conversations": conversation_store.list_conversations(project_id)}


@router.get("/projects/{project_id}/conversations/{session_id}")
async def get_project_conversation(project_id: str, session_id: str):
    conv = conversation_store.get_conversation(session_id, project_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


# ── Project knowledge (RAG) ───────────────────────────────

@router.get("/projects/{project_id}/knowledge")
async def list_knowledge(project_id: str):
    if not projects_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"files": projects_manager.list_knowledge(project_id)}


@router.post("/projects/{project_id}/knowledge")
async def upload_knowledge(project_id: str, file: UploadFile = File(...)):
    if not projects_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    content = await file.read()
    result = projects_manager.add_knowledge_file(project_id, file.filename, content)
    if result is None:
        raise HTTPException(status_code=400, detail="Upload failed")
    if result["indexable"]:
        await processor.process_project_doc(project_id, file.filename, content)
    return {"filename": file.filename, "status": "indexed" if result["indexable"] else "saved"}


@router.patch("/projects/{project_id}/knowledge/{filename}")
async def patch_knowledge(project_id: str, filename: str, body: KnowledgePatchRequest):
    if body.archived is not None:
        if body.archived:
            ok = projects_manager.archive_knowledge_file(project_id, filename)
            if not ok:
                raise HTTPException(status_code=404, detail="File not found")
            processor.remove_project_doc(project_id, filename)
        else:
            content = projects_manager.unarchive_knowledge_file(project_id, filename)
            if content is None:
                raise HTTPException(status_code=404, detail="File not found in archive")
            await processor.process_project_doc(project_id, filename, content)
    if body.pinned is not None:
        projects_manager.set_knowledge_pinned(project_id, filename, body.pinned)
    return {"filename": filename, "archived": body.archived, "pinned": body.pinned}




@router.delete("/projects/{project_id}/knowledge/{filename}")
async def delete_knowledge(project_id: str, filename: str):
    processor.remove_project_doc(project_id, filename)
    if not projects_manager.delete_knowledge_file(project_id, filename):
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "deleted"}


# ── Project skills ────────────────────────────────────────

@router.get("/projects/{project_id}/skills")
async def list_project_skills(project_id: str):
    if not projects_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    all_skills = skills_manager.list_skills()
    enabled = projects_manager.get_enabled_skills(project_id)
    return {"skills": [
        {**s, "enabled": s["id"] in enabled}
        for s in all_skills
    ]}


@router.patch("/projects/{project_id}/skills/{skill_id}")
async def toggle_project_skill(project_id: str, skill_id: str, body: SkillToggleRequest):
    if not projects_manager.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    if not skills_manager.get_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
    projects_manager.set_skill_enabled(project_id, skill_id, body.enabled)
    return {"skill_id": skill_id, "enabled": body.enabled}




# ── Skills ────────────────────────────────────────────────

@router.get("/skills")
async def list_skills():
    return {"skills": skills_manager.list_skills()}


@router.post("/skills")
async def create_skill(body: SkillRequest):
    return skills_manager.create_skill(body.name, body.description, body.system_prompt)


@router.put("/skills/{skill_id}")
async def update_skill(skill_id: str, body: SkillRequest):
    skill = skills_manager.update_skill(skill_id, body.name, body.description, body.system_prompt)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str):
    if not skills_manager.delete_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"status": "deleted"}


# ── Skill Files ───────────────────────────────────────────

@router.get("/skills/{skill_id}/files")
async def list_skill_files(skill_id: str):
    if not skills_manager.get_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"files": skills_manager.list_files(skill_id)}


@router.get("/skills/{skill_id}/files/content")
async def get_skill_file_content(
    skill_id: str,
    path: str = Query(...),
):
    content = skills_manager.get_file_content(skill_id, path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"path": path, "content": content}


@router.post("/skills/{skill_id}/files")
async def upload_skill_file(
    skill_id: str,
    file: UploadFile = File(...),
    folder: str = Query(default="references"),
):
    if not skills_manager.get_skill(skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
    folder = folder.strip("/")
    if ".." in folder.split("/"):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    rel_path = f"{folder}/{file.filename}" if folder else file.filename
    content = await file.read()
    result = skills_manager.add_file(skill_id, rel_path, content)
    if result is None:
        raise HTTPException(status_code=400, detail="Invalid path")
    if result["indexable"]:
        await processor.process_skill_ref(skill_id, rel_path, content)
    return {"path": rel_path, "status": "saved"}


@router.delete("/skills/{skill_id}/files")
async def delete_skill_file(
    skill_id: str,
    path: str = Query(...),
):
    processor.remove_skill_ref(skill_id, path)
    if not skills_manager.delete_file(skill_id, path):
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "deleted"}


# ── Conversations (global) ────────────────────────────────

@router.get("/conversations")
async def list_conversations():
    return {"conversations": conversation_store.list_conversations()}


@router.get("/conversations/{session_id}")
async def get_conversation(session_id: str):
    conv = conversation_store.get_conversation(session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


# ── Documents (legacy global upload) ─────────────────────

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()
    doc_id = await processor.process(file.filename, content)
    return {"doc_id": doc_id, "filename": file.filename, "status": "indexed"}


@router.get("/documents")
async def list_documents():
    return {"documents": processor.list_documents()}
