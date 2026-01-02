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

export default function ScholarVizPage() {
  const [strictEvidence, setStrictEvidence] = useState(false)
  const [activeTab, setActiveTab] = useState<"lab" | "practice">("lab")

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <span className="text-lg font-semibold">ScholarViz</span>
        </div>

        <div className="flex items-center gap-4">
          <Select defaultValue="phishing">
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phishing">Phishing</SelectItem>
              <SelectItem value="lateral-movement">Lateral Movement</SelectItem>
              <SelectItem value="privilege-escalation">Privilege Escalation</SelectItem>
              <SelectItem value="data-exfiltration">Data Exfiltration</SelectItem>
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
        <ChatPanel />

        {/* Right: Diagram Panel */}
        <DiagramCanvas />
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

        <div className="flex-1 overflow-auto">{activeTab === "lab" ? <LabArtifactsPanel /> : <PracticePanel />}</div>
      </div>
    </div>
  )
}
