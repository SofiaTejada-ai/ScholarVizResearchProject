// scholar-viz-ui-design/components/chat-panel.tsx
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"

type ChatTurn = { role: "user" | "assistant"; content: string }

type TutorStep = { step: string; evidence: string[] }
type Tutor = { final_answer_text: string; steps: TutorStep[] }

export type ScholarVizResponse = {
  topic?: string
  title?: string
  summary?: string
  diagram?: { type: string; code: string; title: string }
  steps?: string[]
  sources?: Array<{ id: string; title: string; section?: string; snippet: string; ref: string; confidence: number }>
  lab?: {
    enabled: boolean
    case_file: string
    artifact_text: string
    highlights: Array<{ start_line: number; end_line: number; label: string; reason: string }>
    next_steps: string[]
  }
  practice?: { question: string; hint: string; answer: string }
  strict_evidence_used?: boolean
  kb_coverage?: "high" | "medium" | "low" | "none"
}

type Props = {
  strictEvidence: boolean
  topic: string
  chatHistory: ChatTurn[]
  setChatHistory: React.Dispatch<React.SetStateAction<ChatTurn[]>>
  setLastResponse: React.Dispatch<React.SetStateAction<ScholarVizResponse | null>>
}

const SUGGESTED_QUESTIONS = [
  "What is spear phishing?",
  "How do attackers move laterally?",
  "Explain pass-the-hash attacks",
  "What are common email indicators?",
] as const

const EMPTY_GREETING: ChatTurn = {
  role: "assistant",
  content: "Hello! I’m your cybersecurity tutor. Ask me anything, and I’ll ground answers in the lab + course snippets.",
}

function parseSSEFrame(frame: string): { event: string | null; data: string } {
  let event: string | null = null
  const dataLines: string[] = []
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
  }
  return { event, data: dataLines.join("\n") }
}

export function ChatPanel({ strictEvidence, topic, chatHistory, setChatHistory, setLastResponse }: Props) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const assistantIndexRef = useRef<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [chatHistory, loading])

  const messages = useMemo(() => (chatHistory.length ? chatHistory : [EMPTY_GREETING]), [chatHistory])

  const ensureAssistantSlot = useCallback(() => {
    if (assistantIndexRef.current != null) return
    setChatHistory((prev) => {
      assistantIndexRef.current = prev.length
      return [...prev, { role: "assistant", content: "" }]
    })
  }, [setChatHistory])

  const writeAssistant = useCallback(
    (text: string) => {
      const idx = assistantIndexRef.current
      if (idx == null) return
      setChatHistory((prev) => {
        if (idx >= prev.length) return prev
        const next = prev.slice()
        next[idx] = { role: "assistant", content: text || " " }
        return next
      })
    },
    [setChatHistory],
  )

  const handleSend = useCallback(async () => {
    const userText = input.trim()
    if (!userText || loading) return

    // optimistic UI
    const userMsg: ChatTurn = { role: "user", content: userText }
    setChatHistory((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setLastResponse(null)

    // reset streaming refs
    assistantIndexRef.current = null
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // We send the history as it exists "now" + this user message.
    // (Using current chatHistory here is fine; even if state updates async,
    // backend doesn’t require perfect parity for UI.)
    const historyToSend = [...chatHistory, userMsg]

    try {
      ensureAssistantSlot()
      writeAssistant("") // clear any old text

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: userText,
          chat_history: historyToSend,
          strict_mode: strictEvidence,
          user_id: "u1",
          optional_artifacts: null,
          ui_topic: topic,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        writeAssistant(`Error: ${res.status} ${txt.slice(0, 300)}`)
        return
      }

      if (!res.body) {
        writeAssistant("Error: empty response body")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let sep: number
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, sep)
          buf = buf.slice(sep + 2)

          const { event, data } = parseSSEFrame(frame)
          if (!event) continue

          if (event === "chunk") {
            let payload: ScholarVizResponse | null = null
            try {
              payload = JSON.parse(data) as ScholarVizResponse
            } catch {
              payload = null
            }
            if (!payload) continue

            setLastResponse(payload)

            // Build a short preview (4–8 lines max) for the chat bubble
            const previewLines: string[] = []
            if (payload.summary) {
              // Take first 2 sentences or truncate to 2 lines
              const sentences = payload.summary.split('. ').filter(Boolean)
              previewLines.push(sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : ''))
            }
            if (!previewLines.length && payload.title) {
              previewLines.push(payload.title)
            }
            if (!previewLines.length) {
              previewLines.push("View explanation and diagram.")
            }
            writeAssistant(previewLines.join("\n"))
          }

          if (event === "error") {
            writeAssistant(`Error: ${data}`)
          }

          if (event === "done") {
            // nothing else needed; chunk already wrote final message
          }
        }
      }
    } catch (err: any) {
      writeAssistant(`Error: ${err?.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [
    input,
    loading,
    chatHistory,
    setChatHistory,
    setLastResponse,
    strictEvidence,
    topic,
    ensureAssistantSlot,
    writeAssistant,
  ])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  return (
    <div className="w-[350px] border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Chat</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm ${
                m.role === "user" ? "ml-8 bg-primary/10" : "mr-8 bg-muted/50"
              } p-3 rounded-lg whitespace-pre-wrap`}
            >
              {m.content}
            </div>
          ))}

          {loading && <div className="mr-8 bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">Thinking…</div>}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex gap-2 flex-wrap">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput(q)}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question…"
            className="flex-1"
          />
          <Button size="icon" disabled={loading} onClick={handleSend}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
