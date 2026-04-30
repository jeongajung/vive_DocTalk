import { useState, useEffect } from "react";
import { MessageSquare, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  question: string;
  answer: string;
  skill_name: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export function ConversationsPanel() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);

  useEffect(() => {
    fetch("/api/conversations").then((r) => r.json()).then((d) => setConvs(d.conversations ?? []));
  }, []);

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    setSelected(data);
  };

  if (selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}>
            ←
          </button>
          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected.title}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {selected.messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ alignSelf: "flex-end", background: "#2563eb", color: "#fff", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", maxWidth: "85%", fontSize: "0.82rem" }}>
                {msg.question}
              </div>
              <div style={{ background: "#1e1e1e", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "#3b82f6", marginBottom: 6, background: "#1e3a5f", padding: "2px 8px", borderRadius: 10 }}>
                  {msg.skill_name}
                </span>
                <ReactMarkdown>{msg.answer}</ReactMarkdown>
              </div>
              <p style={{ margin: 0, fontSize: "0.68rem", color: "#4a4a4a", textAlign: "right" }}>
                {new Date(msg.timestamp).toLocaleString("ko-KR")}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #2a2a2a" }}>
        <p style={sectionLabel}>대화 기록</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {convs.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "#4a4a4a", padding: "0 8px" }}>대화 기록이 없습니다.</p>
        ) : (
          <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
            {convs.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => openDetail(conv.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e1e")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <MessageSquare size={14} color="#6b7280" strokeWidth={1.5} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.title}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "#4a4a4a" }}>
                      {new Date(conv.updated_at).toLocaleDateString("ko-KR")} · {conv.messages.length}개 메시지
                    </p>
                  </div>
                  <ChevronRight size={12} color="#4a4a4a" />
                </button>
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
  textTransform: "uppercase", letterSpacing: "0.08em", margin: 0,
};
