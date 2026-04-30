import { useState, useRef, useEffect } from "react";
import { ScrollText } from "lucide-react";
import { A2UIRenderer } from "./A2UIRenderer";
import type { A2UIMessage } from "../types/a2ui";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  a2ui?: A2UIMessage;
  skillName?: string;
  timestamp?: string;
}

function newSessionId(): string {
  return crypto.randomUUID();
}

interface Props {
  sessionId?: string;
  projectId?: string;
  projectName?: string;
  convTitle?: string;
  onNewMessage?: () => void;
  onBack?: () => void;
}

export function ChatInterface({ sessionId: initSessionId, projectId, projectName, convTitle, onNewMessage, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(initSessionId ?? newSessionId());

  // 기존 대화 이력 로드
  useEffect(() => {
    const sid = sessionId.current;
    const url = projectId
      ? `/api/projects/${projectId}/conversations/${sid}`
      : `/api/conversations/${sid}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((conv) => {
        if (conv?.messages?.length) {
          const loaded: Message[] = [];
          conv.messages.forEach((m: { question: string; answer: string; skill_name?: string; timestamp?: string }, i: number) => {
            loaded.push({ id: `h_u_${i}`, role: "user", text: m.question });
            loaded.push({
              id: `h_a_${i}`,
              role: "assistant",
              text: m.answer,
              skillName: m.skill_name,
              timestamp: m.timestamp,
            });
          });
          setMessages(loaded);
        }
      })
      .catch(() => {})
      .finally(() => {
        setInitializing(false);
        const initialQ = sessionStorage.getItem("doctalk_initial_question");
        if (initialQ) {
          sessionStorage.removeItem("doctalk_initial_question");
          setInput(initialQ);
        }
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? input).trim();
    if (!question || loading) return;

    setInput("");
    const userMsgId = `u_${Date.now()}`;
    const assistantMsgId = `a_${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          session_id: sessionId.current,
          project_id: projectId ?? null,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as A2UIMessage;

      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", a2ui: data },
      ]);

      onNewMessage?.();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const msg = errMsg.includes("429") || errMsg.toLowerCase().includes("quota")
        ? "API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요."
        : "오류가 발생했습니다. 다시 시도해주세요.";
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", text: msg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showEmpty = !initializing && messages.length === 0;

  if (initializing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#141414" }}>
        <Dots />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#141414" }}>

      {/* Breadcrumb header */}
      {(projectName || convTitle) && (
        <div style={{ padding: "10px 24px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {projectName && onBack ? (
            <button
              onClick={onBack}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.82rem", padding: "2px 4px", borderRadius: 4 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              {projectName}
            </button>
          ) : projectName ? (
            <span style={{ color: "#6b7280", fontSize: "0.82rem" }}>{projectName}</span>
          ) : null}
          {projectName && convTitle && (
            <span style={{ color: "#374151", fontSize: "0.82rem" }}>/</span>
          )}
          {convTitle && (
            <span style={{ color: "#94a3b8", fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
              {convTitle}
            </span>
          )}
        </div>
      )}

      {showEmpty ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px 80px" }}>
          {projectName && (
            <p style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: 12 }}>{projectName}</p>
          )}
          <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 32 }}>
            안녕하세요, 좋은 하루입니다.
          </p>
          <div style={{ width: "100%", maxWidth: 720, position: "relative" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="오늘은 어떤 도움이 필요하세요?"
              rows={4}
              autoFocus
              style={{ width: "100%", resize: "none", background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 16, padding: "20px 56px 20px 20px", fontSize: "0.95rem", fontFamily: "inherit", color: "#e2e8f0", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{ position: "absolute", right: 14, bottom: 14, width: 36, height: 36, borderRadius: 10, background: input.trim() ? "#3b82f6" : "#2a2a2a", color: input.trim() ? "#fff" : "#4a4a4a", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", transition: "background 0.15s" }}
            >↑</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "user" ? (
                    <div style={{ background: "#2563eb", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", maxWidth: "72%", fontSize: "0.9rem", lineHeight: 1.6 }}>
                      {msg.text}
                    </div>
                  ) : (
                    <div style={{ maxWidth: "85%", width: "100%" }}>
                      {msg.a2ui ? (
                        <A2UIRenderer message={msg.a2ui} />
                      ) : (
                        <div>
                          {((msg.skillName && msg.skillName !== "오류") || msg.timestamp) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              {msg.skillName && msg.skillName !== "오류" && (
                                <span style={{ background: "#1e2a3a", border: "1px solid #1d3a5f", color: "#60a5fa", fontSize: "0.75rem", fontWeight: 500, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <ScrollText size={11} color="#60a5fa" />
                                  {msg.skillName}
                                </span>
                              )}
                              {msg.timestamp && (
                                <span style={{ fontSize: "0.68rem", color: "#374151" }}>
                                  {new Date(msg.timestamp).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          )}
                          <div style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.8 }}>
                            <ReactMarkdown>{msg.text ?? ""}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 6 }}>
                  <Dots />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* 입력창 */}
          <div style={{ padding: "12px 24px 16px", borderTop: "1px solid #2a2a2a", flexShrink: 0 }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
              <div style={{ position: "relative" }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="질문을 입력하세요... (Enter로 전송)"
                  rows={2}
                  style={{ width: "100%", resize: "none", background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 12, padding: "12px 52px 12px 16px", fontSize: "0.9rem", fontFamily: "inherit", color: "#e2e8f0", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }}
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  style={{ position: "absolute", right: 10, bottom: 10, width: 32, height: 32, borderRadius: 8, background: input.trim() ? "#3b82f6" : "#2a2a2a", color: input.trim() ? "#fff" : "#4a4a4a", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", transition: "background 0.15s" }}
                >↑</button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

function Dots() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#3a3a3a", display: "inline-block", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
      ))}
    </>
  );
}
