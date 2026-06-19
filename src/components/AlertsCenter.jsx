import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  Clock
} from 'lucide-react';

export default function AlertsCenter({ alerts, onResolveAlert, onAddAuditLog }) {
  const [selectedAlertId, setSelectedAlertId] = useState(alerts[0]?.id || null);
  const [checklistState, setChecklistState] = useState({});

  const selectedAlert = alerts.find(a => a.id === selectedAlertId);

  // Toggle checklist items
  const handleCheckItem = (alertId, itemIdx) => {
    const key = `${alertId}-${itemIdx}`;
    setChecklistState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleResolve = (alertId) => {
    onResolveAlert(alertId);
    onAddAuditLog(`Resolved threat alert ${alertId}`);
    setSelectedAlertId(null);
  };

  // Get severity color
  const getSeverityColor = (sev) => {
    if (sev === 'Critical') return 'var(--critical)';
    if (sev === 'High') return 'var(--error)';
    if (sev === 'Medium') return 'var(--warning)';
    return 'var(--success)';
  };

  // Procedural Action list based on alert type
  const getActionChecklist = (alert) => {
    if (!alert) return [];
    if (alert.type === 'Duplicate Entity') {
      return [
        `Submit formal freeze request to bank holding entity ${alert.entityValue}`,
        `Report credential to 1930 Citizen Financial Cyber Fraud reporting portal`,
        `Flag coordinates to state/district nodal cell for block list ingestion`,
        `Co-ordinate with officers of cases: ${alert.cases.join(', ')}`
      ];
    }
    if (alert.type === 'High Value Transaction') {
      return [
        `Request certified bank statement/ledger matching account ${alert.entityValue}`,
        `Map immediate secondary outbound transfer accounts`,
        `Draft notice under Section 91 CrPC to payment gateway`
      ];
    }
    return [
      `Secure digital evidence chain of custody integrity`,
      `Record IMEI/IMSI identifiers for mobile network query`,
      `Update remarks in Case Dossier log`
    ];
  };

  return (
    <div style={{ padding: '24px', display: 'flex', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* LEFT COLUMN: Threat Alerts Feed */}
      <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Statistics Header */}
        <div className="glow-card" style={{ display: 'flex', justifyContent: 'space-around', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>CRITICAL</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--critical)', fontFamily: 'var(--font-mono)' }}>
              {alerts.filter(a => a.severity === 'Critical').length}
            </div>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--border-primary)' }}></div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>HIGH</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
              {alerts.filter(a => a.severity === 'High').length}
            </div>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--border-primary)' }}></div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>MEDIUM</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
              {alerts.filter(a => a.severity === 'Medium').length}
            </div>
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ color: 'var(--primary)' }} /> REAL-TIME CORRELATION ALERTS
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '450px' }}>
            {alerts.map(alert => {
              const isSelected = selectedAlertId === alert.id;
              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    borderColor: isSelected ? getSeverityColor(alert.severity) : 'var(--border-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 0 10px ${getSeverityColor(alert.severity)}1a` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertOctagon size={16} style={{ color: getSeverityColor(alert.severity) }} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{alert.title}</span>
                    </div>
                    <span className={`badge ${
                      alert.severity === 'Critical' ? 'badge-critical' : alert.severity === 'High' ? 'badge-high' : 'badge-medium'
                    }`}>{alert.severity}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {alert.description.length > 110 ? alert.description.substring(0, 110) + '...' : alert.description}
                  </p>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '6px', marginTop: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{alert.entityValue}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(alert.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                All threat alerts resolved. Platform secure.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Threat Investigation Dossier */}
      <div style={{ flex: '1.2 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {selectedAlert ? (
          <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', borderColor: getSeverityColor(selectedAlert.severity) }}>
            
            {/* Header info */}
            <div>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>{selectedAlert.type}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: getSeverityColor(selectedAlert.severity) }}>
                  {selectedAlert.severity} RISK FLAG
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedAlert.title}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Identified: {new Date(selectedAlert.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Entity details block */}
            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', padding: '14px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>MATCHING FORENSIC IDENTIFIER:</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--primary)', fontWeight: 700, wordBreak: 'break-all' }}>
                {selectedAlert.entityValue}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Flagged in Cases:</span>
                {selectedAlert.cases.map(cId => (
                  <span key={cId} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: '3px' }}>
                    {cId}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>THREAT ANALYSIS MATRIX:</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', marginTop: '6px' }}>
                {selectedAlert.description}
              </p>
            </div>

            {/* Police SOP Action Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>POLICE INVESTIGATION SOP CHECKLIST:</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getActionChecklist(selectedAlert).map((action, idx) => {
                  const checkKey = `${selectedAlert.id}-${idx}`;
                  const isChecked = !!checklistState[checkKey];
                  return (
                    <div 
                      key={idx}
                      onClick={() => handleCheckItem(selectedAlert.id, idx)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-primary)',
                        backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-primary)',
                        borderColor: isChecked ? 'var(--success)' : 'var(--border-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.8rem',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid var(--border-primary)',
                        borderColor: isChecked ? 'var(--success)' : 'var(--border-primary)',
                        borderRadius: '3px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0
                      }}>
                        {isChecked && <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--success)', borderRadius: '1px' }}></div>}
                      </div>
                      <span style={{ color: isChecked ? 'var(--success)' : 'var(--text-primary)' }}>{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resolve alert trigger */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => handleResolve(selectedAlert.id)}
                style={{
                  backgroundColor: 'var(--success)',
                  color: 'black',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ShieldCheck size={16} /> RESOLVE THREAT INDICATOR
              </button>
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            <ShieldAlert size={48} />
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select a threat alert to review SOP checklist</div>
          </div>
        )}
      </div>

    </div>
  );
}
