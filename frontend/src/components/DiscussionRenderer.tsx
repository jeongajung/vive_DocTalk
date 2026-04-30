import ReactMarkdown from "react-markdown";

export interface AgentMsg {
  agent: string;
  color: string;
  text: string;
}

export interface DiscussionRound {
  round: number;
  messages: AgentMsg[];
}

export interface DiscussionData {
  rounds: DiscussionRound[];
  summary?: string;
  streaming?: boolean;
}

interface Props {
  data: DiscussionData;
}

export function DiscussionRenderer({ data }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {data.rounds.map((round) => (
        <div key={round.round}>
          {data.rounds.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
              <span style={{ fontSize: "0.72rem", color: "#4b5563" }}>Round {round.round}</span>
              <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {round.messages.map((msg, i) => (
              <AgentBubble key={i} msg={msg} />
            ))}
          </div>
        </div>
      ))}

      {/* 스트리밍 중 로딩 표시 */}
      {data.streaming && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
          <Dots />
          <span style={{ fontSize: "0.75rem", color: "#4b5563" }}>토론 진행 중...</span>
        </div>
      )}

      {/* 최종 종합 */}
      {data.summary && (
        <div style={{
          marginTop: 16,
          background: "#1a2332",
          border: "1px solid #1e3a5f",
          borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{
              background: "#1d4ed8",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 20,
            }}>
              종합
            </span>
          </div>
          <div style={{ fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.8 }}>
            <ReactMarkdown>{data.summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentBubble({ msg }: { msg: AgentMsg }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        background: msg.color,
        color: "#fff",
        fontSize: "0.7rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
      }}>
        {msg.agent}
      </span>
      <div style={{
        background: "#1e1e1e",
        border: `1px solid ${msg.color}33`,
        borderRadius: "4px 14px 14px 14px",
        padding: "10px 14px",
        fontSize: "0.88rem",
        color: "#cbd5e1",
        lineHeight: 1.7,
        maxWidth: "90%",
      }}>
        {msg.text}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: "50%", background: "#3a3a3a",
            display: "inline-block",
            animation: `bounce 1.2s ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </>
  );
}
