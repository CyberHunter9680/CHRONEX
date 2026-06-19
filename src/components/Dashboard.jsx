import React, { useState } from 'react';
import { 
  Shield, 
  FolderOpen, 
  Fingerprint, 
  AlertOctagon, 
  TrendingUp, 
  IndianRupee, 
  AlertTriangle,
  Clock
} from 'lucide-react';

export default function Dashboard({ cases, evidence, entities, alerts, onNavigate }) {
  // Statistics computations
  const totalCases = cases.length;
  const totalEvidence = evidence.length;
  const totalEntities = entities.length;
  const activeAlerts = alerts.filter(a => a.severity === 'Critical' || a.severity === 'High').length;
  
  // Calculate total fraud amount
  const totalFraud = cases.reduce((acc, curr) => {
    // Basic regex extract amount from case description or notes
    const match = curr.description.match(/(?:Rs|INR|₹)\s*(\d+(?:,\d+)*)/i);
    if (match) {
      const num = parseInt(match[1].replace(/,/g, ''), 10);
      return acc + (isNaN(num) ? 0 : num);
    }
    // Hardcoded defaults for categories
    if (curr.classification === 'Investment Scam') return acc + 120000;
    if (curr.classification === 'Job Fraud') return acc + 45000;
    if (curr.classification === 'Loan App Fraud') return acc + 25000;
    if (curr.classification === 'Sextortion') return acc + 15000;
    return acc;
  }, 0);

  // Group by category for donut chart
  const categories = {};
  cases.forEach(c => {
    categories[c.classification] = (categories[c.classification] || 0) + 1;
  });

  const catKeys = Object.keys(categories);
  const catValues = Object.values(categories);
  const catColors = {
    'Investment Scam': '#00f0ff',
    'Job Fraud': '#3b82f6',
    'Loan App Fraud': '#f59e0b',
    'Sextortion': '#f43f5e',
    'Phishing': '#10b981',
    'UPI Fraud': '#8b5cf6'
  };

  // Donut chart calculations
  const totalCatCount = catValues.reduce((a, b) => a + b, 0);
  let accumulatedAngle = 0;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(90deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
        border: '1px solid var(--border-primary)',
        borderRadius: '8px',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ color: 'var(--primary)' }} /> COMMAND INTELLIGENCE CENTER
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            District Cyber Crime Forensic Portal • District Intelligence Unit Active Sessions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>LOCAL FORENSIC TIME</span>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glow-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <FolderOpen size={28} style={{ color: 'var(--secondary)' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Cases</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{totalCases}</div>
          </div>
        </div>

        <div className="glow-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(0, 240, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
            <Fingerprint size={28} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Evidence Files</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{totalEvidence}</div>
          </div>
        </div>

        <div className="glow-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <TrendingUp size={28} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Intelligence Entities</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{totalEntities}</div>
          </div>
        </div>

        <div className="glow-card glow-card-critical" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
            <AlertOctagon size={28} style={{ color: 'var(--critical)' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Threat Alerts</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--critical)' }}>{activeAlerts}</div>
          </div>
        </div>
      </div>

      {/* Main Charts & Visualizations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Trend Area Chart SVG */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>MONTHLY INCIDENT TRENDS</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500 }}>Noida Jurisdiction</span>
          </h3>
          <div style={{ height: '220px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 500 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#1b2641" strokeDasharray="3,3"/>
              <line x1="40" y1="70" x2="480" y2="70" stroke="#1b2641" strokeDasharray="3,3"/>
              <line x1="40" y1="120" x2="480" y2="120" stroke="#1b2641" strokeDasharray="3,3"/>
              <line x1="40" y1="170" x2="480" y2="170" stroke="#1b2641"/>
              
              {/* Axis Labels */}
              <text x="40" y="185" fill="#64748b" fontSize="10" textAnchor="middle">Jan</text>
              <text x="128" y="185" fill="#64748b" fontSize="10" textAnchor="middle">Feb</text>
              <text x="216" y="185" fill="#64748b" fontSize="10" textAnchor="middle">Mar</text>
              <text x="304" y="185" fill="#64748b" fontSize="10" textAnchor="middle">Apr</text>
              <text x="392" y="185" fill="#64748b" fontSize="10" textAnchor="middle">May</text>
              <text x="480" y="185" fill="#64748b" fontSize="10" textAnchor="middle">Jun</text>

              {/* Data Path Area */}
              <path 
                d="M 40,170 Q 84,130 128,150 T 216,110 T 304,80 T 392,40 T 480,25 L 480,170 Z" 
                fill="url(#chartGlow)"
              />
              {/* Data Path Line */}
              <path 
                d="M 40,170 Q 84,130 128,150 T 216,110 T 304,80 T 392,40 T 480,25" 
                fill="none" 
                stroke="#00f0ff" 
                strokeWidth="3"
                filter="drop-shadow(0px 0px 4px rgba(0, 240, 255, 0.5))"
              />

              {/* Grid values */}
              <text x="30" y="24" fill="#64748b" fontSize="9" textAnchor="end">100%</text>
              <text x="30" y="74" fill="#64748b" fontSize="9" textAnchor="end">50%</text>
              <text x="30" y="124" fill="#64748b" fontSize="9" textAnchor="end">25%</text>
              <text x="30" y="174" fill="#64748b" fontSize="9" textAnchor="end">0</text>
            </svg>
          </div>
        </div>

        {/* Donut Chart SVG */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
            CASE CATEGORIES DISTRIBUTION
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ width: '150px', height: '150px', position: 'relative' }}>
              <svg viewBox="0 0 100 100" width="100%" height="100%">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-tertiary)" strokeWidth="12" />
                {catKeys.map((key, i) => {
                  const count = categories[key];
                  const percentage = (count / totalCatCount) * 100;
                  const dashArray = `${percentage} ${100 - percentage}`;
                  const offset = 100 - accumulatedAngle + 25; // start from top
                  accumulatedAngle += percentage;
                  
                  return (
                    <circle
                      key={key}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={catColors[key] || '#cbd5e1'}
                      strokeWidth="12"
                      strokeDasharray={`${(percentage * 2.51).toFixed(1)} ${(251 - percentage * 2.51).toFixed(1)}`}
                      strokeDashoffset={(offset * 2.51).toFixed(1)}
                      transform="rotate(-90, 50, 50)"
                      style={{ transition: 'stroke-dasharray 0.3s' }}
                    />
                  );
                })}
                <circle cx="50" cy="50" r="28" fill="var(--bg-secondary)" />
              </svg>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{totalCases}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cases</div>
              </div>
            </div>
            
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1, minWidth: '150px' }}>
              {catKeys.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: catColors[key] || '#cbd5e1', display: 'inline-block' }}></span>
                    <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                  </div>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{categories[key]} ({Math.round((categories[key] / totalCases) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Fraud Amount & Live Intel Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Fraud Amount Bar Chart */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>FRAUD AMOUNT DISCOVERY BY CATEGORY</span>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600 }}>
              <IndianRupee size={14} /> Total Loss: ~{totalFraud.toLocaleString('en-IN')}
            </span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
            {catKeys.map(key => {
              // Custom estimated amount for display
              let amt = 0;
              if (key === 'Investment Scam') amt = 120000;
              else if (key === 'Job Fraud') amt = 45000;
              else if (key === 'Loan App Fraud') amt = 25000;
              else if (key === 'Sextortion') amt = 15000;
              else amt = 10000;
              
              const pct = (amt / 130000) * 100;

              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      ₹{amt.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, var(--secondary) 0%, ${catColors[key] || 'var(--primary)'} 100%)`,
                      borderRadius: '4px',
                      boxShadow: `0 0 8px ${catColors[key] || 'var(--primary)'}`
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Active High Risk Alerts */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>HIGH-RISK FORENSIC ALERTS</span>
            <button 
              onClick={() => onNavigate('alerts')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
            >
              View All
            </button>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '200px' }}>
            {alerts.slice(0, 3).map(alert => (
              <div 
                key={alert.id} 
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  borderLeft: `3px solid ${alert.severity === 'Critical' ? 'var(--critical)' : 'var(--warning)'}`,
                  padding: '12px',
                  borderRadius: '0 6px 6px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} style={{ color: alert.severity === 'Critical' ? 'var(--critical)' : 'var(--warning)' }} />
                    {alert.title}
                  </span>
                  <span className={`badge ${alert.severity === 'Critical' ? 'badge-critical' : 'badge-medium'}`}>{alert.severity}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {alert.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>Entity: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{alert.entityValue}</span></span>
                  <span>{new Date(alert.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
