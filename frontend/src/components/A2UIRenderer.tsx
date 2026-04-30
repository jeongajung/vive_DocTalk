import ReactMarkdown from "react-markdown";
import type { A2UINode, A2UIMessage } from "../types/a2ui";
import { ScrollText } from "lucide-react";

function A2UINode({ node }: { node: A2UINode }) {
  const def = node.component;

  if ("Text" in def) {
    const { text, variant = "body" } = def.Text;
    if (variant === "subtitle") return <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", margin: "0 0 8px" }}>{text}</p>;
    if (variant === "title") return <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 8px" }}>{text}</p>;
    return (
      <div style={{ fontSize: "0.88rem", lineHeight: 1.75, color: "#cbd5e1" }}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    );
  }

  if ("Card" in def) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "14px 18px", marginBottom: 10 }}>
        {def.Card.children.map((child) => <A2UINode key={child.id} node={child} />)}
      </div>
    );
  }

  if ("Chip" in def) {
    const isSkill = def.Chip.label.startsWith("스킬:");
    const label = isSkill ? def.Chip.label.replace("스킬:", "").trim() : def.Chip.label;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: isSkill ? "#1e2a3a" : "#1e1e1e",
        border: `1px solid ${isSkill ? "#1d3a5f" : "#2a2a2a"}`,
        borderRadius: 20, padding: "3px 10px",
        fontSize: "0.75rem", color: isSkill ? "#60a5fa" : "#6b7280",
        marginRight: 6, marginBottom: 6,
      }}>
        {isSkill && <ScrollText size={11} color="#60a5fa" />}
        {label}
      </span>
    );
  }

  if ("Button" in def) {
    return (
      <button style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: "0.875rem" }}>
        {def.Button.label}
      </button>
    );
  }

  return null;
}

export function A2UIRenderer({ message }: { message: A2UIMessage | null }) {
  if (!message) return null;
  return (
    <div>
      {message.surfaceUpdate.components.map((node) => <A2UINode key={node.id} node={node} />)}
    </div>
  );
}
