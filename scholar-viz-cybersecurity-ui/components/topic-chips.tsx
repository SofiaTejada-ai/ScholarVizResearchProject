"use client"

import { cn } from "@/lib/utils"
import { Fish, ArrowRightLeft, Bug, Lock, Wifi } from "lucide-react"

const topics = [
  { id: "phishing", label: "Phishing", icon: Fish },
  { id: "lateral-movement", label: "Lateral Movement", icon: ArrowRightLeft },
  { id: "malware", label: "Malware", icon: Bug },
  { id: "encryption", label: "Encryption", icon: Lock },
  { id: "network", label: "Network Security", icon: Wifi },
]

interface TopicChipsProps {
  selectedTopic: string | null
  onSelectTopic: (topic: string) => void
}

export function TopicChips({ selectedTopic, onSelectTopic }: TopicChipsProps) {
  return (
    <div className="flex items-center gap-2">
      {topics.map((topic) => {
        const Icon = topic.icon
        return (
          <button
            key={topic.id}
            onClick={() => onSelectTopic(topic.id)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              selectedTopic === topic.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {topic.label}
          </button>
        )
      })}
    </div>
  )
}
