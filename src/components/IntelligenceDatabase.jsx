import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  ChevronRight, 
  ShieldAlert, 
  FileText, 
  Phone, 
  Globe, 
  Mail, 
  CreditCard,
  Hash,
  Link
} from 'lucide-react';

export default function IntelligenceDatabase({ entities, cases, evidence, onNavigate, setActiveCaseId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  // Filter entities
  const filteredEntities = entities.filter(ent => {
    const matchesType = filterType === 'All' || ent.type === filterType;
    const matchesSearch = ent.value.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ent.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ent.casesLinked.some(cId => cId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const selectedEntity = entities.find(e => e.id === selectedEntityId);

  // Get evidence matches for selected entity
  const getEvidenceMatches = (entityVal) => {
    return evidence.filter(e => e.ocrText.toLowerCase().includes(entityVal.toLowerCase()));
  };

  const matchedEvidence = selectedEntity ? getEvidenceMatches(selectedEntity.value) : [];

  // Icon getter for entity type
  const getEntityIcon = (type) => {
    if (type === 'Mobile Number') return <Phone size={14} style={{ color: 'var(--primary)' }} />;
    if (type === 'UPI ID') return <Link size={14} style={{ color: 'var(--primary)' }} />;
    if (type === 'Email Address') return <Mail size={14} style={{ color: 'var(--primary)' }} />;
    if (type === 'IP Address') return <Globe size={14} style={{ color: 'var(--primary)' }} />;
    if (type === 'Bank Account') return <CreditCard size={14} style={{ color: 'var(--primary)' }} />;
    if (type === 'Username') return <Database size={14} style={{ color: 'var(--primary)' }} />;
    return <Hash size={14} style={{ color: 'var(--primary)' }} />;
  };

  const handleNavigateToCase = (caseId) => {
    setActiveCaseId(caseId);
    onNavigate('cases');
  };

  return (
    <div style={{ padding: '24px', display: 'flex', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* LEFT PANEL: Global Entity Directory */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Search header */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database style={{ color: 'var(--primary)' }} /> GLOBAL INTEL SEARCH DIRECTORY
          </h2>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Query global database (phone, UPI ID, bank account, case reference)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  padding: '10px 14px 10px 36px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {/* Type selector */}
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                padding: '10px 16px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                minWidth: '160px'
              }}
            >
              <option value="All">All Types</option>
              <option value="Mobile Number">Mobile Number</option>
              <option value="UPI ID">UPI ID</option>
              <option value="Email Address">Email Address</option>
              <option value="IP Address">IP Address</option>
              <option value="Bank Account">Bank Account</option>
              <option value="Username">Username</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="forensic-table-container">
          <table className="forensic-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Entity Value</th>
                <th>Identifier Type</th>
                <th>Risk Status</th>
                <th>Associated Cases</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map(ent => (
                <tr 
                  key={ent.id}
                  onClick={() => setSelectedEntityId(ent.id)}
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: selectedEntityId === ent.id ? 'var(--bg-tertiary)' : 'transparent'
                  }}
                >
                  <td>{getEntityIcon(ent.type)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{ent.value}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{ent.type}</td>
                  <td>
                    <span className={`badge ${
                      ent.riskScore === 'Critical' ? 'badge-critical' : ent.riskScore === 'High' ? 'badge-high' : 'badge-medium'
                    }`}>{ent.riskScore}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {ent.casesLinked.map(cId => (
                        <span key={cId} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-primary)' }}>
                          {cId}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </td>
                </tr>
              ))}
              {filteredEntities.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No intelligence nodes match search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* RIGHT PANEL: Entity Life Cycle Dossier */}
      <div style={{
        width: '350px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: '8px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        flexShrink: 0
      }}>
        {selectedEntity ? (
          <>
            <div>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-low" style={{ fontSize: '0.65rem' }}>{selectedEntity.type}</span>
                <span className={`badge ${
                  selectedEntity.riskScore === 'Critical' ? 'badge-critical' : selectedEntity.riskScore === 'High' ? 'badge-high' : 'badge-medium'
                }`}>{selectedEntity.riskScore} Risk</span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, wordBreak: 'break-all', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                {selectedEntity.value}
              </h3>
            </div>

            {/* Entity Remarks */}
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>CELL REPORT DETAILS</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', marginTop: '6px' }}>
                {selectedEntity.details}
              </p>
            </div>

            {/* Linked Cases */}
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>LINKED CASE FILES</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedEntity.casesLinked.map(caseId => {
                  const linkedCase = cases.find(c => c.id === caseId);
                  return (
                    <div 
                      key={caseId}
                      onClick={() => handleNavigateToCase(caseId)}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-primary)',
                        backgroundColor: 'var(--bg-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'border-color 0.2s'
                      }}
                      title="Click to open Case Workspace"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 600 }}>{caseId}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{linkedCase?.status}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {linkedCase?.title || "Unknown Case"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OCR Transcripts matches */}
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>TRANSCRIPT MATCHES ({matchedEvidence.length})</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {matchedEvidence.map(item => {
                  // Find line containing the value
                  const matchedLine = item.ocrText.split('\n').find(l => l.toLowerCase().includes(selectedEntity.value.toLowerCase())) || "Match found in document.";
                  return (
                    <div key={item.id} style={{ border: '1px solid var(--border-primary)', padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>File: {item.fileName}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{item.id}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '4px', borderLeft: '2px solid var(--primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                        {matchedLine.length > 80 ? matchedLine.substring(0, 80) + '...' : matchedLine}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            <Database size={36} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Select an entity from directory to run life-cycle trace</div>
            <p style={{ fontSize: '0.75rem' }}>Select an entity from the list on the left to see all linked cases, OCR screenshot matches, and suspect profiles.</p>
          </div>
        )}
      </div>

    </div>
  );
}
