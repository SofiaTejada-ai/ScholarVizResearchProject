"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Upload, Shield } from "lucide-react"
import { DiagramCanvas } from "@/components/diagram-canvas"
import { ChatPanel } from "@/components/chat-panel"
import { LabArtifactsPanel } from "@/components/lab-artifacts-panel"
import { PracticePanel } from "@/components/practice-panel"

type ChatTurn = { role: "user" | "assistant"; content: string }

type ScholarVizResponse = {
  rewritten_question?: string
  topic_detected?: string
  retrieved_docs?: Array<{ id: string; title: string; quote: string }>
  selected_concepts?: string[]
  diagram?: { nodes: any[]; edges: any[] }
  lab?: { case_id: string; artifacts: any[]; highlights: any[] }
  tutor?: { final_answer_text: string; steps: Array<{ step: string; evidence: string[] }> }
  practice?: {
    question: string
    choices: string[]
    correct_index: number
    evidence_ids: string[]
    explanation: string
  }
  telemetry?: any
}

export default function ScholarVizPage() {
  const [strictEvidence, setStrictEvidence] = useState(false)
  const [activeTab, setActiveTab] = useState<"lab" | "practice">("lab")

  // Topic dropdown is UI-side. Backend still detects topic too.
  const [topic, setTopic] = useState("phishing")

  // Shared state that connects Chat -> Diagram/Lab/Practice
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([])
  const [lastResponse, setLastResponse] = useState<ScholarVizResponse | null>(null)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <span className="text-lg font-semibold">ScholarViz</span>
        </div>

        <div className="flex items-center gap-4">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phishing">Phishing</SelectItem>
              <SelectItem value="lateral_movement">Lateral Movement</SelectItem>
              <SelectItem value="privilege_escalation">Privilege Escalation</SelectItem>
              <SelectItem value="data_exfiltration">Data Exfiltration</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch id="strict-evidence" checked={strictEvidence} onCheckedChange={setStrictEvidence} />
            <Label htmlFor="strict-evidence" className="text-sm cursor-pointer">
              Strict Evidence
            </Label>
          </div>

          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload artifacts
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Panel */}
        <ChatPanel
          strictEvidence={strictEvidence}
          topic={topic}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          setLastResponse={setLastResponse}
        />

        {/* Right: Diagram Panel */}
        <DiagramCanvas diagram={lastResponse?.diagram} />
      </div>

      {/* Bottom: Lab + Practice Panel */}
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
          {activeTab === "lab" ? (
            <LabArtifactsPanel lab={lastResponse?.lab} tutor={lastResponse?.tutor} />
          ) : (
            <PracticePanel practice={lastResponse?.practice} />
          )}
        </div>
      </div>
    </div>
  )
}
