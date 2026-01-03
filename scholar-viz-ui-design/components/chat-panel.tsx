// scholar-viz-ui-design/components/chat-panel.tsx
"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"

type ChatTurn = { role: "user" | "assistant"; content: string }

type TutorStep = { step: string; evidence: string[] }
type Tutor = { final_answer_text: string; steps: TutorStep[] }

type ScholarVizResponse = {
  rewritten_question?: string
  topic_detected?: string
  retrieved_docs?: Array<{ id: string; title: string; quote: string }>
  selected_concepts?: string[]
  diagram?: { nodes: unknown[]; edges: unknown[] }
  lab?: { case_id: string; artifacts: unknown[]; highlights: unknown[] }
  tutor?: Tutor
  practice?: {
    question: string
    choices: string[]
    correct_index: number
    evidence_ids: string[]
    explanation: string
  }
  telemetry?: unknown
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
  content: "Hello! I'm your cybersecurity tutor. Ask me anything about phishing attacks or explore the diagram.",
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

function mergeDeep<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...target }
  for (const [k, v] of Object.entries(source)) {
    if (isObj(v) && isObj(out[k])) {
      out[k] = mergeDeep(out[k] as Record<string, unknown>, v)
    } else {
      out[k] = v
    }
  }
  return out as T
}

function parseSSEFrame(frame: string): { event: string | null; data: string } {
  let event: string | null = null
  const dataLines: string[] = []

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
  }

  return { event, data: dataLines.join("\n") }
}

export function ChatPanel({ strictEvidence, topic, chatHistory, setChatHistory, setLastResponse }: Props) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // streaming aggregation
  const assistantIdxRef = useRef<number | null>(null)
  const streamTextRef = useRef<string>("")
  const streamStepsRef = useRef<TutorStep[]>([])
  const responseAggRef = useRef<ScholarVizResponse>({})

  const bottomAnchor = useRef<HTMLDivElement>(null)
  useEffect(() => bottomAnchor.current?.scrollIntoView({ behavior: "smooth" }), [chatHistory])

  const ensureAssistantSlot = useCallback(() => {
    if (assistantIdxRef.current != null) return
    setChatHistory((prev) => {
      assistantIdxRef.current = prev.length
      return [...prev, { role: "assistant", content: "" }]
    })
  }, [setChatHistory])

  const writeAssistant = useCallback(
    (text: string) => {
      const idx = assistantIdxRef.current
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

  const handleSend = async () => {
    const userText = input.trim()
    if (!userText || loading) return

    const userMsg: ChatTurn = { role: "user", content: userText }

    // push user message
    let snapshot: ChatTurn[] = []
    setChatHistory((prev) => {
      snapshot = [...prev, userMsg]
      return snapshot
    })

    setInput("")
    setLoading(true)

    // reset streaming state
    assistantIdxRef.current = null
    streamTextRef.current = ""
    streamStepsRef.current = []
    responseAggRef.current = {}

    const ac = new AbortController()
    abortRef.current = ac

    try {
      // If snapshot didn't fill yet (rare), build from prop
      const requestHistory = snapshot.length ? snapshot : [...chatHistory, userMsg]

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          message: userMsg.content,
          chat_history: requestHistory,
          strict_mode: strictEvidence,
          user_id: "u1",
          optional_artifacts: null,
          ui_topic: topic,
        }),
        signal: ac.signal,
      })

      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(`UI route error ${res.status}: ${t}`)
      }

      if (!res.body) throw new Error("Empty response body")

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

          if (event === "chunk") {
            let payload: unknown = {}
            try {
              payload = JSON.parse(data)
            } catch {
              payload = {}
            }

            if (isObj(payload)) {
              responseAggRef.current = mergeDeep(
                responseAggRef.current as Record<string, unknown>,
                payload as Record<string, unknown>,
              ) as ScholarVizResponse

              setLastResponse(responseAggRef.current)

              const tutor = (payload as ScholarVizResponse).tutor
              if (tutor) {
                ensureAssistantSlot()

                if (typeof tutor.final_answer_text === "string" && tutor.final_answer_text.length) {
                  streamTextRef.current += tutor.final_answer_text
                }
                if (Array.isArray(tutor.steps) && tutor.steps.length) {
                  streamStepsRef.current = tutor.steps
                }

                const liveTxt = [
                  streamTextRef.current.trim(),
                  streamStepsRef.current.length
                    ? streamStepsRef.current.map((s, i) => `${i + 1}. ${s.step}`).join("\n")
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n\n")

                writeAssistant(liveTxt || " ")
              }
            }
          } else if (event === "done") {
            ensureAssistantSlot()

            // If text never streamed but we got an aggregated tutor, use that.
            const aggTutor = responseAggRef.current.tutor
            const finalText =
              streamTextRef.current.trim() ||
              (typeof aggTutor?.final_answer_text === "string" ? aggTutor.final_answer_text : "")

            const steps = streamStepsRef.current.length
              ? streamStepsRef.current
              : Array.isArray(aggTutor?.steps)
                ? aggTutor!.steps
                : []

            const out = [
              finalText.trim(),
              steps.length ? steps.map((s, i) => `${i + 1}. ${s.step}`).join("\n") : "",
            ]
              .filter(Boolean)
              .join("\n\n")

            writeAssistant(out || "(no response)")
          } else if (event === "error") {
            ensureAssistantSlot()
            writeAssistant(`Error: ${data}`)
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setChatHistory((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const messages = chatHistory.length ? chatHistory : [EMPTY_GREETING]

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

          <div ref={bottomAnchor} />
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
