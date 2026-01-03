// scholar-viz-ui-design/app/page.tsx
"use client"

import { useState } from "react"
import { ChatPanel, type ScholarVizResponse } from "@/components/chat-panel"
import { DiagramCanvas } from "@/components/diagram-canvas"
import { LabArtifactsPanel } from "@/components/lab-artifacts-panel"
import { PracticePanel } from "@/components/practice-panel"

type ChatTurn = { role: "user" | "assistant"; content: string }

export default function Page() {
  const [strictEvidence, setStrictEvidence] = useState(false)
  const [topic, setTopic] = useState("phishing")
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([])
  const [lastResponse, setLastResponse] = useState<ScholarVizResponse | null>(null)

  const [activeTab, setActiveTab] = useState<"lab" | "practice">("lab")

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="font-semibold">ScholarViz</div>
          <div className="text-xs text-muted-foreground">Cybersecurity Tutor</div>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-muted-foreground">Topic</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-background text-foreground text-sm"
          >
            <option value="phishing">Phishing</option>
            <option value="lateral-movement">Lateral Movement</option>
            <option value="privilege-escalation">Privilege Escalation</option>
            <option value="data-exfiltration">Data Exfiltration</option>
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={strictEvidence}
              onChange={(e) => setStrictEvidence(e.target.checked)}
            />
            Strict Evidence
          </label>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel
          strictEvidence={strictEvidence}
          topic={topic}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          setLastResponse={setLastResponse}
        />

        <div className="flex-1 relative overflow-hidden">
          <DiagramCanvas />

          {/* lightweight debug panel (optional but super useful while wiring) */}
          {lastResponse?.tutor?.final_answer_text && (
            <div className="absolute right-4 bottom-4 w-[420px] max-h-[240px] overflow-auto border border-border rounded-lg bg-background/90 p-3 text-xs">
              <div className="font-semibold mb-1">Latest tutor answer (debug)</div>
              <div className="whitespace-pre-wrap">{lastResponse.tutor.final_answer_text}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom tabs */}
      <div className="border-t border-border h-[300px] flex flex-col">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("lab")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "lab"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lab Artifacts
          </button>
          <button
            onClick={() => setActiveTab("practice")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "practice"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Practice
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === "lab" ? <LabArtifactsPanel /> : <PracticePanel />}
        </div>
      </div>
    </div>
  )
}
