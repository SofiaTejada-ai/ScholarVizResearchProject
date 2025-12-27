"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Plus, MessageSquare, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const chatHistory = [
  { id: 1, title: "Phishing attack basics", date: "Today" },
  { id: 2, title: "SQL injection explained", date: "Yesterday" },
  { id: 3, title: "Firewall configuration", date: "Dec 25" },
]

const sampleQuestions = [
  "What is phishing and how do I recognize it?",
  "Explain lateral movement in simple terms",
  "What's the difference between a virus and malware?",
  "How does encryption protect my data?",
]

interface ChatSidebarProps {
  selectedTopic: string | null
  strictMode: boolean
}

interface Message {
  id: number
  role: "user" | "assistant"
  content: string
}

export function ChatSidebar({ selectedTopic, strictMode }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hi! I'm your cybersecurity tutor. What would you like to learn about today? You can click on a topic chip above or ask me anything!",
    },
  ])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    const newMessage: Message = {
      id: messages.length + 1,
      role: "user",
      content: input,
    }
    setMessages([...messages, newMessage])
    setInput("")
    // Simulate assistant response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: "assistant",
          content: strictMode
            ? "Based on verified sources, here's what I found..."
            : "Great question! Let me explain that for you...",
        },
      ])
    }, 1000)
  }

  return (
    <div className="flex w-80 flex-col border-r border-border bg-sidebar">
      {/* Chat History */}
      <div className="border-b border-sidebar-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-sidebar-foreground">History</span>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {chatHistory.map((chat) => (
            <button
              key={chat.id}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{chat.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sample Questions for Beginners */}
      <div className="border-b border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-sidebar-foreground">Sample Questions</span>
        </div>
        <div className="space-y-2">
          {sampleQuestions.map((question, idx) => (
            <button
              key={idx}
              onClick={() => setInput(question)}
              className="w-full rounded-lg bg-sidebar-accent/50 px-3 py-2 text-left text-xs text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                message.role === "user"
                  ? "ml-4 bg-primary text-primary-foreground"
                  : "mr-4 bg-secondary text-secondary-foreground",
              )}
            >
              {message.content}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-muted-foreground"
          />
          <Button size="icon" onClick={handleSend} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
