"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X } from "lucide-react"

const MOCK_NODES = [
  { id: 1, x: 150, y: 100, label: "Attacker", type: "threat" },
  { id: 2, x: 350, y: 100, label: "Email Server", type: "system" },
  { id: 3, x: 350, y: 250, label: "Victim", type: "user" },
  { id: 4, x: 550, y: 250, label: "Credentials", type: "data" },
]

export function DiagramCanvas() {
  const [selectedNode, setSelectedNode] = useState<number | null>(null)

  const node = MOCK_NODES.find((n) => n.id === selectedNode)

  return (
    <div className="flex-1 relative bg-background">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-full h-full">
          {/* Connections */}
          <line x1="190" y1="100" x2="310" y2="100" stroke="currentColor" strokeWidth="2" className="text-border" />
          <line x1="350" y1="140" x2="350" y2="210" stroke="currentColor" strokeWidth="2" className="text-border" />
          <line x1="390" y1="250" x2="510" y2="250" stroke="currentColor" strokeWidth="2" className="text-border" />

          {/* Nodes */}
          {MOCK_NODES.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="35"
                fill="currentColor"
                className={`cursor-pointer transition-colors ${
                  node.type === "threat"
                    ? "text-destructive/20 hover:text-destructive/30"
                    : node.type === "system"
                      ? "text-primary/20 hover:text-primary/30"
                      : node.type === "user"
                        ? "text-chart-2/20 hover:text-chart-2/30"
                        : "text-chart-4/20 hover:text-chart-4/30"
                }`}
                onClick={() => setSelectedNode(node.id)}
              />
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                className="text-xs font-medium pointer-events-none fill-current"
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Node Details Drawer */}
      {selectedNode && (
        <Card className="absolute right-4 top-4 bottom-4 w-[350px] p-4 shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold">{node?.label}</h3>
              <p className="text-xs text-muted-foreground capitalize">{node?.type}</p>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <ScrollArea className="h-[calc(100%-60px)]">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Definition</h4>
                <p className="text-muted-foreground leading-relaxed">
                  {node?.type === "threat"
                    ? "An external malicious actor attempting to compromise the system through social engineering."
                    : node?.type === "system"
                      ? "The email infrastructure responsible for routing and delivering messages."
                      : node?.type === "user"
                        ? "The target individual who receives and potentially interacts with malicious content."
                        : "Sensitive authentication information that grants access to protected resources."}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Citations</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="text-xs">• NIST SP 800-61 Rev. 2, Section 3.2.1</li>
                  <li className="text-xs">• MITRE ATT&CK T1566 (Phishing)</li>
                  <li className="text-xs">• RFC 5321 (SMTP Protocol)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Lab Evidence</h4>
                <div className="space-y-2">
                  <div className="text-xs bg-muted p-2 rounded">
                    <span className="text-muted-foreground">email_headers.txt:</span> Line 15
                  </div>
                  <div className="text-xs bg-muted p-2 rounded">
                    <span className="text-muted-foreground">network_log.pcap:</span> Packet 234
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  )
}
