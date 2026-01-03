"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { type ScholarVizResponse } from "@/components/chat-panel"

const PRACTICE_QUESTION = {
  question: "Which email header field is most commonly spoofed in phishing attacks?",
  options: ["Received", "From", "Date", "X-Mailer"],
  correctAnswer: 1,
  explanation:
    'The "From" header is the most commonly spoofed field because it\'s what recipients see in their inbox. Attackers can easily manipulate this field to impersonate trusted senders, while the "Received" headers are added by mail servers and are harder to forge.',
  evidence: ["email_headers.txt: Line 4", "MITRE ATT&CK T1566.002"],
}

type PracticeProp =
  | {
      question: string
      choices: string[]
      correct_index: number
      evidence_ids: string[]
      explanation: string
    }
  | undefined

export function PracticePanel({ response }: { response?: ScholarVizResponse | null }) {
  const practice = response?.practice

  const effective = useMemo(() => {
    if (practice?.question) {
      return {
        question: practice.question,
        options: [], // New contract doesn’t provide choices; render as open text
        correctAnswer: 0,
        explanation: practice.answer || "",
        evidence: [], // Not provided in new contract
      }
    }
    return PRACTICE_QUESTION
  }, [practice])

  const [showAnswer, setShowAnswer] = useState(false)

  // If we have a new-style practice (no choices), render open answer UI
  if (practice?.question && !effective.options.length) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-4">{practice.question}</h3>
          {practice.hint && (
            <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/30 rounded">
              <strong>Hint:</strong> {practice.hint}
            </div>
          )}
        </div>

        <Button onClick={() => setShowAnswer(!showAnswer)} className="w-full">
          {showAnswer ? "Hide Answer" : "Reveal Answer"}
        </Button>

        {showAnswer && practice.answer && (
          <Card className="p-4 space-y-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium mb-1">Answer</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{practice.answer}</p>
            </div>
          </Card>
        )}
      </div>
    )
  }

  // Fallback to old multiple-choice UI if we have choices
  const [selectedOption, setSelectedOption] = useState<number | null>(null)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="font-semibold text-lg mb-4">{effective.question}</h3>

        <div className="space-y-2">
          {effective.options.map((option, idx) => (
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
              {selectedOption === effective.correctAnswer ? "✓ Correct!" : "✗ Incorrect"}
            </p>
            <p className="text-sm text-muted-foreground">
              The correct answer is <strong>{effective.options[effective.correctAnswer]}</strong>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Explanation</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{effective.explanation}</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Evidence Links</p>
            <div className="space-y-1">
              {effective.evidence.map((link: string, idx: number) => (
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
