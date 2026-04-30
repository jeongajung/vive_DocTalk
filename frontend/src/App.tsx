import { useState, useEffect, useCallback } from "react";
import { Plus, ScrollText, Archive } from "lucide-react";
import { ChatInterface } from "./components/ChatInterface";
import { SkillsPanel } from "./components/SkillsPanel";
import { ProjectDetail, type Project } from "./components/ProjectDetail";

type View = "chat" | "skills" | "projects" | "project_detail";

interface ConvSummary {
  id: string;
  title: string;
  updated_at: string;
  project_id?: string;
}

type HistoryState = {
  view: View;
  sessionKey: number;
  activeConvId: string | null;
  activeConvTitle: string | null;
  activeProjectId: string | null;
  selectedProjectId: string | null;
};

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [sessionKey, setSessionKey] = useState(0);
  const [convs, setConvs] = useState<ConvSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConvTitle, setActiveConvTitle] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchConvs = useCallback(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConvs(d.conversations ?? []));
  }, []);

  const fetchProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  useEffect(() => {
    fetchConvs();
    fetchProjects();
    // 초기 히스토리 상태 등록
    window.history.replaceState(
      { view: "chat", sessionKey: 0, activeConvId: null, activeConvTitle: null, activeProjectId: null, selectedProjectId: null } satisfies HistoryState,
      ""
    );
  }, [fetchConvs, fetchProjects]);

  // 뒤로가기 처리
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as HistoryState | null;
      if (!s) return;
      setView(s.view);
      setSessionKey(s.sessionKey);
      setActiveConvId(s.activeConvId);
      setActiveConvTitle(s.activeConvTitle);
      setActiveProjectId(s.activeProjectId);
      if (s.selectedProjectId) {
        setProjects((prev) => {
          const found = prev.find((p) => p.id === s.selectedProjectId);
          if (found) setSelectedProject(found);
          return prev;
        });
      } else {
        setSelectedProject(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const pushNav = (state: HistoryState) => {
    window.history.pushState(state, "");
  };

  const newChat = () => {
    const next: HistoryState = { view: "chat", sessionKey: sessionKey + 1, activeConvId: null, activeConvTitle: null, activeProjectId: null, selectedProjectId: null };
    pushNav(next);
    setActiveConvId(null);
    setActiveConvTitle(null);
    setActiveProjectId(null);
    setView("chat");
    setSessionKey((k) => k + 1);
  };

  const openConv = (id: string, projectId?: string, title?: string) => {
    const next: HistoryState = { view: "chat", sessionKey: sessionKey + 1, activeConvId: id, activeConvTitle: title ?? null, activeProjectId: projectId ?? null, selectedProjectId: null };
    pushNav(next);
    setActiveConvId(id);
    setActiveConvTitle(title ?? null);
    setActiveProjectId(projectId ?? null);
    setView("chat");
    setSessionKey((k) => k + 1);
  };

  const openProject = (p: Project) => {
    const next: HistoryState = { view: "project_detail", sessionKey, activeConvId: null, activeConvTitle: null, activeProjectId: null, selectedProjectId: p.id };
    pushNav(next);
    setSelectedProject(p);
    setView("project_detail");
  };

  const startChatInProject = (projectId: string, initialQuestion?: string) => {
    const sessionId = crypto.randomUUID();
    if (initialQuestion) sessionStorage.setItem("doctalk_initial_question", initialQuestion);
    const next: HistoryState = { view: "chat", sessionKey: sessionKey + 1, activeConvId: sessionId, activeConvTitle: null, activeProjectId: projectId, selectedProjectId: null };
    pushNav(next);
    setActiveConvId(sessionId);
    setActiveConvTitle(null);
    setActiveProjectId(projectId);
    setView("chat");
    setSessionKey((k) => k + 1);
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#1a1a1a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e2e8f0" }}>

      {/* ── Sidebar (기존 구조 유지) ── */}
      <aside style={{ width: 280, background: "#1a1a1a", borderRight: "1px solid #2a2a2a", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 12px" }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>DocTalk</span>
        </div>

        {/* New Chat */}
        <div style={{ padding: "0 8px 8px" }}>
          <button
            onClick={newChat}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#94a3b8", fontSize: "0.875rem" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            <Plus size={16} strokeWidth={2} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ padding: "0 8px" }}>
          <NavItem icon={<ScrollText size={16} strokeWidth={1.8} />} label="스킬 설정" active={view === "skills"} onClick={() => { pushNav({ view: "skills", sessionKey, activeConvId, activeConvTitle, activeProjectId, selectedProjectId: selectedProject?.id ?? null }); setView("skills"); }} />
          <NavItem icon={<Archive size={16} strokeWidth={1.8} />} label="프로젝트" active={view === "projects" || view === "project_detail"} onClick={() => { pushNav({ view: "projects", sessionKey, activeConvId, activeConvTitle, activeProjectId, selectedProjectId: null }); setView("projects"); }} />
        </nav>

        {/* Recents */}
        <div style={{ flex: 1, overflowY: "auto", marginTop: 16 }}>
          {convs.length > 0 && (
            <>
              <p style={{ padding: "0 16px", margin: "0 0 6px", fontSize: "0.72rem", color: "#6b7280", fontWeight: 500 }}>Recents</p>
              {convs.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => openConv(conv.id, conv.project_id, conv.title)}
                  style={{
                    width: "100%", display: "block", padding: "7px 16px",
                    background: activeConvId === conv.id ? "#252525" : "none",
                    border: "none", borderLeft: activeConvId === conv.id ? "2px solid #3b82f6" : "2px solid transparent",
                    cursor: "pointer", textAlign: "left",
                    color: activeConvId === conv.id ? "#e2e8f0" : "#94a3b8",
                    fontSize: "0.825rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { if (activeConvId !== conv.id) e.currentTarget.style.background = "#222"; }}
                  onMouseLeave={(e) => { if (activeConvId !== conv.id) e.currentTarget.style.background = "none"; }}
                >
                  {conv.title}
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#141414" }}>

        {view === "chat" && (
          <ChatInterface
            key={sessionKey}
            sessionId={activeConvId ?? undefined}
            projectId={activeProjectId ?? undefined}
            projectName={projects.find((p) => p.id === activeProjectId)?.name}
            convTitle={activeConvTitle ?? undefined}
            onNewMessage={() => { fetchConvs(); }}
            onBack={activeProjectId ? () => {
              const p = projects.find((x) => x.id === activeProjectId);
              if (p) { setSelectedProject(p); setView("project_detail"); }
            } : undefined}
          />
        )}

        {view === "skills" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <SkillsPanel />
          </div>
        )}

        {view === "projects" && (
          <ProjectsHome
            projects={projects}
            onOpenProject={openProject}
            onRefresh={fetchProjects}
          />
        )}

        {view === "project_detail" && selectedProject && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ProjectDetail
              project={selectedProject}
              onBack={() => setView("projects")}
              onOpenChat={(sessionId, projectId, title) => openConv(sessionId, projectId, title)}
              onNewChat={startChatInProject}
              onProjectUpdated={(p) => {
                setSelectedProject(p);
                fetchProjects();
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Projects Home ─────────────────────────────────────────

import { FolderOpen } from "lucide-react";

function ProjectsHome({
  projects, onOpenProject, onRefresh,
}: {
  projects: Project[];
  onOpenProject: (p: Project) => void;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), instructions: "" }),
      });
      const created = await res.json();
      setCreating(false); setName(""); setDesc("");
      onRefresh();
      onOpenProject(created);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "48px" }}>
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#e2e8f0" }}>프로젝트</h1>
          <button
            onClick={() => setCreating(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "#3b82f6", border: "none", borderRadius: 9, color: "#fff", padding: "9px 18px", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
          >
            <Plus size={15} /> 새 프로젝트
          </button>
        </div>

        {creating && (
          <div style={{ border: "1px solid #2a2a2a", borderRadius: 14, padding: 24, marginBottom: 24, background: "#1a1a1a" }}>
            <p style={{ margin: "0 0 14px", fontWeight: 600, color: "#e2e8f0" }}>새 프로젝트</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="프로젝트 이름"
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setCreating(false); setName(""); setDesc(""); } }}
              style={{ width: "100%", background: "#252525", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
            <input value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="프로젝트 설명 (선택)"
              style={{ width: "100%", background: "#252525", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setCreating(false); setName(""); setDesc(""); }} style={{ background: "#252525", border: "none", borderRadius: 8, color: "#94a3b8", padding: "7px 16px", cursor: "pointer", fontSize: "0.85rem" }}>취소</button>
              <button onClick={save} disabled={saving || !name.trim()} style={{ background: "#3b82f6", border: "none", borderRadius: 8, color: "#fff", padding: "7px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>
                {saving ? "생성 중..." : "생성"}
              </button>
            </div>
          </div>
        )}

        {projects.length === 0 && !creating ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
            <FolderOpen size={40} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ margin: "0 0 8px", fontSize: "1rem" }}>프로젝트가 없습니다</p>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>새 프로젝트를 만들어 문서와 대화를 관리하세요</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {projects.map((p) => (
              <button key={p.id} onClick={() => onOpenProject(p)}
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "20px", border: "1px solid #2a2a2a", borderRadius: 14, background: "#1a1a1a", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              >
                <FolderOpen size={20} strokeWidth={1.5} color="#60a5fa" style={{ marginBottom: 12 }} />
                <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "0.95rem", color: "#e2e8f0" }}>{p.name}</p>
                {p.description && (
                  <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "#6b7280", lineHeight: 1.5 }}>{p.description}</p>
                )}
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#374151" }}>
                  {new Date(p.updated_at ?? "").toLocaleDateString("ko-KR")}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", background: active ? "#252525" : "none",
        border: "none", borderLeft: active ? "2px solid #3b82f6" : "2px solid transparent",
        borderRadius: active ? "0 8px 8px 0" : 8,
        cursor: "pointer", color: active ? "#60a5fa" : "#94a3b8", fontSize: "0.875rem",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#222"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "none"; }}
    >
      {icon}<span>{label}</span>
    </button>
  );
}
