"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"

const SUGGESTED_QUESTIONS = [
  "What is spear phishing?",
  "How do attackers move laterally?",
  "Explain pass-the-hash attacks",
  "What are common email indicators?",
]

const MOCK_MESSAGES = [
  {
    role: "assistant",
    content: "Hello! I'm your cybersecurity tutor. Ask me anything about phishing attacks or explore the diagram.",
  },
  {
    role: "user",
    content: "What is spear phishing?",
  },
  {
    role: "assistant",
    content:
      "Spear phishing is a targeted email attack where attackers craft personalized messages to specific individuals or organizations. Unlike mass phishing campaigns, spear phishing uses research about the victim to appear legitimate and trustworthy.",
  },
]

export function ChatPanel() {
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    setMessages([...messages, { role: "user", content: input }])
    setInput("")
  }

  return (
    <div className="w-[350px] border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Chat</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`text-sm ${
                message.role === "user" ? "ml-8 bg-primary/10 p-3 rounded-lg" : "mr-8 bg-muted/50 p-3 rounded-lg"
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex gap-2 flex-wrap">
          {SUGGESTED_QUESTIONS.map((question, idx) => (
            <button
              key={idx}
              onClick={() => setInput(question)}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question..."
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
