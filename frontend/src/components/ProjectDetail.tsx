import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, MoreHorizontal, Pin, Share2, Plus, Pencil,
  FileText, Trash2, Upload, Check, X, Archive, ArchiveRestore,
  ChevronDown, ChevronRight, PinOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  updated_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  project_id: string;
}

interface KnowledgeFile {
  doc_id: string;
  filename: string;
  ext: string;
  size: number;
  updated_at: string;
  indexable: boolean;
  archived: boolean;
  pinned: boolean;
}

interface ProjectSkill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface Props {
  project: Project;
  onBack: () => void;
  onOpenChat: (sessionId: string, projectId: string, title?: string) => void;
  onNewChat: (projectId: string, initialQuestion?: string) => void;
  onProjectUpdated: (p: Project) => void;
}

// ── Helpers ───────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_COLORS: Record<string, string> = {
  pdf: "#f87171", md: "#60a5fa", txt: "#94a3b8",
  html: "#fb923c", json: "#a78bfa", docx: "#60a5fa",
};

// ── Main Component ────────────────────────────────────────

export function ProjectDetail({ project, onBack, onOpenChat, onNewChat, onProjectUpdated }: Props) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeFile[]>([]);
  const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([]);
  const [activeTab, setActiveTab] = useState<"chats" | "activity" | "skills">("chats");
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState(project.instructions);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showArchivedFiles, setShowArchivedFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    fetch(`/api/projects/${project.id}/conversations`)
      .then((r) => r.json())
      .then((d) => setConvs(d.conversations ?? []));
    fetch(`/api/projects/${project.id}/knowledge`)
      .then((r) => r.json())
      .then((d) => setKnowledge(d.files ?? []));
    fetch(`/api/projects/${project.id}/skills`)
      .then((r) => r.json())
      .then((d) => setProjectSkills(d.skills ?? []));
  };

  useEffect(() => {
    fetchData();
    setInstructionsText(project.instructions);
  }, [project.id]);

  const handleNewChat = () => {
    const q = input.trim();
    setInput("");
    onNewChat(project.id, q || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNewChat();
    }
  };

  const saveInstructions = async () => {
    setSavingInstructions(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: project.name, description: project.description, instructions: instructionsText }),
      });
      const updated = await res.json();
      onProjectUpdated({ ...project, instructions: instructionsText, ...updated });
      setEditingInstructions(false);
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const form = new FormData();
        form.append("file", file);
        await fetch(`/api/projects/${project.id}/knowledge`, { method: "POST", body: form });
      }
      fetchData();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleArchiveFile = async (filename: string, archive: boolean) => {
    await fetch(`/api/projects/${project.id}/knowledge/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    });
    fetchData();
  };

  const togglePinFile = async (filename: string, pin: boolean) => {
    await fetch(`/api/projects/${project.id}/knowledge/${encodeURIComponent(filename)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: pin }),
    });
    fetchData();
  };

  const deleteFile = async (filename: string) => {
    if (!confirm(`"${filename}" 파일을 삭제하시겠습니까?`)) return;
    await fetch(`/api/projects/${project.id}/knowledge/${encodeURIComponent(filename)}`, { method: "DELETE" });
    fetchData();
  };

  const activeFiles = knowledge.filter((f) => !f.archived);
  const archivedFiles = knowledge.filter((f) => f.archived);

  const toggleSkill = async (skillId: string, enabled: boolean) => {
    await fetch(`/api/projects/${project.id}/skills/${skillId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setProjectSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, enabled } : s))
    );
  };

  return (
    <div style={{ minHeight: "100%", background: "#141414", overflowY: "auto" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ── Back nav ── */}
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.85rem", padding: "0 0 24px", marginLeft: -4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
        >
          <ArrowLeft size={15} /> 모든 프로젝트
        </button>

        {/* ── Project header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700, color: "#e2e8f0" }}>{project.name}</h1>
            {project.description && (
              <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#6b7280" }}>{project.description}</p>
            )}
            <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#4b5563" }}>내가 만듦 · 비공개</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
            <IconBtn onClick={() => setShowMore((v) => !v)}><MoreHorizontal size={16} /></IconBtn>
            <IconBtn onClick={() => {}}><Pin size={16} /></IconBtn>
            <button style={{ background: "none", border: "1px solid #3a3a3a", borderRadius: 8, color: "#e2e8f0", padding: "6px 14px", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Share2 size={13} /> 공유
            </button>
            {showMore && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#252525", border: "1px solid #2a2a2a", borderRadius: 8, minWidth: 140, zIndex: 10 }}>
                <button
                  onClick={async () => {
                    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
                    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
                    onBack();
                  }}
                  style={{ width: "100%", padding: "9px 14px", background: "none", border: "none", color: "#f87171", fontSize: "0.82rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Trash2 size={13} /> 프로젝트 삭제
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── New chat input ── */}
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 16, background: "#1e1e1e", padding: "16px 20px", margin: "28px 0 32px" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="오늘 어떤 도움을 드릴까요?"
            rows={3}
            style={{ width: "100%", resize: "none", background: "transparent", border: "none", color: "#e2e8f0", fontSize: "0.95rem", fontFamily: "inherit", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid #2a2a2a" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <IconBtn onClick={() => fileInputRef.current?.click()} title="파일 첨부">
                <Plus size={16} />
              </IconBtn>
            </div>
            <button
              onClick={handleNewChat}
              style={{ background: input.trim() ? "#3b82f6" : "#2a2a2a", color: input.trim() ? "#fff" : "#4b5563", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: "0.85rem", cursor: input.trim() ? "pointer" : "default", fontWeight: 500, transition: "background 0.15s" }}
            >
              {input.trim() ? "전송" : "새 대화 시작"}
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #2a2a2a", marginBottom: 24 }}>
          {(["chats", "activity", "skills"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid #e2e8f0" : "2px solid transparent", color: activeTab === tab ? "#e2e8f0" : "#6b7280", padding: "8px 16px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 500, marginBottom: -1 }}
            >
              {tab === "chats" ? "내 대화" : tab === "activity" ? "활동" : "스킬"}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "0.72rem", color: "#374151", alignSelf: "center", paddingRight: 4 }}>
            공유하기 전까지 대화는 비공개로 유지됩니다.
          </span>
        </div>

        {/* ── Conversation list ── */}
        {activeTab === "chats" && (
          <div style={{ marginBottom: 40 }}>
            {convs.length === 0 ? (
              <p style={{ color: "#4b5563", fontSize: "0.85rem", textAlign: "center", padding: "32px 0" }}>
                아직 대화가 없습니다. 위에서 새 대화를 시작해보세요.
              </p>
            ) : (
              convs.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onOpenChat(conv.id, conv.project_id, conv.title)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", background: "none", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>{conv.title}</span>
                  <span style={{ color: "#4b5563", fontSize: "0.78rem", flexShrink: 0, marginLeft: 16 }}>
                    마지막 메시지 {timeAgo(conv.updated_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Skills tab ── */}
        {activeTab === "skills" && (
          <div style={{ marginBottom: 40 }}>
            {projectSkills.length === 0 ? (
              <p style={{ color: "#4b5563", fontSize: "0.85rem", textAlign: "center", padding: "32px 0" }}>
                등록된 스킬이 없습니다. 스킬 설정에서 스킬을 먼저 추가하세요.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projectSkills.map((skill) => (
                  <div
                    key={skill.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, background: "#1a1a1a", border: "1px solid #2a2a2a" }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.88rem", color: skill.enabled ? "#e2e8f0" : "#4b5563", fontWeight: 500 }}>{skill.name}</p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#4b5563" }}>{skill.description}</p>
                    </div>
                    <button
                      onClick={() => toggleSkill(skill.id, !skill.enabled)}
                      style={{
                        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                        background: skill.enabled ? "#3b82f6" : "#2a2a2a",
                        position: "relative", flexShrink: 0, transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                        left: skill.enabled ? 21 : 3,
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Instructions & Knowledge (지침/파일) — 스킬 탭 제외 ── */}
        {activeTab !== "skills" && (<>
        <Section
          title="지침"
          action={
            editingInstructions ? (
              <div style={{ display: "flex", gap: 6 }}>
                <SmallBtn onClick={() => { setEditingInstructions(false); setInstructionsText(project.instructions); }}>
                  <X size={13} />
                </SmallBtn>
                <SmallBtn onClick={saveInstructions} primary disabled={savingInstructions}>
                  <Check size={13} />
                </SmallBtn>
              </div>
            ) : (
              <SmallBtn onClick={() => setEditingInstructions(true)}>
                <Pencil size={13} />
              </SmallBtn>
            )
          }
        >
          {editingInstructions ? (
            <textarea
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder="이 프로젝트의 모든 대화에 적용할 지침을 입력하세요."
              rows={5}
              style={{ width: "100%", resize: "vertical", background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: 8, padding: 12, color: "#e2e8f0", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
            />
          ) : instructionsText ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{instructionsText}</p>
          ) : (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", fontStyle: "italic" }}>
              지침을 추가하면 이 프로젝트의 모든 대화에 적용됩니다.
            </p>
          )}
        </Section>

        {/* ── Knowledge (파일) ── */}
        <Section
          title="파일"
          action={
            <SmallBtn onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Plus size={13} />
            </SmallBtn>
          }
        >
          <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileUpload} />

          {activeFiles.length === 0 && archivedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: "1px dashed #2a2a2a", borderRadius: 12, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: "#1a1a1a" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            >
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 16 }}>
                {[{ r: -8 }, { r: 0 }, { r: 8 }].map(({ r }, i) => (
                  <FileText key={i} size={28} color="#4b5563" style={{ transform: `rotate(${r}deg)` }} />
                ))}
              </div>
              <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: "0.85rem" }}>
                이 프로젝트에서 참조할 PDF, 문서 또는 기타 텍스트를 추가하세요.
              </p>
              <p style={{ margin: 0, color: "#374151", fontSize: "0.75rem" }}>
                {uploading ? "업로드 중..." : "클릭하여 파일 선택"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {/* 활성 파일 */}
              {activeFiles.map((f) => (
                <div
                  key={f.doc_id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "#1a1a1a" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#222")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                >
                  <FileText size={16} color={FILE_COLORS[f.ext] ?? "#6b7280"} strokeWidth={1.6} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.filename}
                      {f.pinned && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "#3b82f6", background: "#1e2a3a", border: "1px solid #1d3a5f", borderRadius: 4, padding: "1px 5px" }}>항상 포함</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#4b5563" }}>{formatBytes(f.size)} · {f.indexable ? "RAG 인덱싱됨" : "저장됨"}</p>
                  </div>
                  <button
                    onClick={() => togglePinFile(f.filename, !f.pinned)}
                    title={f.pinned ? "핀 해제" : "항상 포함 (핀)"}
                    style={{ background: "none", border: "none", color: f.pinned ? "#3b82f6" : "transparent", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = f.pinned ? "#60a5fa" : "#94a3b8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = f.pinned ? "#3b82f6" : "transparent")}
                  >
                    {f.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                  </button>
                  <button
                    onClick={() => toggleArchiveFile(f.filename, true)}
                    title="아카이브"
                    style={{ background: "none", border: "none", color: "transparent", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "transparent")}
                  >
                    <Archive size={13} />
                  </button>
                  <button
                    onClick={() => deleteFile(f.filename)}
                    style={{ background: "none", border: "none", color: "transparent", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "transparent")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* 파일 추가 버튼 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed #2a2a2a", borderRadius: 8, padding: "8px 12px", color: "#4b5563", cursor: "pointer", fontSize: "0.8rem", marginTop: 4 }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              >
                <Upload size={13} /> {uploading ? "업로드 중..." : "파일 추가"}
              </button>

              {/* 아카이브된 파일 */}
              {archivedFiles.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => setShowArchivedFiles((v) => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "0.75rem", padding: "2px 0" }}
                  >
                    {showArchivedFiles ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    아카이브됨 {archivedFiles.length}
                  </button>
                  {showArchivedFiles && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 6 }}>
                      {archivedFiles.map((f) => (
                        <div
                          key={f.doc_id}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#161616", opacity: 0.6 }}
                        >
                          <FileText size={15} color="#4b5563" strokeWidth={1.6} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</p>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#374151" }}>{formatBytes(f.size)}</p>
                          </div>
                          <button
                            onClick={() => toggleArchiveFile(f.filename, false)}
                            title="복원"
                            style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
                          >
                            <ArchiveRestore size={13} />
                          </button>
                          <button
                            onClick={() => deleteFile(f.filename)}
                            style={{ background: "none", border: "none", color: "transparent", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "transparent")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Section>
        </>)}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #2a2a2a", background: "#1a1a1a" }}>
        <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: 16, background: "#161616" }}>{children}</div>
    </div>
  );
}

function IconBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 7, borderRadius: 7, display: "flex" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#252525"; e.currentTarget.style.color = "#e2e8f0"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6b7280"; }}
    >{children}</button>
  );
}

function SmallBtn({ onClick, children, primary, disabled, title }: { onClick: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{ background: primary ? "#3b82f6" : "none", border: primary ? "none" : "1px solid #3a3a3a", borderRadius: 6, color: primary ? "#fff" : "#94a3b8", cursor: disabled ? "not-allowed" : "pointer", padding: "4px 8px", display: "flex", alignItems: "center" }}
    >{children}</button>
  );
}
