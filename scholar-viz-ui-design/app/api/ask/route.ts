// scholar-viz-ui-design/app/api/ask/route.ts
import { NextRequest } from "next/server"

type ChatTurn = { role: "user" | "assistant"; content: string }

function sseEncode(event: string, data: unknown): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data)
  // IMPORTANT: \n\n frame separator
  return `event: ${event}\ndata: ${payload}\n\n`
}

function chunkText(s: string, size = 140): string[] {
  if (!s) return [""]
  const out: string[] = []
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size))
  return out
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { message, chat_history, strict_mode, user_id, optional_artifacts, ui_topic } = body || {}

  const BACKEND_URL = process.env.SCHOLARVIZ_BACKEND_URL || "http://localhost:8000/api/ask"

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, payload)))
      }

      try {
        send("ready", { ok: true, backend: BACKEND_URL })

        // Call your FastAPI backend (non-streaming JSON)
        const resp = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            chat_history: (chat_history ?? []) as ChatTurn[],
            strict_mode: !!strict_mode,
            user_id: user_id ?? "u1",
            optional_artifacts: optional_artifacts ?? null,
            ui_topic: ui_topic ?? "phishing",
          }),
        })

        if (!resp.ok) {
          const txt = await resp.text().catch(() => "")
          throw new Error(`Backend error ${resp.status}: ${txt}`)
        }

        const data = await resp.json()

        // Send most of the payload first (diagram/lab/practice/etc)
        // then stream tutor.final_answer_text in chunks so UI definitely updates.
        const tutor = data?.tutor
        const tutorText: string = typeof tutor?.final_answer_text === "string" ? tutor.final_answer_text : ""

        // 1) chunk without tutor text (keeps UI panels updating quickly)
        const initial = { ...data }
        if (initial?.tutor?.final_answer_text) initial.tutor = { ...initial.tutor, final_answer_text: "" }
        send("chunk", initial)

        // 2) stream tutor text in pieces
        const pieces = chunkText(tutorText, 160)
        for (const p of pieces) {
          send("chunk", { tutor: { final_answer_text: p } })
        }

        // 3) finally send the full tutor object once (so steps are guaranteed present)
        if (tutor) {
          send("chunk", { tutor })
        }

        send("done", { done: true })
        controller.close()
      } catch (err: any) {
        send("error", { error: err?.message || "stream failed" })
        controller.close()
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
