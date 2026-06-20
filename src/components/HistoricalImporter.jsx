import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Search, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { importsApi } from '../services/api';

export default function HistoricalImporter({ apiOnline, onAddAuditLog }) {
  const [activeSubTab, setActiveSubTab] = useState('cases'); // 'cases' | 'entities'
  const [casesList, setCasesList] = useState([]);
  const [entitiesList, setEntitiesList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Load existing historical data
  const loadHistoricalData = async () => {
    setLoading(true);
    setError('');
    try {
      const casesRes = await importsApi.getHistoricalCases();
      const entitiesRes = await importsApi.getHistoricalEntities();
      
      if (casesRes.data?.cases) setCasesList(casesRes.data.cases);
      if (entitiesRes.data?.entities) setEntitiesList(entitiesRes.data.entities);
    } catch (err) {
      setError('Failed to fetch historical database records: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoricalData();
  }, []);

  // Handle Drag Events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Parsing JSON bulk data helper
  const processImportData = async (rawText) => {
    try {
      const parsed = JSON.parse(rawText);
      let cases = [];
      let entities = [];

      if (Array.isArray(parsed)) {
        cases = parsed;
      } else if (parsed.cases) {
        cases = parsed.cases;
        entities = parsed.entities || [];
      } else {
        throw new Error('JSON format invalid. Must be an array of cases, or contain a "cases" array.');
      }

      setLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await importsApi.bulkImport({ cases, entities });
      if (res.data?.success) {
        setSuccessMsg(`Successfully imported ${res.data.cases?.length || 0} cases and ${res.data.entities?.length || 0} entities to Threat Matrix directory.`);
        onAddAuditLog(`Imported ${res.data.cases?.length || 0} historical cases via bulk upload`);
        await loadHistoricalData();
      } else {
        throw new Error(res.error || 'Bulk ingestion rejected by server');
      }
    } catch (err) {
      setError('File Ingestion Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse CSV bulk data helper
  const processCsvData = async (rawText) => {
    try {
      const lines = rawText.split('\n');
      if (lines.length < 2) throw new Error('CSV is empty or missing headers');

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const cases = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Match comma separating except inside quotes
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const caseObj = {};
        
        headers.forEach((h, idx) => {
          caseObj[h] = values[idx] || '';
        });

        cases.push({
          id: caseObj.id || caseObj.case_id,
          title: caseObj.title || 'CSV Legacy Case',
          description: caseObj.description || '',
          category: caseObj.category || caseObj.classification || 'General Fraud',
          loss_amount: caseObj.loss_amount ? parseFloat(caseObj.loss_amount) : 0,
          status: caseObj.status || 'Closed'
        });
      }

      setLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await importsApi.bulkImport({ cases, entities: [] });
      if (res.data?.success) {
        setSuccessMsg(`Successfully ingested ${res.data.cases?.length || 0} historical cases via CSV schema.`);
        onAddAuditLog(`Imported ${res.data.cases?.length || 0} historical cases via CSV upload`);
        await loadHistoricalData();
      } else {
        throw new Error(res.error || 'Bulk CSV ingestion rejected');
      }
    } catch (err) {
      setError('CSV Parsing Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Drop & Selection
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (file.name.endsWith('.json')) {
        processImportData(text);
      } else if (file.name.endsWith('.csv')) {
        processCsvData(text);
      } else {
        setError('Unsupported file format. Please upload .json or .csv files.');
      }
    };
    reader.readAsText(file);
  };

  // Search logic
  const filteredCases = casesList.filter(c => 
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEntities = entitiesList.filter(e => 
    e.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.entity_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.details?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="workspace-panel" style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.05em' }}>
            HISTORICAL CASE DOSSIER IMPORTER
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
            Bulk upload local investigation CSV archives and JSON indicator registers to map suspect recurrence.
          </p>
        </div>
        <button 
          onClick={loadHistoricalData} 
          disabled={loading}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh DB
        </button>
      </div>

      {/* Upload zone */}
      <div 
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: dragActive ? '2px dashed var(--primary)' : '2px dashed rgba(255,255,255,0.1)',
          backgroundColor: dragActive ? 'rgba(0,240,255,0.04)' : 'rgba(0,0,0,0.2)',
          borderRadius: '8px',
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          position: 'relative',
          marginBottom: '24px'
        }}
      >
        <input 
          type="file" 
          id="historical-file-upload" 
          accept=".json,.csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <label htmlFor="historical-file-upload" style={{ cursor: 'pointer' }}>
          <Upload size={40} style={{ color: 'var(--primary)', marginBottom: '16px', filter: 'drop-shadow(0 0 8px var(--primary))' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>
            Drag & Drop Investigation File
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
            Supports <code style={{ color: 'var(--secondary)' }}>.json</code> (dossier schema) or <code style={{ color: 'var(--secondary)' }}>.csv</code> case listings
          </p>
        </label>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* Historical Repository list */}
      <div className="card" style={{ padding: '20px' }}>
        {/* Toggle + Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-tertiary)', padding: '2px', borderRadius: '6px' }}>
            <button 
              onClick={() => setActiveSubTab('cases')}
              style={{
                border: 'none',
                padding: '6px 16px',
                borderRadius: '4px',
                backgroundColor: activeSubTab === 'cases' ? 'var(--bg-secondary)' : 'transparent',
                color: activeSubTab === 'cases' ? 'var(--primary)' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Legacy Cases ({casesList.length})
            </button>
            <button 
              onClick={() => setActiveSubTab('entities')}
              style={{
                border: 'none',
                padding: '6px 16px',
                borderRadius: '4px',
                backgroundColor: activeSubTab === 'entities' ? 'var(--bg-secondary)' : 'transparent',
                color: activeSubTab === 'entities' ? 'var(--primary)' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Legacy Suspect Indicators ({entitiesList.length})
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input 
              type="text"
              placeholder={`Search legacy ${activeSubTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.8rem'
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
          </div>
        </div>

        {/* Database Table */}
        <div style={{ overflowX: 'auto' }}>
          {activeSubTab === 'cases' ? (
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>CASE ID</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>TITLE</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>CATEGORY</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>LOSS AMOUNT</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.length > 0 ? (
                  filteredCases.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>{c.id}</td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: '#f8fafc' }}>
                        <div>{c.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{c.description}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem' }}>
                        <span className="badge badge-info">{c.category || 'General'}</span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                        ₹{parseFloat(c.loss_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem' }}>
                        <span className="badge badge-success">{c.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.8rem' }}>
                      No legacy case records match your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>LEGACY CASE ID</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>TYPE</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>VALUE</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>RISK RATING</th>
                  <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#64748b' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntities.length > 0 ? (
                  filteredEntities.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>{e.case_id}</td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem' }}>
                        <span className="badge badge-info">{e.entity_type}</span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', fontWeight: 'bold', color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{e.entity_value}</td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem' }}>
                        <span className={`badge ${
                          e.risk_score === 'Critical' ? 'badge-critical' :
                          e.risk_score === 'High' ? 'badge-high' :
                          e.risk_score === 'Medium' ? 'badge-medium' : 'badge-low'
                        }`}>{e.risk_score}</span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: '#94a3b8' }}>{e.details || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.8rem' }}>
                      No legacy suspect indicators match your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
