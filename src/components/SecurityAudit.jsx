import React, { useState } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Terminal, 
  RefreshCw, 
  User, 
  Info,
  CheckCircle2,
  Database,
  AlertTriangle
} from 'lucide-react';
import { evidenceApi } from '../services/api';

export default function SecurityAudit({ 
  auditLogs, 
  evidence, 
  activeOfficer, 
  onChangeOfficer,
  onAddAuditLog,
  apiOnline
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingFileId, setVerifyingFileId] = useState(null);
  const [verificationDone, setVerificationDone] = useState({});

  const filteredLogs = auditLogs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.officer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.ipAddress.includes(searchQuery)
  );

  // Simulated Roles
  const rolesList = [
    { name: 'Inspector S. Sharma', role: 'Investigator', badge: 'IPS-89240' },
    { name: 'Sub-Inspector Priya Roy', role: 'Analyst', badge: 'IPS-89410' },
    { name: 'Admin N. Grewal', role: 'Administrator', badge: 'ADM-00129' }
  ];

  const permissions = {
    'Investigator': ['Read Cases', 'Add Notes', 'Ingest Evidence', 'OCR Correction', 'View Alerts'],
    'Analyst': ['Read Cases', 'Ingest Evidence', 'OCR Correction', 'View Link Analysis'],
    'Administrator': ['Read Cases', 'Add Notes', 'Ingest Evidence', 'OCR Correction', 'View Alerts', 'View Link Analysis', 'Clear Logs', 'Audit Control']
  };

  const activeRolePerms = permissions[activeOfficer.role] || [];

  const handleVerifyFile = async (fileId) => {
    setVerifyingFileId(fileId);
    
    if (apiOnline) {
      try {
        const { data, error } = await evidenceApi.verifyIntegrity(fileId);
        if (data) {
          setVerificationDone(prev => ({ 
            ...prev, 
            [fileId]: { 
              success: data.verified, 
              msg: data.message,
              calc: data.calculatedHash,
              orig: data.originalHash
            } 
          }));
          onAddAuditLog(data.message);
        } else {
          alert(`Verification failed: ${error}`);
        }
      } catch (err) {
        alert(`Verification failed: ${err.message}`);
      } finally {
        setVerifyingFileId(null);
      }
    } else {
      // Simulate verification delay
      setTimeout(() => {
        setVerifyingFileId(null);
        setVerificationDone(prev => ({ 
          ...prev, 
          [fileId]: { 
            success: true, 
            msg: 'File integrity verified. Fingerprint matches original signature.',
            calc: 'Simulated OK',
            orig: 'Simulated OK'
          } 
        }));
        onAddAuditLog(`Verified forensic hash integrity for Evidence ID ${fileId}`);
      }, 1500);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', height: '100%', overflowY: 'auto' }}>
      
      {/* LEFT COLUMN: Role Selector & System Permissions */}
      <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Role Simulator */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} /> OFFICER CREDENTIAL SIMULATOR
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Select simulated investigator profile to test role-based access:</span>
            {rolesList.map(officer => {
              const isActive = activeOfficer.name === officer.name;
              return (
                <div
                  key={officer.name}
                  onClick={() => onChangeOfficer(officer)}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: isActive ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    borderColor: isActive ? 'var(--primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{officer.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Badge: {officer.badge}</div>
                  </div>
                  <span className={`badge ${isActive ? 'badge-low' : 'badge-closed'}`} style={{ fontSize: '0.65rem' }}>
                    {officer.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permissions Scope Matrix */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={16} /> SYSTEM SECURITY POLICY
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTIVE POLICE AUTHORITY MATRIX:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {activeRolePerms.map(perm => (
                <span key={perm} className="badge badge-low" style={{ fontSize: '0.7rem' }}>{perm}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Evidence Hash Integrity Checker */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} /> FORENSIC HASH VERIFICATION
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '250px' }}>
            {evidence.map(file => {
              const isVerifying = verifyingFileId === file.id;
              const result = verificationDone[file.id];
              const isDone = !!result;
              const isSuccess = isDone && result.success;
              const fileHash = file.sha256Hash || file.hash || 'N/A';
              
              return (
                <div 
                  key={file.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid ' + (isDone ? (isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)') : 'var(--border-primary)'),
                    backgroundColor: isDone ? (isSuccess ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)') : 'var(--bg-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{file.id}</span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>{file.fileName}</div>
                    </div>
                    
                    <button
                      onClick={() => handleVerifyFile(file.id)}
                      disabled={isVerifying || isDone}
                      style={{
                        backgroundColor: isDone ? (isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)') : 'var(--bg-tertiary)',
                        border: `1px solid ${isDone ? (isSuccess ? 'var(--success)' : 'var(--critical)') : 'var(--border-primary)'}`,
                        color: isDone ? (isSuccess ? 'var(--success)' : 'var(--critical)') : 'var(--text-primary)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: isVerifying || isDone ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isVerifying ? (
                        <RefreshCw size={10} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                      ) : isDone ? (
                        isSuccess ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />
                      ) : 'Verify'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.65rem' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={fileHash}>
                      ORIGINAL: {fileHash.substring(0, 32)}...
                    </div>
                    {isDone && !isSuccess && (
                      <>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--critical)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={result.calc}>
                          CALCULATED: {result.calc?.substring(0, 32)}...
                        </div>
                        <div style={{ color: 'var(--critical)', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={10} /> Tampering Detected! Signature mismatch.
                        </div>
                      </>
                    )}
                    {isDone && isSuccess && (
                      <div style={{ color: 'var(--success)', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={10} /> Signature Matches DB footprints.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Audit Trail Console Log */}
      <div style={{ flex: '1.5 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
          
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal style={{ color: 'var(--primary)' }} /> POLICE WORKSPACE AUDIT TRAIL
            </h3>
            
            {/* Log Search */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Terminal size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '6px 8px 6px 26px', borderRadius: '4px' }}
              />
            </div>
          </div>

          {/* Terminal Logs Grid */}
          <div style={{
            flexGrow: 1,
            backgroundColor: 'var(--bg-darker)',
            border: '1px solid var(--border-primary)',
            borderRadius: '6px',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            lineHeight: '1.4',
            maxHeight: '450px'
          }}>
            {filteredLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--primary)' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{log.officer}</span>
                <span style={{ color: '#cbd5e1', flexGrow: 1 }}>{log.action}</span>
                <span style={{ color: 'var(--text-muted)' }}>IP: {log.ipAddress}</span>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                No audit signatures matching filter criteria.
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
