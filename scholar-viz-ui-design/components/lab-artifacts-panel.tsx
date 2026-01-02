"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

const MOCK_ARTIFACTS = {
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

export function LabArtifactsPanel() {
  const [selectedArtifact, setSelectedArtifact] = useState<keyof typeof MOCK_ARTIFACTS>("email_headers.txt")
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})

  return (
    <div className="p-4 grid grid-cols-2 gap-4 h-full">
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Case File</label>
          <Select value={selectedArtifact} onValueChange={(v) => setSelectedArtifact(v as keyof typeof MOCK_ARTIFACTS)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email_headers.txt">email_headers.txt</SelectItem>
              <SelectItem value="network_log.txt">network_log.txt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-lg p-3 bg-muted/30 h-[180px] overflow-auto">
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
            {MOCK_ARTIFACTS[selectedArtifact]}
          </pre>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Next Steps</h3>
        <div className="space-y-3">
          {NEXT_STEPS.map((step, idx) => (
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
