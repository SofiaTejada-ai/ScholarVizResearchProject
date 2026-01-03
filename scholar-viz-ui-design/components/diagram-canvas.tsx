"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X } from "lucide-react"

const MOCK_NODES = [
  { id: "mock_1", x: 150, y: 100, label: "Attacker", type: "threat" },
  { id: "mock_2", x: 350, y: 100, label: "Email Server", type: "system" },
  { id: "mock_3", x: 350, y: 250, label: "Victim", type: "user" },
  { id: "mock_4", x: 550, y: 250, label: "Credentials", type: "data" },
]

type DiagramProp = { nodes: any[]; edges: any[] } | undefined

function typeToColorClass(t: string) {
  if (t === "threat") return "text-destructive/20 hover:text-destructive/30"
  if (t === "system") return "text-primary/20 hover:text-primary/30"
  if (t === "user") return "text-chart-2/20 hover:text-chart-2/30"
  return "text-chart-4/20 hover:text-chart-4/30"
}

function coerceNodeType(n: any): "threat" | "system" | "user" | "data" {
  const id = String(n?.id ?? "").toLowerCase()
  const label = String(n?.label ?? "").toLowerCase()

  if (id.includes("phish") || label.includes("phish")) return "threat"
  if (id.includes("smb") || label.includes("smb")) return "system"
  if (id.includes("credential") || label.includes("credential")) return "data"
  return "user"
}

export function DiagramCanvas({ diagram }: { diagram?: DiagramProp }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  // Build layout for backend nodes (since backend doesn’t provide x/y)
  const laidOut = useMemo(() => {
    if (!diagram?.nodes?.length) return null

    const nodes = diagram.nodes.map((n: any, idx: number) => {
      const col = idx % 3
      const row = Math.floor(idx / 3)
      return {
        id: String(n.id),
        label: n.label ?? String(n.id),
        type: coerceNodeType(n),
        x: 170 + col * 220,
        y: 110 + row * 150,
        raw: n,
      }
    })

    const pos = new Map(nodes.map((n) => [n.id, n]))

    const edges = (diagram.edges || [])
      .map((e: any) => {
        const s = pos.get(String(e.source))
        const t = pos.get(String(e.target))
        if (!s || !t) return null
        return {
          id: `${String(e.source)}__${String(e.target)}`,
          x1: s.x + 35,
          y1: s.y,
          x2: t.x - 35,
          y2: t.y,
          label: e.label || e.relation || "",
        }
      })
      .filter(Boolean) as any[]

    return { nodes, edges }
  }, [diagram])

  const nodesToRender = laidOut?.nodes?.length ? laidOut.nodes : MOCK_NODES
  const edgesToRender = laidOut?.edges?.length
    ? laidOut.edges
    : [
        { id: "m1", x1: 190, y1: 100, x2: 310, y2: 100, label: "" },
        { id: "m2", x1: 350, y1: 140, x2: 350, y2: 210, label: "" },
        { id: "m3", x1: 390, y1: 250, x2: 510, y2: 250, label: "" },
      ]

  const node = nodesToRender.find((n: any) => String(n.id) === String(selectedNode))

  return (
    <div className="flex-1 relative bg-background">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-full h-full">
          {/* Connections */}
          {edgesToRender.map((e: any) => (
            <line
              key={e.id}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-border"
            />
          ))}

          {/* Nodes */}
          {nodesToRender.map((node: any) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="35"
                fill="currentColor"
                className={`cursor-pointer transition-colors ${typeToColorClass(node.type)}`}
                onClick={() => setSelectedNode(String(node.id))}
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
                  {/* Keep your existing behavior, but if backend provided description, show it */}
                  {(node as any)?.raw?.description
                    ? String((node as any).raw.description)
                    : node?.type === "threat"
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
                  {/* keep your static citations list (no making stuff up from backend) */}
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
