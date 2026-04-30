import { useState, useRef, useEffect } from "react";
import { Paperclip, FileText } from "lucide-react";

interface Document {
  doc_id: string;
  filename: string;
}

export function DocumentUpload() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => setDocs(data.documents ?? []));
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
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        문서 업로드
      </p>

      <label style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: "#f9fafb",
        border: "1px dashed #d1d5db",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: "0.85rem",
        color: "#374151",
      }}>
        <Paperclip size={14} color="#6b7280" />
        <span>{uploading ? "업로드 중..." : "파일 선택 (PDF, TXT, MD)"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          style={{ display: "none" }}
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {docs.length > 0 && (
        <ul style={{ marginTop: 10, padding: 0, listStyle: "none" }}>
          {docs.map((d) => (
            <li key={d.doc_id} style={{ fontSize: "0.8rem", color: "#6b7280", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={13} color="#6b7280" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.filename}</span>
            </li>
          ))}
        </ul>
      )}

      {docs.length === 0 && (
        <p style={{ fontSize: "0.75rem", color: "#d1d5db", marginTop: 10 }}>
          업로드된 문서가 없습니다.
        </p>
      )}
    </div>
  );
}
