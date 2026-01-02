"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const PRACTICE_QUESTION = {
  question: "Which email header field is most commonly spoofed in phishing attacks?",
  options: ["Received", "From", "Date", "X-Mailer"],
  correctAnswer: 1,
  explanation:
    'The "From" header is the most commonly spoofed field because it\'s what recipients see in their inbox. Attackers can easily manipulate this field to impersonate trusted senders, while the "Received" headers are added by mail servers and are harder to forge.',
  evidence: ["email_headers.txt: Line 4", "MITRE ATT&CK T1566.002"],
}

export function PracticePanel() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="font-semibold text-lg mb-4">{PRACTICE_QUESTION.question}</h3>

        <div className="space-y-2">
          {PRACTICE_QUESTION.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedOption(idx)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedOption === idx ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              }`}
            >
              <span className="font-mono text-sm">{String.fromCharCode(65 + idx)}.</span> {option}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={() => setShowAnswer(true)} disabled={selectedOption === null || showAnswer} className="w-full">
        Reveal Answer
      </Button>

      {showAnswer && (
        <Card className="p-4 space-y-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium mb-1">
              {selectedOption === PRACTICE_QUESTION.correctAnswer ? "✓ Correct!" : "✗ Incorrect"}
            </p>
            <p className="text-sm text-muted-foreground">
              The correct answer is <strong>{PRACTICE_QUESTION.options[PRACTICE_QUESTION.correctAnswer]}</strong>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Explanation</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{PRACTICE_QUESTION.explanation}</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Evidence Links</p>
            <div className="space-y-1">
              {PRACTICE_QUESTION.evidence.map((link, idx) => (
                <div key={idx} className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                  {link}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
