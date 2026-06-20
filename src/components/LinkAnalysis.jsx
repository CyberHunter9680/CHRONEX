import React, { useState, useRef, useEffect } from 'react';
import { 
  Share2, 
  RefreshCw, 
  Filter, 
  ShieldAlert, 
  Phone, 
  User, 
  Globe, 
  Mail, 
  CreditCard,
  Hash,
  Database
} from 'lucide-react';

const initialNodes = [
  { id: "case:CX-2026-0401", label: "CX-0401: Crypto Scam", type: "Case", x: 180, y: 150, risk: "Critical" },
  { id: "case:CX-2026-0402", label: "CX-0402: Job Fraud", type: "Case", x: 520, y: 150, risk: "High" },
  { id: "case:CX-2026-0403", label: "CX-0403: Loan App", type: "Case", x: 350, y: 350, risk: "Critical" },
  { id: "upi:securepay.mule@okaxis", label: "securepay.mule@okaxis", type: "UPI ID", x: 420, y: 250, risk: "Critical" },
  { id: "phone:+919123456789", label: "+91 91234 56789", type: "Mobile Number", x: 260, y: 250, risk: "Critical" },
  { id: "username:@taskmaster_vip", label: "@taskmaster_vip", type: "Username", x: 350, y: 80, risk: "Critical" },
  { id: "upi:vip.invest@oksbi", label: "vip.invest@oksbi", type: "UPI ID", x: 100, y: 100, risk: "High" },
  { id: "phone:+919898989898", label: "+91 98989 89898", type: "Mobile Number", x: 600, y: 100, risk: "High" },
  { id: "ip:104.244.42.1", label: "104.244.42.1", type: "IP Address", x: 240, y: 440, risk: "Medium" },
  { id: "account:918273645029", label: "A/C: 918273645029", type: "Bank Account", x: 460, y: 440, risk: "High" }
];

const initialLinks = [
  { source: "case:CX-2026-0401", target: "phone:+919123456789" },
  { source: "case:CX-2026-0403", target: "phone:+919123456789" }, // Bridges Crypto and Loan App!
  
  { source: "case:CX-2026-0402", target: "upi:securepay.mule@okaxis" },
  { source: "case:CX-2026-0403", target: "upi:securepay.mule@okaxis" }, // Bridges Job Scam and Loan App!
  
  { source: "case:CX-2026-0401", target: "username:@taskmaster_vip" },
  { source: "case:CX-2026-0402", target: "username:@taskmaster_vip" }, // Bridges Crypto and Job Scam!

  { source: "case:CX-2026-0401", target: "upi:vip.invest@oksbi" },
  { source: "case:CX-2026-0402", target: "phone:+919898989898" },
  { source: "case:CX-2026-0403", target: "ip:104.244.42.1" },
  { source: "case:CX-2026-0403", target: "account:918273645029" }
];

export default function LinkAnalysis({ cases = [], entities = [], evidence = [], alerts = [] }) {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  useEffect(() => {
    // 1. Build all case nodes
    const caseNodes = cases.map(c => ({
      id: `case:${c.id}`,
      label: `${c.id}: ${c.title || 'Untitled Case'}`,
      type: 'Case',
      risk: c.priority || 'Medium',
      casesLinked: [c.id]
    }));

    // 2. Build all entity nodes
    const entityNodes = entities.map(ent => ({
      id: `entity:${ent.value}`,
      label: ent.value,
      type: ent.type,
      risk: ent.riskScore || 'Medium',
      casesLinked: ent.casesLinked || []
    }));

    // Combine all nodes
    const allNewNodes = [...caseNodes, ...entityNodes];

    // 3. Build links between cases and entities
    const allNewLinks = [];
    entities.forEach(ent => {
      const linkedCases = ent.casesLinked || [];
      linkedCases.forEach(caseId => {
        const caseExists = cases.some(c => c.id === caseId);
        if (caseExists) {
          allNewLinks.push({
            source: `case:${caseId}`,
            target: `entity:${ent.value}`
          });
        }
      });
    });

    // 4. Position the nodes dynamically using a radial layout
    setNodes(prevNodes => {
      const posMap = new Map(prevNodes.map(n => [n.id, { x: n.x, y: n.y }]));
      
      const width = 800;
      const height = 500;
      
      const casesList = allNewNodes.filter(n => n.type === 'Case');
      casesList.forEach((c, idx) => {
        if (posMap.has(c.id)) {
          c.x = posMap.get(c.id).x;
          c.y = posMap.get(c.id).y;
        } else {
          const angle = (idx / Math.max(1, casesList.length)) * 2 * Math.PI;
          c.x = width / 2 + Math.cos(angle) * 220;
          c.y = height / 2 + Math.sin(angle) * 140;
        }
      });

      const entitiesList = allNewNodes.filter(n => n.type !== 'Case');
      entitiesList.forEach((ent, idx) => {
        if (posMap.has(ent.id)) {
          ent.x = posMap.get(ent.id).x;
          ent.y = posMap.get(ent.id).y;
        } else {
          const linkedCaseIds = ent.casesLinked || [];
          if (linkedCaseIds.length > 0) {
            let sumX = 0, sumY = 0, count = 0;
            linkedCaseIds.forEach(cid => {
              const caseNode = casesList.find(c => c.id === `case:${cid}`);
              if (caseNode) {
                sumX += caseNode.x;
                sumY += caseNode.y;
                count++;
              }
            });
            if (count > 0) {
              const avgX = sumX / count;
              const avgY = sumY / count;
              const angle = (idx * 1.35) % (2 * Math.PI);
              const dist = 70 + (idx % 4) * 20 + (linkedCaseIds.length > 1 ? 0 : 30);
              ent.x = avgX + Math.cos(angle) * dist;
              ent.y = avgY + Math.sin(angle) * dist;
            } else {
              ent.x = width / 2 + Math.cos(idx) * 280;
              ent.y = height / 2 + Math.sin(idx) * 190;
            }
          } else {
            ent.x = width / 2 + Math.cos(idx) * 280;
            ent.y = height / 2 + Math.sin(idx) * 190;
          }
        }
      });

      return allNewNodes;
    });

    setLinks(allNewLinks);
  }, [cases, entities, evidence]);
  
  // Filters
  const [showCases, setShowCases] = useState(true);
  const [showMobiles, setShowMobiles] = useState(true);
  const [showUPIs, setShowUPIs] = useState(true);
  const [showOthers, setShowOthers] = useState(true);

  const svgRef = useRef(null);

  // Mouse drag coordinates math
  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    setSelectedNodeId(nodeId);
  };

  const handleMouseMove = (e) => {
    if (!draggedNodeId || !svgRef.current) return;
    
    // Get mouse position relative to SVG bounding box
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constrain within visible boundary
    const constrainedX = Math.max(20, Math.min(rect.width - 20, x));
    const constrainedY = Math.max(20, Math.min(rect.height - 20, y));

    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === draggedNodeId 
          ? { ...node, x: constrainedX, y: constrainedY } 
          : node
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  const handleResetLayout = () => {
    setNodes([]);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  };

  // Node filtering helper
  const isNodeVisible = (node) => {
    if (node.type === 'Case') return showCases;
    if (node.type === 'Mobile Number') return showMobiles;
    if (node.type === 'UPI ID') return showUPIs;
    return showOthers;
  };

  const visibleNodes = nodes.filter(isNodeVisible);
  const visibleNodeIds = visibleNodes.map(n => n.id);

  // Links filter
  const visibleLinks = links.filter(l => 
    visibleNodeIds.includes(l.source) && visibleNodeIds.includes(l.target)
  );

  // Active hover paths
  const highlightedNodeIds = new Set();
  const highlightedLinkIndexes = new Set();

  if (hoveredNodeId) {
    highlightedNodeIds.add(hoveredNodeId);
    visibleLinks.forEach((l, idx) => {
      if (l.source === hoveredNodeId) {
        highlightedNodeIds.add(l.target);
        highlightedLinkIndexes.add(idx);
      } else if (l.target === hoveredNodeId) {
        highlightedNodeIds.add(l.source);
        highlightedLinkIndexes.add(idx);
      }
    });
  }

  // Selected node details helper
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Find linked entities count
  const getLinkedNodes = (nodeId) => {
    const linked = [];
    links.forEach(l => {
      if (l.source === nodeId) linked.push(nodes.find(n => n.id === l.target));
      if (l.target === nodeId) linked.push(nodes.find(n => n.id === l.source));
    });
    return linked.filter(Boolean);
  };

  const connectedNodes = selectedNode ? getLinkedNodes(selectedNode.id) : [];

  // Colors & styles for types
  const getNodeColor = (type) => {
    if (type === 'Case') return 'var(--secondary)'; // Forensics Blue
    if (type === 'Mobile Number') return '#e0f2fe'; // Light sky blue
    if (type === 'UPI ID') return 'var(--primary)'; // Electric Cyan
    return '#8b5cf6'; // Username/IP purple
  };

  const getRiskColor = (risk) => {
    if (risk === 'Critical') return 'var(--critical)';
    if (risk === 'High') return 'var(--warning)';
    return 'var(--success)';
  };

  const getNodeIconColor = (type) => {
    if (type === 'Case') return '#ffffff';
    if (type === 'Mobile Number') return '#0369a1';
    if (type === 'UPI ID') return '#0f172a';
    return '#ffffff';
  };

  const getNodeIcon = (type) => {
    const size = type === 'Case' ? 14 : 11;
    if (type === 'Case') return <ShieldAlert size={size} style={{ color: getNodeIconColor(type) }} />;
    if (type === 'Mobile Number') return <Phone size={size} style={{ color: getNodeIconColor(type) }} />;
    if (type === 'UPI ID') return <Hash size={size} style={{ color: getNodeIconColor(type) }} />;
    if (type === 'Email Address') return <Mail size={size} style={{ color: getNodeIconColor(type) }} />;
    if (type === 'Bank Account') return <CreditCard size={size} style={{ color: getNodeIconColor(type) }} />;
    if (type === 'IP Address') return <Globe size={size} style={{ color: getNodeIconColor(type) }} />;
    if (type === 'Username') return <User size={size} style={{ color: getNodeIconColor(type) }} />;
    return <Database size={size} style={{ color: getNodeIconColor(type) }} />;
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* LEFT AREA: Canvas and Toggles */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Actions bar */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={18} style={{ color: 'var(--primary)' }} /> LINK ANALYSIS COMMAND CANVAS
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Identify syndicates by connecting entities across multiple case files.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={handleResetLayout}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> RESET CANVAS
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '0.8rem'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            <Filter size={12} /> VISIBILITY FILTER:
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showCases} onChange={() => setShowCases(!showCases)} />
            Cases
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showMobiles} onChange={() => setShowMobiles(!showMobiles)} />
            Mobiles
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showUPIs} onChange={() => setShowUPIs(!showUPIs)} />
            UPI IDs
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showOthers} onChange={() => setShowOthers(!showOthers)} />
            Other Credentials (IPs, Bank A/C)
          </label>
        </div>

        {/* Interactive SVG Canvas */}
        <div 
          style={{ flexGrow: 1, position: 'relative', overflow: 'hidden', cursor: draggedNodeId ? 'grabbing' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg 
            ref={svgRef}
            width="100%" 
            height="100%" 
            style={{ minHeight: '400px', backgroundColor: 'var(--bg-darker)' }}
          >
            {/* Definitions for arrow markers or grids */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--border-primary)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Links Layer */}
            {visibleLinks.map((link, idx) => {
              const srcNode = nodes.find(n => n.id === link.source);
              const tgtNode = nodes.find(n => n.id === link.target);
              if (!srcNode || !tgtNode) return null;
              
              const isHighlighted = hoveredNodeId && highlightedLinkIndexes.has(idx);
              const isDimmed = hoveredNodeId && !highlightedLinkIndexes.has(idx);

              return (
                <line
                  key={idx}
                  x1={srcNode.x}
                  y1={srcNode.y}
                  x2={tgtNode.x}
                  y2={tgtNode.y}
                  className={`link-line ${isHighlighted ? 'highlighted' : ''}`}
                  style={{
                    opacity: isDimmed ? 0.15 : 0.8,
                    stroke: isHighlighted ? 'var(--primary)' : 'var(--border-primary)'
                  }}
                />
              );
            })}

            {/* Nodes Layer */}
            {visibleNodes.map(node => {
              const isHovered = hoveredNodeId === node.id;
              const isDimmed = hoveredNodeId && !highlightedNodeIds.has(node.id);
              const isSelected = selectedNodeId === node.id;
              
              // Node sizes
              const radius = node.type === 'Case' ? 20 : 14;

              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ opacity: isDimmed ? 0.3 : 1, cursor: 'grab', transition: 'opacity 0.2s ease' }}
                >
                  {/* Glowing halo for high risk / critical */}
                  {(node.risk === 'Critical' || node.risk === 'High') && (
                    <circle 
                      cx="0" 
                      cy="0" 
                      r={radius + 8} 
                      fill="none" 
                      stroke={getRiskColor(node.risk)} 
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                      style={{
                        animation: 'spin 10s linear infinite',
                        filter: `drop-shadow(0px 0px 4px ${getRiskColor(node.risk)})`
                      }}
                    />
                  )}
                  
                  {/* Node Circle */}
                  <circle
                    cx="0"
                    cy="0"
                    r={radius}
                    fill={getNodeColor(node.type)}
                    stroke={isSelected ? '#ffffff' : 'var(--bg-secondary)'}
                    strokeWidth={isSelected ? 3 : 1.5}
                    className="node-circle"
                  />

                  {/* Icon Overlay */}
                  <foreignObject
                    width={radius * 1.4}
                    height={radius * 1.4}
                    x={-radius * 0.7}
                    y={-radius * 0.7}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%'
                    }}>
                      {getNodeIcon(node.type)}
                    </div>
                  </foreignObject>

                  {/* Text label */}
                  <text
                    x="0"
                    y={radius + 16}
                    textAnchor="middle"
                    className="node-text"
                    style={{
                      fontSize: isSelected ? '0.85rem' : '0.75rem',
                      fontWeight: isSelected ? 700 : 500,
                      fill: isSelected ? 'var(--primary)' : 'var(--text-primary)'
                    }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* RIGHT SIDEBAR: Selected Node Intel Dossier */}
      <div style={{
        width: '320px',
        borderLeft: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        flexShrink: 0
      }}>
        {selectedNode ? (
          <>
            <div>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-low" style={{ fontSize: '0.65rem' }}>{selectedNode.type}</span>
                <span className={`badge ${
                  selectedNode.risk === 'Critical' ? 'badge-critical' : selectedNode.risk === 'High' ? 'badge-high' : 'badge-medium'
                }`}>{selectedNode.risk} risk</span>
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{selectedNode.label}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Node Hash ID: {selectedNode.id}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>INTELLIGENCE REMARKS:</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4', marginTop: '6px' }}>
                {selectedNode.type === 'Case' 
                  ? "This node represents the core complaint dossier file. Hovering over this node shows all extracted telephone numbers, banking assets, and suspect accounts associated with the complaint."
                  : "Extracted digital identifier. Linked to active investigation logs. Linked cross-case indicates coordinated financial mule network."
                }
              </p>
            </div>

            {/* Connected Nodes */}
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>DIRECT ASSOCIATIONS ({connectedNodes.length})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {connectedNodes.map(node => (
                  <div 
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-primary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{node.label}</span>
                    <span className="badge badge-low" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>{node.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk indicators & alerts */}
            {(selectedNode.risk === 'Critical' || selectedNode.risk === 'High') && (
              <div 
                style={{
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: 'auto'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--critical)', fontWeight: 700, fontSize: '0.8rem' }}>
                  <ShieldAlert size={14} /> FRAUD ALERT TRIGGERED
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  This entity is correlated with multiple case files. High probability of organized crime network involvement. Bank freeze and mobile IMEI block recommended immediately.
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            <Database size={36} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Click on any node in canvas to view investigation links</div>
          </div>
        )}
      </div>

    </div>
  );
}
