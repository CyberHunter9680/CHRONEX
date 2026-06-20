import React, { useState, useEffect } from 'react';
import { Search, Globe, ShieldAlert, Cpu, Server, Compass, History, User, Check, X, Clock, Link2, Bot } from 'lucide-react';
import { osintApi } from '../services/api';

export default function OsintWorkspace({ apiOnline, activeOfficer, onAddAuditLog }) {
  const [entityType, setEntityType] = useState('IP Address');
  const [entityValue, setEntityValue] = useState('');
  const [queryType, setQueryType] = useState('IP Reputation');
  
  const [history, setHistory] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Suggest matching query types when entity type changes
  useEffect(() => {
    if (entityType === 'IP Address') {
      setQueryType('IP Reputation');
    } else if (entityType === 'URL' || entityType === 'Domain') {
      setQueryType('WHOIS Lookup');
    } else if (entityType === 'UPI ID') {
      setQueryType('UPI Trust Verification');
    } else if (entityType === 'Mobile Number') {
      setQueryType('IMSI Intelligence');
    }
  }, [entityType]);

  const loadHistory = async () => {
    try {
      const res = await osintApi.getHistory();
      if (res.data?.history) {
        setHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to load OSINT log history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!entityValue.trim()) return;

    setLoading(true);
    setError('');
    setSelectedResult(null);

    try {
      const res = await osintApi.queryEntity({
        entity_type: entityType,
        entity_value: entityValue.trim(),
        query_type: queryType,
        officer: activeOfficer.name
      });

      if (res.data?.success) {
        const normResult = {
          result_id: res.data.result.id,
          query: res.data.query,
          result: {
            source: res.data.result.source,
            result_data: typeof res.data.result.result_data === 'string' ? JSON.parse(res.data.result.result_data) : res.data.result.result_data
          }
        };
        setSelectedResult(normResult);
        onAddAuditLog(`Executed OSINT ${queryType} trace for ${entityType} "${entityValue.trim()}"`);
        await loadHistory();
      } else {
        throw new Error(res.error || 'OSINT connector returned empty result');
      }
    } catch (err) {
      setError('Trace Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewUpdate = async (resultId, status) => {
    if (!resultId) return;
    try {
      const res = await osintApi.updateReviewStatus(resultId, status);
      if (res.data?.success) {
        setSelectedResult(prev => {
          if (!prev) return null;
          const updated = { ...prev };
          updated.result.result_data.review_status = status;
          return updated;
        });
        onAddAuditLog(`OSINT trace finding ID ${resultId} marked as: ${status}`);
        await loadHistory();
      }
    } catch (err) {
      console.error('Failed to update OSINT review status:', err);
    }
  };

  // Helper for confidence class styling
  const getConfidenceLevel = (score) => {
    if (score >= 90) return { label: 'High Confidence', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    if (score >= 70) return { label: 'Medium Confidence', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
    if (score >= 40) return { label: 'Low Confidence', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    return { label: 'Unverified', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  };

  const getVerificationClass = (status) => {
    switch (status) {
      case 'Verified': return { color: '#10b981', border: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.05)' };
      case 'Partially Verified': return { color: '#3b82f6', border: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.05)' };
      default: return { color: '#ef4444', border: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.05)' };
    }
  };

  return (
    <div className="workspace-panel" style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.05em' }}>
          LAWFUL OSINT & GEO-REPUTATION WORKSPACE
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
          Execute multi-source validated queries across evidence databases and legacy dossiers with anti-hallucination scoring.
        </p>
      </div>

      {/* Grid Layout split between Form/History and Results Terminal */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', flexGrow: 1, minHeight: 0 }}>
        
        {/* Left Side: Forms & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Query Form */}
          <div className="glow-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} style={{ color: 'var(--primary)' }} /> Threat Indicator Input
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Entity Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>INDICATOR TYPE</label>
                <select 
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="IP Address">IP Address</option>
                  <option value="Domain">Domain Name</option>
                  <option value="URL">URL Link</option>
                  <option value="UPI ID">UPI ID</option>
                  <option value="Mobile Number">Mobile Number</option>
                </select>
              </div>

              {/* Query Value */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>INDICATOR VALUE</label>
                <input 
                  type="text"
                  placeholder={
                    entityType === 'IP Address' ? 'e.g. 192.168.1.100' :
                    entityType === 'UPI ID' ? 'e.g. securepay.mule@okaxis' :
                    entityType === 'Mobile Number' ? 'e.g. +91 91234 56789' : 'e.g. scamdomain.com'
                  }
                  value={entityValue}
                  onChange={(e) => setEntityValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Action type */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>OSINT MODULE</label>
                <select 
                  value={queryType}
                  onChange={(e) => setQueryType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {entityType === 'IP Address' && (
                    <>
                      <option value="IP Reputation">IP Reputation Check</option>
                      <option value="DNS Intelligence">Reverse DNS Mapping</option>
                    </>
                  )}
                  {(entityType === 'URL' || entityType === 'Domain') && (
                    <>
                      <option value="WHOIS Lookup">WHOIS Registry Scrape</option>
                      <option value="URL Check">VirusTotal URL Trust Scan</option>
                      <option value="DNS Intelligence">DNS A/MX Records Look</option>
                    </>
                  )}
                  {entityType === 'UPI ID' && (
                    <option value="UPI Trust Verification">UPI NPCI Trust Scan</option>
                  )}
                  {entityType === 'Mobile Number' && (
                    <option value="IMSI Intelligence">Operator HLR Location trace</option>
                  )}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={loading || !entityValue.trim()}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px 16px',
                  backgroundColor: loading || !entityValue.trim() ? 'var(--bg-tertiary)' : 'var(--primary)',
                  color: loading || !entityValue.trim() ? 'var(--text-muted)' : 'var(--primary-btn-text)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || !entityValue.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: loading || !entityValue.trim() ? 'none' : '0 0 12px rgba(0, 240, 255, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Search size={14} /> {loading ? 'Running Trace...' : 'Execute OSINT Query'}
              </button>
            </form>
          </div>

          {/* Past logs list */}
          <div className="glow-card" style={{ padding: '20px', flexGrow: 1, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={16} style={{ color: 'var(--secondary)' }} /> OSINT Query Logs
            </h3>
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.length > 0 ? (
                history.map(item => {
                  const data = typeof item.result_data === 'string' ? JSON.parse(item.result_data) : item.result_data;
                  return (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedResult({
                        result_id: item.result_id,
                        query: {
                          id: item.id,
                          entity_type: item.entity_type,
                          entity_value: item.entity_value,
                          query_type: item.query_type,
                          officer: item.officer,
                          timestamp: item.timestamp
                        },
                        result: {
                          source: item.source,
                          result_data: data
                        }
                      })}
                      style={{
                        padding: '10px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>{item.entity_value}</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', alignItems: 'center' }}>
                        <span>{item.query_type}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {data?.verification_status && (
                            <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', border: `1px solid ${getVerificationClass(data.verification_status).color}`, color: getVerificationClass(data.verification_status).color }}>
                              {data.verification_status}
                            </span>
                          )}
                          {data?.review_status && (
                            <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', backgroundColor: data.review_status === 'Approved' ? 'rgba(16,185,129,0.1)' : data.review_status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: data.review_status === 'Approved' ? '#10b981' : data.review_status === 'Rejected' ? '#ef4444' : '#f59e0b' }}>
                              {data.review_status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '0.8rem' }}>
                  No historical queries logged.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Results Terminal */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', backgroundColor: '#050b14', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={16} /> Intelligence Terminal Output
            </h3>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,240,255,0.1)', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
              {selectedResult ? 'LOG_LOADED' : 'AWAITING_INPUT'}
            </span>
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ color: 'var(--critical)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                {`[ERROR] ${error}`}
              </div>
            )}

            {selectedResult ? (
              <>
                {/* OSINT Validation Engine Headers */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                  {/* Verification Status */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: getVerificationClass(selectedResult.result.result_data.verification_status).bg,
                    border: `1px solid ${getVerificationClass(selectedResult.result.result_data.verification_status).border}`,
                    flex: 1,
                    minWidth: '120px'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', fontWeight: 600 }}>VERIFICATION STATUS</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: getVerificationClass(selectedResult.result.result_data.verification_status).color, marginTop: '2px', display: 'block' }}>
                      {selectedResult.result.result_data.verification_status || 'Unverified'}
                    </span>
                  </div>

                  {/* Confidence Score */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: getConfidenceLevel(selectedResult.result.result_data.confidence_score).bg,
                    border: `1px solid ${getConfidenceLevel(selectedResult.result.result_data.confidence_score).color}33`,
                    flex: 1,
                    minWidth: '120px'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', fontWeight: 600 }}>CONFIDENCE INDEX</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: getConfidenceLevel(selectedResult.result.result_data.confidence_score).color, marginTop: '2px', display: 'block' }}>
                      {selectedResult.result.result_data.confidence_score}% • {getConfidenceLevel(selectedResult.result.result_data.confidence_score).label}
                    </span>
                  </div>

                  {/* Investigator Review status */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    flex: 1,
                    minWidth: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>INVESTIGATOR REVIEW</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: selectedResult.result.result_data.review_status === 'Approved' ? '#10b981' : selectedResult.result.result_data.review_status === 'Rejected' ? '#ef4444' : '#f59e0b'
                      }}>
                        {selectedResult.result.result_data.review_status || 'Pending Review'}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                        <button 
                          onClick={() => handleReviewUpdate(selectedResult.result_id || selectedResult.result.id, 'Approved')}
                          disabled={selectedResult.result.result_data.review_status === 'Approved'}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '3px',
                            backgroundColor: selectedResult.result.result_data.review_status === 'Approved' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: selectedResult.result.result_data.review_status === 'Approved' ? '#10b981' : '#cfd8dc',
                            cursor: 'pointer'
                          }}
                          title="Approve finding"
                        >
                          <Check size={11} />
                        </button>
                        <button 
                          onClick={() => handleReviewUpdate(selectedResult.result_id || selectedResult.result.id, 'Rejected')}
                          disabled={selectedResult.result.result_data.review_status === 'Rejected'}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '3px',
                            backgroundColor: selectedResult.result.result_data.review_status === 'Rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: selectedResult.result.result_data.review_status === 'Rejected' ? '#ef4444' : '#cfd8dc',
                            cursor: 'pointer'
                          }}
                          title="Reject finding"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* OSINT Lead card */}
                <div style={{
                  padding: '12px',
                  backgroundColor: selectedResult.result.result_data.verification_status === 'Unverified' ? 'rgba(245,158,11,0.05)' : 'rgba(16,185,129,0.05)',
                  border: `1px dashed ${selectedResult.result.result_data.verification_status === 'Unverified' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ fontWeight: 700, color: selectedResult.result.result_data.verification_status === 'Unverified' ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Bot size={14} /> LEAD DIRECTIVE: {selectedResult.result.result_data.lead?.title || 'Indicator Scan Completed'}
                  </div>
                  <p style={{ margin: 0, color: '#f8fafc' }}>
                    {selectedResult.result.result_data.lead?.description || 'No matching correlations compiled.'}
                  </p>
                </div>

                {/* Source Traceability Timeline */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={14} style={{ color: 'var(--secondary)' }} /> Source Traceability ({selectedResult.result.result_data.sources_trace?.length || 0} Records)
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedResult.result.result_data.sources_trace && selectedResult.result.result_data.sources_trace.length > 0 ? (
                      selectedResult.result.result_data.sources_trace.map((trace, idx) => (
                        <div key={idx} style={{
                          padding: '10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{trace.source}</span>
                            <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '2px' }}>
                              Type: {trace.type} • Officer: {trace.investigator}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            {trace.case_ref && trace.case_ref !== 'N/A' && (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--primary)',
                                color: 'var(--primary)',
                                fontFamily: 'var(--font-mono)'
                              }}>
                                Case: {trace.case_ref}
                              </span>
                            )}
                            {trace.reference && trace.reference !== 'Legacy Indicator DB' && trace.reference !== 'Trace Query' && (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--secondary)',
                                color: 'var(--secondary)',
                                fontFamily: 'var(--font-mono)'
                              }}>
                                Ref: {trace.reference}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        border: '1px dashed rgba(255,255,255,0.05)',
                        borderRadius: '6px'
                      }}>
                        No verified database records exist. Result is purely mock OSINT simulation.
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical registry dump */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={14} /> Threat Mapping Details
                  </h4>
                  <pre style={{
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    padding: '14px',
                    fontSize: '0.75rem',
                    color: '#10b981',
                    fontFamily: 'var(--font-mono)',
                    overflowX: 'auto',
                    margin: 0
                  }}>
                    {JSON.stringify(selectedResult.result.result_data, null, 2)}
                  </pre>
                </div>

                {/* Recommendations */}
                {selectedResult.result.result_data?.recommendation && (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px dashed rgba(245,158,11,0.3)', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>ACTIONABLE LEAD RECOMMENDATION:</div>
                    <p style={{ color: '#fbbf24', margin: 0 }}>{selectedResult.result.result_data.recommendation}</p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: '16px' }}>
                <Globe size={48} style={{ opacity: 0.1 }} />
                <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                  <div>Awaiting command instructions...</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px' }}>Execute a new threat trace or select a history log on the left side panel.</div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
