import React, { useState } from 'react';
import { 
  FileText, 
  Printer, 
  ShieldAlert, 
  CheckCircle, 
  Download,
  AlertTriangle,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';

export default function ReportGenerator({ cases, evidence, entities, alerts }) {
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || '');
  const [execSummary, setExecSummary] = useState('');

  const activeCase = cases.find(c => c.id === selectedCaseId);

  // Filter evidence & alerts for the case
  const caseEvidence = activeCase ? evidence.filter(e => e.caseId === activeCase.id) : [];
  const caseAlerts = activeCase ? alerts.filter(a => a.cases.includes(activeCase.id)) : [];

  // Extract all unique entities linked to this case
  const caseEntities = activeCase ? entities.filter(ent => ent.casesLinked.includes(activeCase.id)) : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      
      {/* Configuration Header Panel (Hidden on Print) */}
      <div className="glow-card no-print" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText style={{ color: 'var(--primary)' }} /> CONFIDENTIAL REPORT DOCKET GENERATOR
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Select Case Dossier</label>
            <select 
              value={selectedCaseId} 
              onChange={(e) => {
                setSelectedCaseId(e.target.value);
                setExecSummary(''); // Reset executive summary
              }}
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              <option value="">-- Choose Case file --</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.id} - {c.title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Custom Case Summary Override (Optional)</label>
            <input 
              type="text"
              placeholder="e.g. Organized cyber fraud ring operating from Bharatpur border..."
              value={execSummary}
              onChange={(e) => setExecSummary(e.target.value)}
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              onClick={handlePrint}
              disabled={!selectedCaseId}
              style={{
                width: '100%',
                backgroundColor: selectedCaseId ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: selectedCaseId ? 'black' : 'var(--text-muted)',
                fontWeight: 700,
                border: 'none',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '0.9rem',
                cursor: selectedCaseId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: selectedCaseId ? '0 0 10px rgba(0, 240, 255, 0.2)' : 'none'
              }}
            >
              <Printer size={16} /> PRINT OFFICIAL DOCKET / SAVE PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Layout Preview Container */}
      {activeCase ? (
        <div 
          className="print-report-container"
          style={{
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '30px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
            fontFamily: 'var(--font-sans)',
            maxWidth: '850px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          {/* Official Police Header */}
          <div style={{ textAlign: 'center', borderBottom: '3px double #0f172a', paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              DISTRICT CYBER CRIME CELL COMMAND
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
              Cyber Police Station, Zone 1 Jurisdiction, NCR Delhi
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, textDecoration: 'underline', color: '#0f172a', marginTop: '12px' }}>
              CONFIDENTIAL CASE INVESTIGATION & EVIDENCE DOCKET
            </div>
          </div>

          {/* Reference Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <strong>Case Reference ID:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{activeCase.id}</span>
            </div>
            <div>
              <strong>Date of Registration:</strong> {new Date(activeCase.createdAt).toLocaleDateString()}
            </div>
            <div>
              <strong>Lead Investigator:</strong> {activeCase.officer} (Noida Cyber Cell)
            </div>
            <div>
              <strong>Crime Classification:</strong> {activeCase.classification}
            </div>
            <div>
              <strong>Priority/Risk Score:</strong> {activeCase.priority}
            </div>
            <div>
              <strong>Case Docket Status:</strong> {activeCase.status}
            </div>
          </div>

          {/* Complainant Details Profile */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase' }}>
              1. Complainant / Victim Profile
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <tbody>
                <tr>
                  <td style={{ width: '150px', padding: '6px 0', fontWeight: 600 }}>Victim Full Name:</td>
                  <td>{activeCase.victim.name}</td>
                  <td style={{ width: '120px', padding: '6px 0', fontWeight: 600 }}>Age/Gender:</td>
                  <td>{activeCase.victim.age} Yrs</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>Contact Number:</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{activeCase.victim.phone}</td>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>Email Address:</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{activeCase.victim.email}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>Occupation:</td>
                  <td>{activeCase.victim.occupation}</td>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>Address/Location:</td>
                  <td>{activeCase.victim.location}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Case Description Summary */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase' }}>
              2. Brief Description of Fraud Facts
            </h3>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#1e293b' }}>
              {activeCase.description}
            </p>
            {execSummary && (
              <div style={{ borderLeft: '3px solid #000000', paddingLeft: '12px', margin: '12px 0 0 0', fontStyle: 'italic', fontSize: '0.85rem' }}>
                <strong>Executive Addendum Summary:</strong> {execSummary}
              </div>
            )}
          </div>

          {/* Extracted Intelligence Assets */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase' }}>
              3. Extracted Suspect & Mule Intelligence Credentials
            </h3>
            
            {caseEntities.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #0f172a', textAlignment: 'left' }}>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 800 }}>Asset Identifier Type</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 800 }}>Extracted Value</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 800 }}>Threat Classification</th>
                    <th style={{ padding: '6px 12px 6px 0', fontWeight: 800 }}>Database Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {caseEntities.map(ent => (
                    <tr key={ent.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>{ent.type}</td>
                      <td style={{ padding: '8px 12px 8px 0', fontFamily: 'var(--font-mono)' }}>{ent.value}</td>
                      <td style={{ padding: '8px 12px 8px 0', fontWeight: 700, color: ent.riskScore === 'Critical' ? '#e11d48' : '#d97706' }}>
                        {ent.riskScore}
                      </td>
                      <td style={{ padding: '8px 12px 8px 0', color: '#475569' }}>{ent.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>No suspect credentials extracted yet.</p>
            )}
          </div>

          {/* Chronological Timeline reconstruction */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase' }}>
              4. Cyber Incident Timeline Reconstruction
            </h3>
            
            {caseEvidence.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {caseEvidence.map(item => {
                  const matches = item.ocrText.split('\n').filter(l => l.includes('[') || l.includes('Date:'));
                  return (
                    <div key={item.id} style={{ fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 700, textDecoration: 'underline' }}>Source: {item.fileName} ({item.fileType})</span>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {matches.slice(0, 3).map((l, i) => (
                          <li key={i} style={{ padding: '2px 0', fontFamily: 'var(--font-mono)' }}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Timeline data unavailable. No case evidence processed.</p>
            )}
          </div>

          {/* Threat Alerts Duplicate Matches */}
          {caseAlerts.length > 0 && (
            <div style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase' }}>
                5. Cross-Case Correlations & Risk Alerts
              </h3>
              <div style={{ border: '1px solid #0f172a', borderRadius: '4px', padding: '12px', fontSize: '0.8rem', backgroundColor: '#f8fafc' }}>
                {caseAlerts.map(alert => (
                  <div key={alert.id} style={{ marginBottom: '8px' }}>
                    <strong>[{alert.severity}] {alert.title}:</strong> {alert.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forensic chain of custody & Signatures */}
          <div style={{ borderTop: '2px solid #0f172a', paddingTop: '20px', marginTop: '40px', pageBreakInside: 'avoid' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', width: '33%', paddingBottom: '50px' }}>
                    <strong>Prepared By:</strong>
                  </td>
                  <td style={{ textAlign: 'center', width: '33%', paddingBottom: '50px' }}>
                    <strong>Verified By:</strong>
                  </td>
                  <td style={{ textAlign: 'center', width: '33%', paddingBottom: '50px' }}>
                    <strong>Approved By:</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
                    __________________________<br />
                    Investigator Officer (IO)<br />
                    Badge: IPS-89240
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
                    __________________________<br />
                    Forensics Analyst<br />
                    N Noida Lab
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
                    __________________________<br />
                    Superintendent / ACP<br />
                    District Cyber Nodal
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      ) : (
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          <FileText size={48} />
          <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '12px' }}>Please select a case file in configuration panel to generate docket report</div>
        </div>
      )}

    </div>
  );
}
