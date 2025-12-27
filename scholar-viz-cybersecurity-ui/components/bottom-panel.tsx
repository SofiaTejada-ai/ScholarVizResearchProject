"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FlaskConical, HelpCircle, CheckCircle2, XCircle, Terminal, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"

interface BottomPanelProps {
  selectedTopic: string | null
}

const labArtifacts = {
  phishing: [
    { id: 1, name: "suspicious_email.eml", type: "Email", status: "flagged" },
    { id: 2, name: "fake_login_page.html", type: "HTML", status: "analyzed" },
    { id: 3, name: "url_analysis.json", type: "Report", status: "complete" },
  ],
  "lateral-movement": [
    { id: 1, name: "network_logs.pcap", type: "Capture", status: "flagged" },
    { id: 2, name: "credential_dump.txt", type: "Evidence", status: "analyzed" },
  ],
  malware: [
    { id: 1, name: "sample.exe", type: "Binary", status: "flagged" },
    { id: 2, name: "sandbox_report.pdf", type: "Report", status: "complete" },
  ],
  encryption: [
    { id: 1, name: "encrypted_file.enc", type: "Encrypted", status: "analyzed" },
    { id: 2, name: "key_exchange.log", type: "Log", status: "complete" },
  ],
  network: [
    { id: 1, name: "firewall_rules.conf", type: "Config", status: "analyzed" },
    { id: 2, name: "intrusion_alerts.log", type: "Log", status: "flagged" },
  ],
}

const practiceQuestions = {
  phishing: [
    {
      id: 1,
      question: "What should you check first when receiving an unexpected email?",
      answer: "sender",
      revealed: false,
    },
    {
      id: 2,
      question: "True or False: Hovering over a link shows its true destination",
      answer: "true",
      revealed: false,
    },
    {
      id: 3,
      question: "What type of attack uses fake websites to steal credentials?",
      answer: "phishing",
      revealed: false,
    },
  ],
  "lateral-movement": [
    { id: 1, question: "What does an attacker need to move laterally?", answer: "credentials", revealed: false },
    { id: 2, question: "Name one tool used for lateral movement", answer: "psexec", revealed: false },
  ],
  malware: [
    { id: 1, question: "What is malware designed to do?", answer: "harm", revealed: false },
    { id: 2, question: "Name one type of malware that encrypts files", answer: "ransomware", revealed: false },
  ],
  encryption: [
    { id: 1, question: "What type of encryption uses one key?", answer: "symmetric", revealed: false },
    { id: 2, question: "What does HTTPS stand for?", answer: "secure", revealed: false },
  ],
  network: [
    { id: 1, question: "What device filters network traffic?", answer: "firewall", revealed: false },
    { id: 2, question: "What does VPN stand for?", answer: "virtual private network", revealed: false },
  ],
}

export function BottomPanel({ selectedTopic }: BottomPanelProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<Record<number, string>>({})
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({})

  const artifacts = selectedTopic ? labArtifacts[selectedTopic as keyof typeof labArtifacts] || [] : []
  const questions = selectedTopic ? practiceQuestions[selectedTopic as keyof typeof practiceQuestions] || [] : []

  const checkAnswer = (questionId: number, correctAnswer: string) => {
    const userAnswer = selectedAnswer[questionId]?.toLowerCase().trim()
    return userAnswer === correctAnswer.toLowerCase()
  }

  return (
    <div className="h-56 border-t border-border bg-card">
      <Tabs defaultValue="artifacts" className="h-full">
        <div className="flex items-center justify-between border-b border-border px-4">
          <TabsList className="h-10 bg-transparent">
            <TabsTrigger value="artifacts" className="gap-2 data-[state=active]:bg-secondary">
              <FlaskConical className="h-4 w-4" />
              Lab Artifacts
            </TabsTrigger>
            <TabsTrigger value="practice" className="gap-2 data-[state=active]:bg-secondary">
              <HelpCircle className="h-4 w-4" />
              Practice Questions
            </TabsTrigger>
          </TabsList>
          {selectedTopic && (
            <Badge variant="secondary" className="text-xs">
              Topic: {selectedTopic.replace("-", " ")}
            </Badge>
          )}
        </div>

        <TabsContent value="artifacts" className="h-[calc(100%-2.5rem)] m-0 overflow-auto p-4">
          {artifacts.length > 0 ? (
            <div className="flex gap-4">
              {artifacts.map((artifact) => (
                <Card
                  key={artifact.id}
                  className="w-48 shrink-0 cursor-pointer transition-colors hover:bg-secondary/50"
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {artifact.type === "Email" && <FileCode className="h-5 w-5 text-chart-2" />}
                      {artifact.type === "HTML" && <Terminal className="h-5 w-5 text-chart-3" />}
                      {artifact.type === "Report" && <FileCode className="h-5 w-5 text-primary" />}
                      {artifact.type === "Capture" && <Terminal className="h-5 w-5 text-chart-2" />}
                      {artifact.type === "Evidence" && <FileCode className="h-5 w-5 text-destructive" />}
                      {artifact.type === "Binary" && <Terminal className="h-5 w-5 text-destructive" />}
                      {artifact.type === "Encrypted" && <FileCode className="h-5 w-5 text-chart-3" />}
                      {artifact.type === "Log" && <Terminal className="h-5 w-5 text-muted-foreground" />}
                      {artifact.type === "Config" && <FileCode className="h-5 w-5 text-chart-2" />}
                      <Badge
                        variant={artifact.status === "flagged" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {artifact.status}
                      </Badge>
                    </div>
                    <p className="truncate text-sm font-medium text-card-foreground">{artifact.name}</p>
                    <p className="text-xs text-muted-foreground">{artifact.type}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a topic to view lab artifacts
            </div>
          )}
        </TabsContent>

        <TabsContent value="practice" className="h-[calc(100%-2.5rem)] m-0 overflow-auto p-4">
          {questions.length > 0 ? (
            <div className="flex gap-4">
              {questions.map((q) => (
                <Card key={q.id} className="w-72 shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-card-foreground">Question {q.id}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-card-foreground">{q.question}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Your answer..."
                        value={selectedAnswer[q.id] || ""}
                        onChange={(e) => setSelectedAnswer({ ...selectedAnswer, [q.id]: e.target.value })}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRevealedAnswers({ ...revealedAnswers, [q.id]: true })}
                      >
                        Check
                      </Button>
                    </div>
                    {revealedAnswers[q.id] && (
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                          checkAnswer(q.id, q.answer)
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {checkAnswer(q.id, q.answer) ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Correct!
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Answer: {q.answer}
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a topic to view practice questions
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
