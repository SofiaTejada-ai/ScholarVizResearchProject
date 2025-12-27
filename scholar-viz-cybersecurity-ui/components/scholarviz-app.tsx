"use client"

import { useState } from "react"
import { ChatSidebar } from "@/components/chat-sidebar"
import { DiagramPanel } from "@/components/diagram-panel"
import { BottomPanel } from "@/components/bottom-panel"
import { TopicChips } from "@/components/topic-chips"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Shield, BookOpen } from "lucide-react"

export function ScholarVizApp() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>("phishing")
  const [strictMode, setStrictMode] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">ScholarViz</h1>
            <p className="text-xs text-muted-foreground">Cybersecurity Tutor</p>
          </div>
        </div>

        {/* Topic Chips */}
        <TopicChips selectedTopic={selectedTopic} onSelectTopic={setSelectedTopic} />

        {/* Strict Evidence Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="strict-mode" className="text-sm text-muted-foreground">
              Strict Evidence Mode
            </Label>
            <Switch id="strict-mode" checked={strictMode} onCheckedChange={setStrictMode} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Chat */}
        <ChatSidebar selectedTopic={selectedTopic} strictMode={strictMode} />

        {/* Right Panel - Diagram Area */}
        <DiagramPanel selectedTopic={selectedTopic} />
      </div>

      {/* Bottom Panel - Lab Artifacts + Practice Questions */}
      <BottomPanel selectedTopic={selectedTopic} />
    </div>
  )
}
