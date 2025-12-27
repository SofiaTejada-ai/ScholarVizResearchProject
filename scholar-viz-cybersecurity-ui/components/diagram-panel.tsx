"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Mail, Globe, Server, AlertTriangle, ArrowRight, Monitor, Database, Shield } from "lucide-react"

interface DiagramPanelProps {
  selectedTopic: string | null
}

export function DiagramPanel({ selectedTopic }: DiagramPanelProps) {
  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {selectedTopic === "phishing" && "Phishing Attack Flow"}
            {selectedTopic === "lateral-movement" && "Lateral Movement Diagram"}
            {selectedTopic === "malware" && "Malware Infection Chain"}
            {selectedTopic === "encryption" && "Encryption Process"}
            {selectedTopic === "network" && "Network Security Layers"}
            {!selectedTopic && "Select a Topic"}
          </h2>
          <p className="text-sm text-muted-foreground">Interactive visualization of the attack or concept</p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          Interactive
        </Badge>
      </div>

      {selectedTopic === "phishing" && <PhishingDiagram />}
      {selectedTopic === "lateral-movement" && <LateralMovementDiagram />}
      {selectedTopic === "malware" && <MalwareDiagram />}
      {selectedTopic === "encryption" && <EncryptionDiagram />}
      {selectedTopic === "network" && <NetworkDiagram />}
      {!selectedTopic && (
        <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">Select a topic to view its diagram</p>
        </div>
      )}
    </div>
  )
}

function PhishingDiagram() {
  return (
    <div className="relative flex items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
      {/* Attacker */}
      <DiagramNode
        icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
        label="Attacker"
        sublabel="Crafts fake email"
        variant="danger"
      />

      <ArrowRight className="h-8 w-8 text-muted-foreground" />

      {/* Phishing Email */}
      <DiagramNode
        icon={<Mail className="h-6 w-6 text-chart-3" />}
        label="Phishing Email"
        sublabel="Looks legitimate"
        variant="warning"
      />

      <ArrowRight className="h-8 w-8 text-muted-foreground" />

      {/* Target User */}
      <DiagramNode
        icon={<User className="h-6 w-6 text-chart-2" />}
        label="Target User"
        sublabel="Receives email"
        variant="info"
      />

      <ArrowRight className="h-8 w-8 text-muted-foreground" />

      {/* Fake Website */}
      <DiagramNode
        icon={<Globe className="h-6 w-6 text-destructive" />}
        label="Fake Website"
        sublabel="Steals credentials"
        variant="danger"
      />
    </div>
  )
}

function LateralMovementDiagram() {
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <div className="grid grid-cols-4 gap-6">
        <DiagramNode
          icon={<Monitor className="h-6 w-6 text-destructive" />}
          label="Compromised PC"
          sublabel="Initial access"
          variant="danger"
        />
        <DiagramNode
          icon={<Server className="h-6 w-6 text-chart-3" />}
          label="File Server"
          sublabel="Credential harvesting"
          variant="warning"
        />
        <DiagramNode
          icon={<Database className="h-6 w-6 text-chart-3" />}
          label="Database"
          sublabel="Data exfiltration"
          variant="warning"
        />
        <DiagramNode
          icon={<Server className="h-6 w-6 text-chart-2" />}
          label="Domain Controller"
          sublabel="Full control"
          variant="info"
        />
      </div>
      <div className="mt-4 flex justify-between px-8">
        <ArrowRight className="h-6 w-6 text-muted-foreground" />
        <ArrowRight className="h-6 w-6 text-muted-foreground" />
        <ArrowRight className="h-6 w-6 text-muted-foreground" />
      </div>
    </div>
  )
}

function MalwareDiagram() {
  return (
    <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
      <DiagramNode
        icon={<Mail className="h-6 w-6 text-muted-foreground" />}
        label="Email Attachment"
        sublabel="Delivery vector"
        variant="default"
      />
      <ArrowRight className="h-8 w-8 text-muted-foreground" />
      <DiagramNode
        icon={<AlertTriangle className="h-6 w-6 text-chart-3" />}
        label="Execution"
        sublabel="User opens file"
        variant="warning"
      />
      <ArrowRight className="h-8 w-8 text-muted-foreground" />
      <DiagramNode
        icon={<Monitor className="h-6 w-6 text-destructive" />}
        label="Infection"
        sublabel="System compromised"
        variant="danger"
      />
    </div>
  )
}

function EncryptionDiagram() {
  return (
    <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
      <DiagramNode
        icon={<Mail className="h-6 w-6 text-chart-2" />}
        label="Plaintext"
        sublabel="Original message"
        variant="info"
      />
      <ArrowRight className="h-8 w-8 text-muted-foreground" />
      <DiagramNode
        icon={<Shield className="h-6 w-6 text-primary" />}
        label="Encryption"
        sublabel="Key applied"
        variant="primary"
      />
      <ArrowRight className="h-8 w-8 text-muted-foreground" />
      <DiagramNode
        icon={<Database className="h-6 w-6 text-chart-3" />}
        label="Ciphertext"
        sublabel="Secured data"
        variant="warning"
      />
    </div>
  )
}

function NetworkDiagram() {
  return (
    <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
      <DiagramNode
        icon={<Globe className="h-6 w-6 text-muted-foreground" />}
        label="Internet"
        sublabel="External network"
        variant="default"
      />
      <ArrowRight className="h-8 w-8 text-muted-foreground" />
      <DiagramNode
        icon={<Shield className="h-6 w-6 text-primary" />}
        label="Firewall"
        sublabel="Filters traffic"
        variant="primary"
      />
      <ArrowRight className="h-8 w-8 text-muted-foreground" />
      <DiagramNode
        icon={<Server className="h-6 w-6 text-chart-2" />}
        label="Internal Network"
        sublabel="Protected zone"
        variant="info"
      />
    </div>
  )
}

function DiagramNode({
  icon,
  label,
  sublabel,
  variant = "default",
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  variant?: "default" | "danger" | "warning" | "info" | "primary"
}) {
  const variantStyles = {
    default: "border-border bg-secondary",
    danger: "border-destructive/50 bg-destructive/10",
    warning: "border-chart-3/50 bg-chart-3/10",
    info: "border-chart-2/50 bg-chart-2/10",
    primary: "border-primary/50 bg-primary/10",
  }

  return (
    <Card
      className={`flex flex-col items-center gap-2 p-4 transition-transform hover:scale-105 ${variantStyles[variant]}`}
    >
      <div className="rounded-full bg-background p-3">{icon}</div>
      <span className="text-sm font-medium text-card-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{sublabel}</span>
    </Card>
  )
}
