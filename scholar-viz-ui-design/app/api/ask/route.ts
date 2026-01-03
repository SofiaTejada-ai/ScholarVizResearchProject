// scholar-viz-ui-design/app/api/ask/route.ts
import { NextRequest } from "next/server"

type ChatTurn = { role: "user" | "assistant"; content: string }

type TutorStep = { step: string; evidence: string[] }
type Tutor = { final_answer_text: string; steps: TutorStep[] }

type ScholarVizResponse = {
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

function sseEncode(event: string, data: unknown) {
  const payload = typeof data === "string" ? data : JSON.stringify(data)
  return `event: ${event}\ndata: ${payload}\n\n`
}

function jsonSafe(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {}
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const backendBase = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "")
  const backendUrl = `${backendBase}/api/ask`

  const payload = {
    message: String(body.message ?? ""),
    chat_history: (body.chat_history as ChatTurn[]) ?? [],
    strict_mode: Boolean(body.strict_mode ?? false),
    user_id: String(body.user_id ?? "u1"),
    optional_artifacts: body.optional_artifacts ?? null,
    ui_topic: String(body.ui_topic ?? "phishing"),
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEncode(event, data)))

      // Abort handling
      const ac = new AbortController()
      const abort = () => ac.abort()
      req.signal.addEventListener("abort", abort)

      try {
        send("ready", { ok: true, backend: backendUrl })

        const res = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ac.signal,
        })

        if (!res.ok) {
          const text = await res.text().catch(() => "")
          send("error", { error: `Backend ${res.status}: ${text || res.statusText}` })
          send("done", { done: true })
          controller.close()
          return
        }

        // Backend returns full JSON (non-stream). Emit ONE chunk (simple + robust).
        const data = (await res.json().catch(() => ({}))) as ScholarVizResponse
        send("chunk", jsonSafe(data))
        send("done", { done: true })
        controller.close()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        send("error", { error: msg })
        send("done", { done: true })
        controller.close()
      } finally {
        req.signal.removeEventListener("abort", abort)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
