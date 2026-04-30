import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  ScrollText, Search, Plus, Eye, Code2, MoreHorizontal,
  ChevronDown, ChevronRight, Trash2, Upload, FileText,
  FolderOpen, Folder, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface SkillFile {
  path: string;       // e.g. "references/guide.md"
  name: string;       // e.g. "guide.md"
  folder: string;     // e.g. "references" or ""
  ext: string;        // e.g. "md"
  size: number;
  updated_at: string;
  indexable: boolean;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  updated_at?: string;
  files?: SkillFile[];
}

const TEMPLATE = `---\nname: 새 스킬\ndescription: 이 스킬이 언제 사용되는지 설명하세요\n---\n\n## Role\n당신은 DocTalk AI입니다.\n\n## Rules\n1. 규칙을 작성하세요\n2. 항상 한국어로 답변하세요\n`;

function skillToRaw(skill: Skill) {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.system_prompt}`;
}

function rawToSkill(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { name: "", description: "", system_prompt: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key) meta[key.trim()] = rest.join(":").trim();
  }
  return { name: meta.name ?? "", description: meta.description ?? "", system_prompt: match[2].trim() };
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Group flat file list into { folder → files[] }
function groupByFolder(files: SkillFile[]): Record<string, SkillFile[]> {
  const groups: Record<string, SkillFile[]> = {};
  for (const f of files) {
    const key = f.folder || "(root)";
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  return groups;
}

// ── File Viewer ───────────────────────────────────────

function FileViewer({
  skillId, file, onClose,
}: {
  skillId: string;
  file: SkillFile;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"render" | "code">(
    ["md", "html", "json"].includes(file.ext) ? "render" : "code"
  );

  useEffect(() => {
    setLoading(true);
    setContent(null);
    fetch(`/api/skills/${skillId}/files/content?path=${encodeURIComponent(file.path)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setContent(d?.content ?? ""))
      .catch(() => setContent(""))
      .finally(() => setLoading(false));
  }, [skillId, file.path]);

  const canRender = ["md", "html", "json"].includes(file.ext);

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, background: "#1a1a1a", display: "flex", flexDirection: "column", marginTop: 12 }}>
      {/* Viewer header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileIcon ext={file.ext} size={14} />
          <span style={{ fontSize: "0.82rem", color: "#e2e8f0", fontWeight: 500 }}>{file.name}</span>
          <span style={{ fontSize: "0.7rem", color: "#4b5563" }}>{formatBytes(file.size)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {canRender && (
            <div style={{ display: "flex", background: "#252525", borderRadius: 8, padding: 2, gap: 2 }}>
              <ToggleBtn active={viewMode === "render"} onClick={() => setViewMode("render")} title="렌더링 보기">
                <Eye size={13} />
              </ToggleBtn>
              <ToggleBtn active={viewMode === "code"} onClick={() => setViewMode("code")} title="코드 보기">
                <Code2 size={13} />
              </ToggleBtn>
            </div>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, display: "flex", borderRadius: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
          ><X size={14} /></button>
        </div>
      </div>

      {/* Viewer content */}
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "#4b5563", fontSize: "0.82rem" }}>불러오는 중...</div>
        ) : viewMode === "render" ? (
          <RenderView ext={file.ext} content={content ?? ""} />
        ) : (
          <CodeView content={content ?? ""} />
        )}
      </div>
    </div>
  );
}

function RenderView({ ext, content }: { ext: string; content: string }) {
  if (ext === "md") {
    return (
      <div style={{ padding: "16px 20px", fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.8 }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }
  if (ext === "html") {
    return (
      <iframe
        srcDoc={content}
        sandbox="allow-scripts"
        style={{ width: "100%", minHeight: 300, border: "none", background: "#fff", borderRadius: "0 0 12px 12px" }}
        title="preview"
      />
    );
  }
  if (ext === "json") {
    let pretty = content;
    try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch {}
    return <CodeView content={pretty} />;
  }
  return <CodeView content={content} />;
}

function CodeView({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div style={{ display: "flex", fontFamily: "'Menlo','Monaco',monospace", fontSize: "0.78rem" }}>
      <div style={{ padding: "14px 0", minWidth: 40, textAlign: "right", color: "#3a3a3a", userSelect: "none", borderRight: "1px solid #2a2a2a", paddingRight: 10, flexShrink: 0 }}>
        {lines.map((_, i) => <div key={i} style={{ lineHeight: "1.7", paddingLeft: 8 }}>{i + 1}</div>)}
      </div>
      <pre style={{ flex: 1, margin: 0, padding: "14px 16px", color: "#e2e8f0", lineHeight: "1.7", overflowX: "auto", whiteSpace: "pre" }}>
        {content}
      </pre>
    </div>
  );
}

function FileIcon({ ext, size = 15 }: { ext: string; size?: number }) {
  const colors: Record<string, string> = {
    md: "#60a5fa", html: "#fb923c", json: "#a78bfa",
    js: "#fbbf24", ts: "#38bdf8", py: "#34d399",
    txt: "#94a3b8",
  };
  return <FileText size={size} color={colors[ext] ?? "#6b7280"} strokeWidth={1.6} />;
}

// ── Sidebar File Tree (compact, inside left panel) ───

function SidebarFileTree({
  skillId, files, selectedPath, onSelect, onDelete, onUpload, uploading,
}: {
  skillId: string;
  files: SkillFile[];
  selectedPath: string | null;
  onSelect: (f: SkillFile) => void;
  onDelete: (f: SkillFile) => void;
  onUpload: (folder: string) => void;
  uploading: boolean;
}) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const groups = groupByFolder(files);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(groups).forEach((k) => (initial[k] = true));
    setOpenFolders(initial);
  }, [files.length]);

  if (files.length === 0) {
    return (
      <div style={{ padding: "8px 10px", color: "#3a3a3a", fontSize: "0.72rem", lineHeight: 1.5 }}>
        파일 없음
      </div>
    );
  }

  return (
    <div>
      {Object.entries(groups).map(([folder, folderFiles]) => {
        const isOpen = openFolders[folder] !== false;
        const isRoot = folder === "(root)";
        return (
          <div key={folder}>
            {/* Folder row */}
            <div
              onClick={() => setOpenFolders((p) => ({ ...p, [folder]: !isOpen }))}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", cursor: "pointer", borderRadius: 6 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e1e")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {isOpen ? <ChevronDown size={10} color="#4b5563" /> : <ChevronRight size={10} color="#4b5563" />}
              {isOpen
                ? <FolderOpen size={12} color="#60a5fa" strokeWidth={1.6} />
                : <Folder size={12} color="#60a5fa" strokeWidth={1.6} />}
              <span style={{ flex: 1, fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isRoot ? "(root)" : folder}
              </span>
              <span style={{ fontSize: "0.62rem", color: "#374151" }}>{folderFiles.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onUpload(isRoot ? "" : folder); }}
                disabled={uploading}
                title="파일 추가"
                style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", padding: "1px 3px", borderRadius: 3, display: "flex", alignItems: "center", marginLeft: 2 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}
              >
                <Plus size={10} />
              </button>
            </div>

            {/* Files */}
            {isOpen && folderFiles.map((f) => (
              <div
                key={f.path}
                onClick={() => onSelect(f)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "3px 8px 3px 24px", cursor: "pointer", borderRadius: 6,
                  background: selectedPath === f.path ? "#2a2a2a" : "none",
                }}
                onMouseEnter={(e) => { if (selectedPath !== f.path) e.currentTarget.style.background = "#1e1e1e"; }}
                onMouseLeave={(e) => { if (selectedPath !== f.path) e.currentTarget.style.background = "none"; }}
              >
                <FileIcon ext={f.ext} size={11} />
                <span style={{
                  flex: 1, fontSize: "0.73rem",
                  color: selectedPath === f.path ? "#e2e8f0" : "#6b7280",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {f.name}
                </span>
                <span style={{ fontSize: "0.62rem", color: "#374151", flexShrink: 0 }}>{formatBytes(f.size)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(f); }}
                  style={{ background: "none", border: "none", color: "transparent", cursor: "pointer", padding: "1px 3px", borderRadius: 3, display: "flex", flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "transparent"; }}
                  title="삭제"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── File Tree ─────────────────────────────────────────

function FileTree({
  skillId, files, selectedPath, onSelect, onDelete, onUpload, uploading,
}: {
  skillId: string;
  files: SkillFile[];
  selectedPath: string | null;
  onSelect: (f: SkillFile) => void;
  onDelete: (f: SkillFile) => void;
  onUpload: (folder: string) => void;
  uploading: boolean;
}) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const groups = groupByFolder(files);

  // Auto-open all folders on first render
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(groups).forEach((k) => (initial[k] = true));
    setOpenFolders(initial);
  }, [files.length]);

  const toggleFolder = (folder: string) =>
    setOpenFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));

  if (files.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#4a4a4a", fontSize: "0.8rem", lineHeight: 1.6 }}>
        파일이 없습니다.<br />
        업로드하면 이 스킬이 답변 시 해당 파일을 우선 참조합니다.
      </div>
    );
  }

  return (
    <div>
      {Object.entries(groups).map(([folder, folderFiles]) => {
        const isOpen = openFolders[folder] !== false;
        const isRoot = folder === "(root)";
        return (
          <div key={folder}>
            {/* Folder row */}
            <div
              onClick={() => toggleFolder(folder)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", cursor: "pointer", userSelect: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e1e")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {isOpen ? <ChevronDown size={12} color="#6b7280" /> : <ChevronRight size={12} color="#6b7280" />}
              {isOpen
                ? <FolderOpen size={14} color="#60a5fa" strokeWidth={1.6} />
                : <Folder size={14} color="#60a5fa" strokeWidth={1.6} />}
              <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>
                {isRoot ? "(root)" : folder}
              </span>
              <span style={{ fontSize: "0.68rem", color: "#374151", marginLeft: 2 }}>
                {folderFiles.length}
              </span>
              {/* Upload to this folder */}
              <button
                onClick={(e) => { e.stopPropagation(); onUpload(isRoot ? "" : folder); }}
                disabled={uploading}
                title={`${folder}에 파일 추가`}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "#374151", cursor: "pointer", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Files in folder */}
            {isOpen && folderFiles.map((f) => (
              <div
                key={f.path}
                onClick={() => onSelect(f)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 14px 5px 34px", cursor: "pointer",
                  background: selectedPath === f.path ? "#252525" : "none",
                }}
                onMouseEnter={(e) => { if (selectedPath !== f.path) e.currentTarget.style.background = "#1e1e1e"; }}
                onMouseLeave={(e) => { if (selectedPath !== f.path) e.currentTarget.style.background = "none"; }}
              >
                <FileIcon ext={f.ext} size={13} />
                <span style={{
                  flex: 1, fontSize: "0.8rem",
                  color: selectedPath === f.path ? "#e2e8f0" : "#94a3b8",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {f.name}
                </span>
                <span style={{ fontSize: "0.68rem", color: "#374151", flexShrink: 0 }}>
                  {formatBytes(f.size)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(f); }}
                  style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", padding: "2px 4px", borderRadius: 4, display: "flex", flexShrink: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}
                  title="삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Main SkillsPanel ──────────────────────────────────

export function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [viewMode, setViewMode] = useState<"render" | "code">("render");
  const [editing, setEditing] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRaw, setNewRaw] = useState(TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SkillFile | null>(null);
  const [uploadFolder, setUploadFolder] = useState("references");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSkills = (keepSelected = true) =>
    fetch("/api/skills").then((r) => r.json()).then((d) => {
      const list: Skill[] = d.skills ?? [];
      setSkills(list);
      if (!keepSelected || !selected) {
        if (list.length > 0) setSelected(list[0]);
      } else {
        const updated = list.find((s) => s.id === selected?.id);
        if (updated) setSelected(updated);
      }
    });

  useEffect(() => { fetchSkills(false); }, []);

  const filtered = skills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = () => {
    if (!selected) return;
    setRawContent(skillToRaw(selected));
    setEditing(true);
    setViewMode("code");
  };

  const cancelEdit = () => { setEditing(false); setViewMode("render"); };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const parsed = rawToSkill(rawContent);
      await fetch(`/api/skills/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      await fetchSkills();
      setEditing(false);
      setViewMode("render");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected || !confirm("스킬을 삭제하시겠습니까?")) return;
    await fetch(`/api/skills/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    setSelectedFile(null);
    await fetchSkills(false);
    setShowMore(false);
  };

  const saveNew = async () => {
    setSaving(true);
    try {
      const parsed = rawToSkill(newRaw);
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const created = await res.json();
      await fetchSkills(false);
      setSelected(created);
      setCreating(false);
      setNewRaw(TEMPLATE);
    } finally { setSaving(false); }
  };

  const triggerUpload = (folder: string) => {
    setUploadFolder(folder);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const form = new FormData();
        form.append("file", file);
        await fetch(
          `/api/skills/${selected.id}/files?folder=${encodeURIComponent(uploadFolder)}`,
          { method: "POST", body: form }
        );
      }
      await fetchSkills();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileDelete = async (f: SkillFile) => {
    if (!selected || !confirm(`"${f.name}" 을 삭제하시겠습니까?`)) return;
    await fetch(
      `/api/skills/${selected.id}/files?path=${encodeURIComponent(f.path)}`,
      { method: "DELETE" }
    );
    if (selectedFile?.path === f.path) setSelectedFile(null);
    await fetchSkills();
  };

  const rawLines = (editing ? rawContent : selected ? skillToRaw(selected) : "").split("\n");

  return (
    <div style={{ display: "flex", height: "100%", background: "#141414" }}>

      {/* ── Left: Skill List ── */}
      <aside style={{ width: 300, background: "#1a1a1a", borderRight: "1px solid #2a2a2a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>스킬</span>
          <div style={{ display: "flex", gap: 4 }}>
            <IconBtn onClick={() => {}} title="검색"><Search size={15} /></IconBtn>
            <IconBtn onClick={() => { setCreating(true); setSelected(null); setSelectedFile(null); }} title="추가">
              <Plus size={15} />
            </IconBtn>
          </div>
        </div>

        <div style={{ padding: "0 12px 10px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="스킬 검색..."
            style={{ width: "100%", background: "#252525", border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: "0.8rem", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ padding: "4px 16px 6px", display: "flex", alignItems: "center", gap: 6 }}>
          <ChevronDown size={13} color="#6b7280" />
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>개인 스킬</span>
        </div>

        <ul style={{ flex: 1, overflowY: "auto", padding: "0 8px", margin: 0, listStyle: "none" }}>
          {filtered.map((skill) => {
            const isActive = selected?.id === skill.id && !creating;
            return (
              <li key={skill.id}>
                <button
                  onClick={() => { setSelected(skill); setCreating(false); setEditing(false); setViewMode("render"); setSelectedFile(null); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", border: "none", borderRadius: 8, cursor: "pointer",
                    background: isActive ? "#2a2a2a" : "none",
                    color: isActive ? "#e2e8f0" : "#94a3b8",
                    fontSize: "0.875rem", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#222"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "none"; }}
                >
                  <ScrollText size={16} strokeWidth={1.6} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.name}</div>
                    {skill.files && skill.files.length > 0 && (
                      <div style={{ fontSize: "0.68rem", color: "#374151", marginTop: 1 }}>
                        파일 {skill.files.length}개
                      </div>
                    )}
                  </div>
                </button>

                {/* ── Inline File Tree (expanded when selected) ── */}
                {isActive && (
                  <div style={{ margin: "2px 0 6px 4px", borderLeft: "1px solid #2a2a2a", paddingLeft: 4 }}>
                    {/* Upload button row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 2px" }}>
                      <span style={{ fontSize: "0.68rem", color: "#4b5563", fontWeight: 600, letterSpacing: "0.05em" }}>파일</span>
                      <button
                        onClick={() => triggerUpload("references")}
                        disabled={uploading}
                        title="파일 업로드"
                        style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: "2px 5px", borderRadius: 4, fontSize: "0.7rem" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
                      >
                        <Upload size={11} />{uploading ? "..." : "업로드"}
                      </button>
                    </div>

                    <SidebarFileTree
                      skillId={skill.id}
                      files={skill.files ?? []}
                      selectedPath={selectedFile?.path ?? null}
                      onSelect={(f) => setSelectedFile((prev) => prev?.path === f.path ? null : f)}
                      onDelete={handleFileDelete}
                      onUpload={triggerUpload}
                      uploading={uploading}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Right: Detail ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {creating ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0" }}>새 스킬</span>
              <div style={{ display: "flex", gap: 8 }}>
                <ActionBtn onClick={() => setCreating(false)} variant="ghost">취소</ActionBtn>
                <ActionBtn onClick={saveNew} disabled={saving} variant="primary">{saving ? "저장 중..." : "저장"}</ActionBtn>
              </div>
            </div>
            <CodeEditor value={newRaw} onChange={setNewRaw} />
          </div>
        ) : selected ? (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0" }}>{selected.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {editing ? (
                  <>
                    <ActionBtn onClick={cancelEdit} variant="ghost">취소</ActionBtn>
                    <ActionBtn onClick={saveEdit} disabled={saving} variant="primary">{saving ? "저장 중..." : "저장"}</ActionBtn>
                  </>
                ) : (
                  <>
                    <ActionBtn onClick={startEdit} variant="ghost">편집</ActionBtn>
                    <div style={{ position: "relative" }}>
                      <IconBtn onClick={() => setShowMore((v) => !v)}><MoreHorizontal size={15} /></IconBtn>
                      {showMore && (
                        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#252525", border: "1px solid #2a2a2a", borderRadius: 8, minWidth: 120, zIndex: 10 }}>
                          <button onClick={handleDelete} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "none", border: "none", color: "#f87171", fontSize: "0.82rem", cursor: "pointer", borderRadius: 8 }}>
                            <Trash2 size={13} /> 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Meta */}
            <div style={{ padding: "14px 28px", borderBottom: "1px solid #2a2a2a", display: "flex", gap: 40, flexShrink: 0 }}>
              {[
                { label: "추가한 사람", value: "사용자" },
                { label: "마지막 업데이트", value: selected.updated_at ?? "-" },
                { label: "트리거", value: "AI 자동 라우팅" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "#6b7280" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#e2e8f0", fontWeight: 500 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div style={{ padding: "14px 28px", borderBottom: "1px solid #2a2a2a", flexShrink: 0 }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.72rem", color: "#6b7280" }}>설명</p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.6 }}>{selected.description}</p>
            </div>

            {/* System Prompt */}
            <div style={{ margin: "16px 28px 0", border: "1px solid #2a2a2a", borderRadius: 12, background: "#1a1a1a", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px", borderBottom: "1px solid #2a2a2a" }}>
                <div style={{ display: "flex", background: "#252525", borderRadius: 8, padding: 2, gap: 2 }}>
                  <ToggleBtn active={viewMode === "render"} onClick={() => setViewMode("render")} title="렌더링 보기"><Eye size={14} /></ToggleBtn>
                  <ToggleBtn active={viewMode === "code"} onClick={() => { setViewMode("code"); if (!editing) { setRawContent(skillToRaw(selected)); setEditing(true); } }} title="코드 보기"><Code2 size={14} /></ToggleBtn>
                </div>
              </div>
              <div style={{ minHeight: 160, maxHeight: 360, overflowY: "auto" }}>
                {viewMode === "render" ? (
                  <div style={{ padding: "16px 20px", fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.8 }}>
                    <ReactMarkdown>{selected.system_prompt}</ReactMarkdown>
                  </div>
                ) : (
                  <div style={{ display: "flex", fontFamily: "'Menlo','Monaco',monospace", fontSize: "0.82rem" }}>
                    <div style={{ padding: "14px 0", minWidth: 40, textAlign: "right", color: "#3a3a3a", userSelect: "none", borderRight: "1px solid #2a2a2a", paddingRight: 10, flexShrink: 0 }}>
                      {rawLines.map((_, i) => <div key={i} style={{ lineHeight: "1.7", paddingLeft: 8 }}>{i + 1}</div>)}
                    </div>
                    <textarea
                      value={editing ? rawContent : skillToRaw(selected)}
                      onChange={(e) => editing && setRawContent(e.target.value)}
                      readOnly={!editing}
                      style={{ flex: 1, background: "transparent", color: "#e2e8f0", border: "none", outline: "none", resize: "none", padding: "14px 16px", lineHeight: "1.7", fontFamily: "'Menlo','Monaco',monospace", fontSize: "0.82rem", minHeight: 160 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileUpload} />

            {/* ── File Viewer (shown when a file is selected from sidebar) ── */}
            {selectedFile && (
              <div style={{ margin: "16px 28px 24px", flexShrink: 0 }}>
                <FileViewer
                  skillId={selected.id}
                  file={selectedFile}
                  onClose={() => setSelectedFile(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a4a4a" }}>
            <p>스킬을 선택하세요</p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────

function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lines = value.split("\n");
  return (
    <div style={{ flex: 1, display: "flex", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden", background: "#1a1a1a", fontFamily: "'Menlo','Monaco',monospace", fontSize: "0.82rem" }}>
      <div style={{ padding: "16px 0", minWidth: 44, textAlign: "right", color: "#4a4a4a", userSelect: "none", borderRight: "1px solid #2a2a2a", paddingRight: 12, flexShrink: 0 }}>
        {lines.map((_, i) => <div key={i} style={{ lineHeight: "1.7", paddingLeft: 8 }}>{i + 1}</div>)}
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, background: "transparent", color: "#e2e8f0", border: "none", outline: "none", resize: "none", padding: "16px", lineHeight: "1.7", fontFamily: "inherit", fontSize: "inherit" }}
      />
    </div>
  );
}

function IconBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >{children}</button>
  );
}

function ActionBtn({ onClick, children, variant, disabled }: { onClick: () => void; children: React.ReactNode; variant: "primary" | "ghost"; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: variant === "primary" ? "#2563eb" : "#252525",
      color: variant === "primary" ? "#fff" : "#94a3b8",
      border: "none", borderRadius: 8, padding: "6px 14px",
      fontSize: "0.82rem", cursor: disabled ? "not-allowed" : "pointer", fontWeight: 500,
    }}>{children}</button>
  );
}

function ToggleBtn({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? "#3a3a3a" : "none", color: active ? "#e2e8f0" : "#6b7280",
      border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}
