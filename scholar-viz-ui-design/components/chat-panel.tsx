import React, { useRef, useState, useEffect, Dispatch, SetStateAction } from "react";

/**
 * ChatPanel
 *
 * Props:
 *  - chatHistory: ChatTurn[]
 *  - setChatHistory: Dispatch<SetStateAction<ChatTurn[]>>
 *  - setLastResponse: Dispatch<SetStateAction<ScholarVizResponse | null>>
 *
 * Behavior:
 *  - Append user turn immediately.
 *  - Create assistant bubble BEFORE starting fetch.
 *  - Update that exact assistant bubble on chunk events.
 *  - On done: finalize assistant bubble and set lastResponse.
 */

export type Role = "user" | "assistant" | "system";

export type ChatTurn = {
  role: Role;
  content: string;
  id: string;
};

export type ScholarVizResponse = {
  // keep flexible; can be refined to the exact shape later
  rewritten_question?: string;
  topic_detected?: string;
  retrieved_docs?: any[];
  selected_concepts?: string[];
  diagram?: any;
  lab?: any;
  tutor?: any;
  practice?: any;
  telemetry?: any;
  [k: string]: any;
};

type Props = {
  chatHistory: ChatTurn[];
  setChatHistory: Dispatch<SetStateAction<ChatTurn[]>>;
  setLastResponse: Dispatch<SetStateAction<ScholarVizResponse | null>>;
  // optional: initial user id / settings
  userId?: string;
};

function mergeObjectsReplaceArrays(target: any, source: any): any {
  if (Array.isArray(source)) {
    return source.slice();
  }
  if (source !== null && typeof source === "object") {
    const out: any = { ...(target || {}) };
    for (const k of Object.keys(source)) {
      out[k] = mergeObjectsReplaceArrays(target?.[k], source[k]);
    }
    return out;
  }
  return source;
}

export default function ChatPanel({ chatHistory, setChatHistory, setLastResponse, userId = "local_ui_user" }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;

    // 1) Append user turn
    const userTurn: ChatTurn = { role: "user", content: text, id: `u-${Date.now()}` };
    setChatHistory((prev) => [...prev, userTurn]);
    setInput("");

    // 2) Create assistant slot BEFORE streaming (so the UI always has a bubble to update)
    const assistantId = `a-${Date.now()}`;
    const assistantTurn: ChatTurn = { role: "assistant", content: "", id: assistantId };
    setChatHistory((prev) => [...prev, assistantTurn]);

    setLoading(true);
    setLastResponse(null);

    try {
      abortRef.current = new AbortController();
      const resp = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chat_history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
          strict_mode: true,
          user_id: userId,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        setChatHistory((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${resp.status} ${resp.statusText}: ${errText}` } : m))
        );
        setLoading(false);
        return;
      }

      // Expect SSE stream (ready + chunk + done), but backend sends one chunk with entire JSON
      const reader = resp.body?.getReader();
      if (!reader) {
        setChatHistory((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: "No response body." } : m))
        );
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalParsed: ScholarVizResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // process complete SSE event blocks
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!raw) continue;

          // parse SSE-like lines
          const lines = raw.split("\n");
          let event = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            const c = line.indexOf(":");
            if (c === -1) continue;
            const field = line.slice(0, c).trim();
            const val = line.slice(c + 1).trim();
            if (field === "event") event = val;
            else if (field === "data") dataLines.push(val);
          }
          const data = dataLines.join("\n");
          if (event === "chunk") {
            // chunk expected to be a JSON payload
            try {
              const parsed = JSON.parse(data) as ScholarVizResponse;
              finalParsed = parsed;
              // update assistant bubble with final_answer if present, else use any tutor.final_answer or serialize
              const chunkText = parsed?.tutor?.final_answer ?? parsed?.final_answer ?? JSON.stringify(parsed);
              setChatHistory((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: chunkText } : m)));
              // set shared lastResponse so other panels can consume it
              setLastResponse(parsed);
            } catch (e) {
              // non-JSON chunk: append raw text
              setChatHistory((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + data } : m)));
            }
          } else if (event === "error") {
            setChatHistory((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${data}` } : m)));
            setLastResponse(null);
          } else if (event === "done") {
            // finalize and exit
            setLoading(false);
          } else if (event === "ready") {
            // no-op: server indicates it will send data
          } else {
            // generic data
            setChatHistory((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + data } : m)));
          }
        }
      }
      // stream ended: ensure loading cleared
      setLoading(false);
      if (finalParsed) {
        setLastResponse(finalParsed);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setChatHistory((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: "Request aborted." } : m)));
      } else {
        setChatHistory((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${err?.message ?? "unknown"}` } : m)));
      }
      setLoading(false);
    } finally {
      if (abortRef.current) {
        abortRef.current = null;
      }
    }
  }

  return (
    <div className="chat-panel">
      <div className="messages" style={{ maxHeight: 400, overflow: "auto" }}>
        {chatHistory.map((m) => (
          <div key={m.id} className={`message ${m.role}`} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: "600", fontSize: 12 }}>{m.role}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
      </div>

      <div className="composer" style={{ marginTop: 12 }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." style={{ width: "100%", minHeight: 80 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={handleSend} disabled={loading}>
            {loading ? "Thinking..." : "Send"}
          </button>
          <button
            onClick={() => {
              if (abortRef.current) abortRef.current.abort();
            }}
            disabled={!loading}
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
}
