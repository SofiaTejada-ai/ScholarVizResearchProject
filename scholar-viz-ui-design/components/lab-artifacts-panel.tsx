"use client"

import { useMemo, useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { type ScholarVizResponse } from "@/components/chat-panel"

const MOCK_ARTIFACTS: Record<string, string> = {
  "email_headers.txt": `Received: from mail.attacker.com (203.0.113.42)
    by mx.victim.com (10.0.0.5)
    Date: Mon, 15 Jan 2024 14:32:18 +0000
    From: ceo@legitcompany.com <spoofed@attacker.com>
    To: john.doe@victim.com
    Subject: Urgent: Wire Transfer Required
    X-Mailer: PHPMailer 5.2.1`,
  "network_log.txt": `[2024-01-15 14:33:01] TCP SYN 203.0.113.42:443 -> 10.0.0.15:52341
[2024-01-15 14:33:02] TLS Handshake initiated
[2024-01-15 14:33:05] HTTP POST /login.php
[2024-01-15 14:33:06] Response: 302 Redirect to dashboard`,
}

const NEXT_STEPS = [
  "Identify the spoofed sender address",
  "Analyze the email headers for originating IP",
  "Check DNS records for domain authenticity",
  "Examine TLS certificate details",
]

type LabProp =
  | {
      case_id: string
      artifacts: Array<{ artifact_id?: string; id?: string; text?: string }>
      highlights: any[]
    }
  | undefined

type TutorProp =
  | {
      final_answer_text: string
      steps: Array<{ step: string; evidence: string[] }>
    }
  | undefined

export function LabArtifactsPanel({ response }: { response?: ScholarVizResponse | null }) {
  const lab = response?.lab
  const steps = response?.steps || []

  const backendArtifacts: Record<string, string> | null = useMemo(() => {
    if (!lab?.enabled || !lab.artifact_text) return null
    return { [lab.case_file]: lab.artifact_text }
  }, [lab])

  const artifactMap: Record<string, string> = backendArtifacts ?? MOCK_ARTIFACTS
  const artifactKeys = Object.keys(artifactMap)

  const [selectedArtifact, setSelectedArtifact] = useState<string>(artifactKeys[0] || "email_headers.txt")
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})

  // If backend artifacts appear after first render, snap selectedArtifact to the first valid key
  useEffect(() => {
    if (!artifactKeys.length) return
    if (!artifactMap[selectedArtifact]) {
      setSelectedArtifact(artifactKeys[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactKeys.join("|")])

  const stepsToShow = steps.length ? steps : NEXT_STEPS

  // Render highlights if available
  const renderHighlightedArtifact = () => {
    const text = artifactMap[selectedArtifact] || ""
    const highlights = lab?.highlights || []
    if (!highlights.length) return <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap">{text}</pre>

    const lines = text.split('\n')
    return (
      <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
        {lines.map((line, i) => {
          const lineNum = i + 1
          const highlight = highlights.find((h: any) => h.start_line <= lineNum && h.end_line >= lineNum)
          return (
            <div key={i} className={highlight ? "bg-yellow-200/40 px-1 rounded" : ""}>
              {line}
              {highlight && <span className="ml-2 text-xs text-muted-foreground">[{highlight.label}]</span>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-4 grid grid-cols-2 gap-4 h-full">
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Case File</label>
          <Select value={selectedArtifact} onValueChange={(v) => setSelectedArtifact(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {artifactKeys.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-lg p-3 bg-muted/30 h-[180px] overflow-auto">
          {renderHighlightedArtifact()}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Next Steps</h3>
        <div className="space-y-3">
          {stepsToShow.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Checkbox
                id={`step-${idx}`}
                checked={checkedSteps[idx] || false}
                onCheckedChange={(checked) => setCheckedSteps({ ...checkedSteps, [idx]: checked as boolean })}
              />
              <label htmlFor={`step-${idx}`} className="text-sm leading-relaxed cursor-pointer">
                {step}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
