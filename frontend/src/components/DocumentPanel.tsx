import { useState, useRef, useEffect } from "react";
import { FileText, Upload } from "lucide-react";

interface Document {
  doc_id: string;
  filename: string;
}

export function DocumentPanel() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then((d) => setDocs(d.documents ?? []));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      setDocs((prev) => [...prev, { doc_id: data.doc_id, filename: data.filename }]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #2a2a2a" }}>
        <p style={sectionLabel}>문서 관리</p>
        <label style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "#1e1e1e", border: "1px dashed #3a3a3a",
          borderRadius: 8, cursor: "pointer", fontSize: "0.82rem", color: "#94a3b8",
        }}>
          <Upload size={14} />
          <span>{uploading ? "업로드 중..." : "파일 선택 (PDF, TXT, MD)"}</span>
          <input ref={inputRef} type="file" accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {docs.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "#4a4a4a", marginTop: 8 }}>업로드된 문서가 없습니다.</p>
        ) : (
          <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {docs.map((d) => (
              <li key={d.doc_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "#1e1e1e" }}>
                <FileText size={13} color="#6b7280" strokeWidth={1.5} />
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.filename}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px",
};
