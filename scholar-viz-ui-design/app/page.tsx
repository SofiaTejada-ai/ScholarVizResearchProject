// scholar-viz-ui-design/app/page.tsx
"use client"

import { useState } from "react"
import { ChatPanel, type ScholarVizResponse } from "@/components/chat-panel"
import { DiagramCanvas } from "@/components/diagram-canvas"
import { LabArtifactsPanel } from "@/components/lab-artifacts-panel"
import { PracticePanel } from "@/components/practice-panel"
import { ScrollArea } from "@/components/ui/scroll-area"

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
          <DiagramCanvas response={lastResponse} />

          {/* Show full explanation in a sidebar when we have a response */}
          {lastResponse && (
            <div className="absolute top-4 right-4 bottom-4 w-[420px] bg-background/95 border border-border rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold mb-1">{lastResponse.title || "Explanation"}</h2>
                <div className="text-sm text-muted-foreground">
                  {lastResponse.summary ? (
                    <>
                      {lastResponse.summary.split('. ').slice(0, 2).join('. ')}
                      {lastResponse.summary.split('. ').length > 2 && '.'}
                    </>
                  ) : (
                    "View explanation and diagram."
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Steps</h3>
                    <div className="space-y-1 text-sm">
                      {(lastResponse.steps || []).map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-primary font-medium">{i + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Sources</h3>
                    <div className="space-y-2 text-sm">
                      {(lastResponse.sources || []).map((src, i) => (
                        <div key={i} className="border border-border rounded p-2">
                          <div className="font-medium">{src.title}</div>
                          {src.section && <div className="text-xs text-muted-foreground">{src.section}</div>}
                          <div className="text-xs text-muted-foreground mt-1">{src.snippet}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
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
          {activeTab === "lab" ? <LabArtifactsPanel response={lastResponse} /> : <PracticePanel response={lastResponse} />}
        </div>
      </div>
    </div>
  )
}
