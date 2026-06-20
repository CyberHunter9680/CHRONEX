import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  FolderGit, 
  Share2, 
  Database, 
  AlertTriangle, 
  FileText, 
  Lock, 
  Shield, 
  UserCheck,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  RefreshCw,
  Import,
  Radar
} from 'lucide-react';

import { 
  casesApi, 
  evidenceApi, 
  entitiesApi, 
  alertsApi, 
  auditApi,
  reportsApi,
  checkServerHealth,
  isServerOnline
} from './services/api';

import { 
  initialCases, 
  initialEvidence, 
  initialEntities, 
  initialAlerts, 
  initialAuditLogs 
} from './data/mockData';

import Dashboard from './components/Dashboard';
import CaseWorkspace from './components/CaseWorkspace';
import EvidenceVault from './components/EvidenceVault';
import LinkAnalysis from './components/LinkAnalysis';
import IntelligenceDatabase from './components/IntelligenceDatabase';
import AlertsCenter from './components/AlertsCenter';
import ReportGenerator from './components/ReportGenerator';
import SecurityAudit from './components/SecurityAudit';
import HistoricalImporter from './components/HistoricalImporter';
import OsintWorkspace from './components/OsintWorkspace';
import LoginScreen from './components/LoginScreen';
import { authApi } from './services/api';


// ─── Map API response fields → frontend field names ───────────────
function normalizeCase(c) {
  if (!c) return c;
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    priority: c.priority,
    classification: c.classification,
    victim: {
      name: c.victim_name,
      age: c.victim_age,
      phone: c.victim_phone,
      email: c.victim_email,
      occupation: c.victim_occupation,
      location: c.victim_location,
    },
    victimName: c.victim_name,
    victimAge: c.victim_age,
    victimPhone: c.victim_phone,
    victimEmail: c.victim_email,
    victimOccupation: c.victim_occupation,
    victimLocation: c.victim_location,
    firNumber: c.fir_number,
    complaintNumber: c.complaint_number,
    assignedOfficer: c.assigned_officer,
    assignedCell: c.assigned_cell,
    lossAmount: c.loss_amount,
    remarks: c.remarks,
    notes: c.notes || [],
    createdAt: c.created_at,
    // keep originals too for API calls
    victim_name: c.victim_name,
    victim_age: c.victim_age,
    victim_phone: c.victim_phone,
    victim_email: c.victim_email,
    victim_occupation: c.victim_occupation,
    victim_location: c.victim_location,
    fir_number: c.fir_number,
    complaint_number: c.complaint_number,
    assigned_officer: c.assigned_officer,
    assigned_cell: c.assigned_cell,
    loss_amount: c.loss_amount,
    created_at: c.created_at,
  };
}

function normalizeEvidence(e) {
  if (!e) return e;
  return {
    id: e.id,
    caseId: e.case_id,
    fileName: e.file_name,
    fileType: e.file_type,
    fileSize: e.file_size,
    uploadedBy: e.uploaded_by,
    sha256Hash: e.sha256_hash,
    ocrText: e.ocr_text || '',
    ocrConfidence: e.ocr_confidence || 0,
    ocrLanguage: e.ocr_language,
    tags: Array.isArray(e.tags) ? e.tags : [],
    uploadedAt: e.uploaded_at,
    filePath: e.file_path,
    extractedEntities: e.extractedEntities || {
      phones: [], upis: [], emails: [], accounts: [], ips: [], amounts: [], urls: []
    },
    // keep originals
    case_id: e.case_id,
    file_name: e.file_name,
    file_type: e.file_type,
    file_size: e.file_size,
    uploaded_by: e.uploaded_by,
    sha256_hash: e.sha256_hash,
    ocr_text: e.ocr_text,
    ocr_confidence: e.ocr_confidence,
    uploaded_at: e.uploaded_at,
  };
}

function normalizeEntity(e) {
  if (!e) return e;
  return {
    id: e.id,
    type: e.entity_type,
    value: e.entity_value,
    riskScore: e.risk_score,
    details: e.details,
    casesLinked: e.case_ids || [],
    occurrenceCount: e.occurrence_count || 1,
    entity_type: e.entity_type,
    entity_value: e.entity_value,
    risk_score: e.risk_score,
  };
}

function normalizeAlert(a) {
  if (!a) return a;
  let cases = a.cases;
  if (typeof cases === 'string') {
    try { cases = JSON.parse(cases); } catch { cases = []; }
  }
  return {
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    description: a.description,
    entityType: a.entity_type,
    entityValue: a.entity_value,
    cases: cases || [],
    resolved: a.resolved || false,
    timestamp: a.timestamp,
  };
}

function normalizeAuditLog(l) {
  return {
    id: l.id?.toString(),
    timestamp: l.timestamp,
    officer: l.username,
    action: l.action,
    ipAddress: l.ip_address,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // ─── Data State ───────────────────────────────────────────────────
  const [cases, setCases] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [entities, setEntities] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState('');

  // ─── API Status ───────────────────────────────────────────────────
  const [apiOnline, setApiOnline] = useState(null); // null=checking
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ─── THEME STATE ──────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('chronex-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chronex-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // ─── Officer Session & Secure Auth ────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [activeOfficer, setActiveOfficer] = useState({
    name: 'Inspector S. Sharma',
    role: 'Investigator',
    badge: 'IPS-89240',
    district: 'Noida Cyber Cell'
  });

  const [sessionTime, setSessionTime] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSessionTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSessionTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleLogout = useCallback(async (reason = '') => {
    try {
      await authApi.logout();
    } catch (e) {
      console.warn('Logout endpoint failed:', e);
    }
    localStorage.removeItem('chronex_token');
    setCurrentUser(null);
    if (reason) {
      alert(reason);
    }
  }, []);

  // Fetch session on mount
  useEffect(() => {
    const token = localStorage.getItem('chronex_token');
    if (token) {
      authApi.getSession().then(res => {
        if (res.data?.user) {
          setCurrentUser(res.data.user);
          setActiveOfficer({
            name: res.data.user.name,
            role: res.data.user.role,
            badge: res.data.user.badge || 'IPS-89240',
            district: res.data.user.district || 'Noida Cyber Cell'
          });
        } else {
          localStorage.removeItem('chronex_token');
        }
      }).catch(() => {
        localStorage.removeItem('chronex_token');
      });
    }
  }, []);

  // Inactivity Auto-Logout (15 minutes)
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout('Security Session Expired: Closed due to 15 minutes of inactivity.');
      }, 15 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [currentUser, handleLogout]);

  // Tab Authorization Rule Gate
  const hasTabPermission = (tab, role) => {
    if (!role) return false;
    if (role === 'SUPER ADMIN') return true;
    if (role === 'SP') return true;
    
    switch (tab) {
      case 'dashboard':
      case 'cases':
      case 'evidence':
      case 'link-analysis':
      case 'entities':
        return true;
      case 'historical-importer':
        return ['CYBER CELL INCHARGE'].includes(role);
      case 'osint-workspace':
      case 'alerts':
      case 'report':
        return ['CYBER CELL INCHARGE', 'INVESTIGATION OFFICER', 'ANALYST'].includes(role);
      case 'audit':
        return false;
      default:
        return false;
    }
  };


  // ─── Initial Data Load ────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    const online = await checkServerHealth();
    setApiOnline(online);

    if (!online) {
      // Fallback to mock data
      setCases(initialCases);
      setEvidence(initialEvidence);
      setEntities(initialEntities);
      setAlerts(initialAlerts);
      setAuditLogs(initialAuditLogs);
      setIsLoading(false);
      return;
    }

    try {
      // Load all data in parallel from backend
      const [casesRes, evidenceRes, entitiesRes, alertsRes, auditRes] = await Promise.all([
        casesApi.getAll(),
        evidenceApi.getAll(),
        entitiesApi.getAll(),
        alertsApi.getAll(),
        auditApi.getLogs(),
      ]);

      if (casesRes.data?.cases) setCases(casesRes.data.cases.map(normalizeCase));
      else setCases(initialCases);

      if (evidenceRes.data?.evidence) setEvidence(evidenceRes.data.evidence.map(normalizeEvidence));
      else setEvidence(initialEvidence);

      if (entitiesRes.data?.entities) setEntities(entitiesRes.data.entities.map(normalizeEntity));
      else setEntities(initialEntities);

      if (alertsRes.data?.alerts) setAlerts(alertsRes.data.alerts.map(normalizeAlert));
      else setAlerts(initialAlerts);

      if (auditRes.data?.logs) setAuditLogs(auditRes.data.logs.map(normalizeAuditLog));
      else setAuditLogs(initialAuditLogs);

    } catch (err) {
      setLoadError(err.message);
      // Fall back to mock data on error
      setCases(initialCases);
      setEvidence(initialEvidence);
      setEntities(initialEntities);
      setAlerts(initialAlerts);
      setAuditLogs(initialAuditLogs);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ─── Audit Logging ────────────────────────────────────────────────
  const handleAddAuditLog = useCallback(async (action) => {
    const newLog = {
      id: `L-${Date.now()}`,
      timestamp: new Date().toISOString(),
      officer: activeOfficer.name,
      action,
      ipAddress: '10.160.22.45'
    };
    setAuditLogs(prev => [newLog, ...prev]);

    // Persist to backend if online
    if (isServerOnline()) {
      await auditApi.log(action, activeOfficer.name, '10.160.22.45');
    }
  }, [activeOfficer.name]);

  // ─── Case Handlers ────────────────────────────────────────────────
  const handleAddCase = useCallback(async (newCase) => {
    if (isServerOnline()) {
      const { data } = await casesApi.create(newCase);
      if (data?.case) {
        setCases(prev => [normalizeCase(data.case), ...prev]);
        handleAddAuditLog(`New case created: ${data.case.id}`);
        return;
      }
    }
    // Offline: apply directly
    setCases(prev => [newCase, ...prev]);
    handleAddAuditLog(`New case created: ${newCase.id}`);
  }, [handleAddAuditLog]);

  const handleUpdateCase = useCallback(async (updatedCase) => {
    if (isServerOnline()) {
      await casesApi.update(updatedCase.id, updatedCase);
    }
    setCases(prev => prev.map(c => c.id === updatedCase.id ? { ...c, ...updatedCase } : c));
  }, []);

  // ─── Evidence Handlers ────────────────────────────────────────────
  const handleAddEvidence = useCallback((newEvidence) => {
    setEvidence(prev => [newEvidence, ...prev]);

    // Extract entities from OCR text and register/correlate them
    const extracted = newEvidence.extractedEntities || {};
    const allEntities = [
      ...(extracted.phones || []).map(v => ({ type: 'Mobile Number', value: v })),
      ...(extracted.upis || []).map(v => ({ type: 'UPI ID', value: v })),
      ...(extracted.emails || []).map(v => ({ type: 'Email Address', value: v })),
      ...(extracted.accounts || []).map(v => ({ type: 'Bank Account', value: v })),
      ...(extracted.ips || []).map(v => ({ type: 'IP Address', value: v })),
    ];

    setEntities(prev => {
      const updated = [...prev];
      const newAlerts = [];

      for (const ent of allEntities) {
        const existIdx = updated.findIndex(
          e => e.value?.toLowerCase() === ent.value?.toLowerCase() && e.type === ent.type
        );

        if (existIdx !== -1) {
          // Entity already exists — check if it's from a different case
          if (!updated[existIdx].casesLinked?.includes(newEvidence.caseId)) {
            updated[existIdx] = {
              ...updated[existIdx],
              casesLinked: [...(updated[existIdx].casesLinked || []), newEvidence.caseId]
            };
            // Trigger multi-case alert
            const alert = {
              id: `A-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
              type: 'cross_case_correlation',
              severity: 'Critical',
              title: `Multi-Case ${ent.type} Match`,
              description: `Entity "${ent.value}" (${ent.type}) found in Case ${newEvidence.caseId} matches existing records in: ${updated[existIdx].casesLinked.join(', ')}.`,
              entityType: ent.type,
              entityValue: ent.value,
              cases: [...(updated[existIdx].casesLinked || []), newEvidence.caseId],
              resolved: false,
              timestamp: new Date().toISOString()
            };
            newAlerts.push(alert);

            if (isServerOnline()) {
              alertsApi.create({
                type: alert.type,
                severity: alert.severity,
                title: alert.title,
                description: alert.description,
                entity_type: ent.type,
                entity_value: ent.value,
                cases: alert.cases
              });
            }
          }
        } else {
          // New entity
          updated.push({
            id: `${ent.type.toLowerCase().replace(/\s/g, '')}_${Date.now()}`,
            type: ent.type,
            value: ent.value,
            riskScore: 'Medium',
            casesLinked: [newEvidence.caseId],
            details: `Extracted from evidence in Case ${newEvidence.caseId}.`,
            entity_type: ent.type,
            entity_value: ent.value,
            risk_score: 'Medium',
          });

          if (isServerOnline()) {
            entitiesApi.create({ entity_type: ent.type, entity_value: ent.value, risk_score: 'Medium' });
          }
        }
      }

      if (newAlerts.length > 0) {
        setAlerts(prevAlerts => [...newAlerts, ...prevAlerts]);
      }

      return updated;
    });
  }, []);

  const handleUploadEvidence = useCallback(async (caseId, file, meta = {}) => {
    if (isServerOnline()) {
      const { data, error } = await evidenceApi.upload(caseId, file, {
        fileType: meta.fileType,
        customText: meta.customText,
        uploadedBy: activeOfficer.name
      });
      if (data) {
        const norm = normalizeEvidence(data);
        setEvidence(prev => [norm, ...prev]);
        
        // Reload alerts and entities to sync backend correlation
        const [alertsRes, entitiesRes] = await Promise.all([
          alertsApi.getAll(),
          entitiesApi.getAll()
        ]);
        if (alertsRes.data?.alerts) setAlerts(alertsRes.data.alerts.map(normalizeAlert));
        if (entitiesRes.data?.entities) setEntities(entitiesRes.data.entities.map(normalizeEntity));
        
        handleAddAuditLog(`Secured evidence file ${norm.id} (status: processing) for Case ${caseId}`);
        return norm;
      } else {
        throw new Error(error || 'Failed to upload evidence');
      }
    } else {
      // Offline fallback: run local simulation
      const randomId = `E-${Math.floor(200 + Math.random() * 800)}`;
      const randomHash = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      const norm = {
        id: randomId,
        caseId,
        fileName: file ? file.name : `manual_text_${Date.now()}.txt`,
        fileType: meta.fileType,
        uploadedAt: new Date().toISOString(),
        uploadedBy: activeOfficer.name,
        fileSize: file ? `${(file.size / 1024).toFixed(1)} KB` : '1 KB',
        ocrLanguage: 'English',
        ocrConfidence: 100,
        sha256Hash: randomHash,
        tags: [meta.fileType.toLowerCase().replace(' ', '-'), 'secured'],
        ocrText: meta.customText || 'No OCR text extracted offline.',
        extractedEntities: { phones: [], upis: [], emails: [], accounts: [], ips: [], amounts: [], urls: [] },
        filePath: file ? `/uploads/${caseId}/${file.name}` : '',
        // keep camelCase and snake_case for consistency
        case_id: caseId,
        file_name: file ? file.name : `manual_text_${Date.now()}.txt`,
        file_type: meta.fileType,
        file_size: file ? `${(file.size / 1024).toFixed(1)} KB` : '1 KB',
        uploaded_by: activeOfficer.name,
        sha256_hash: randomHash,
        ocr_text: meta.customText || 'No OCR text extracted offline.',
        ocr_confidence: 100,
        uploaded_at: new Date().toISOString(),
      };
      
      handleAddEvidence(norm);
      handleAddAuditLog(`Secured offline mock evidence ${randomId} for Case ${caseId}`);
      return norm;
    }
  }, [activeOfficer.name, handleAddEvidence, handleAddAuditLog]);

  const handleUpdateEvidence = useCallback(async (updatedEvidence) => {
    if (isServerOnline()) {
      const { data } = await evidenceApi.updateOcr(updatedEvidence.id, updatedEvidence.ocrText, activeOfficer.name);
      if (data) {
        const norm = normalizeEvidence(data);
        setEvidence(prev => prev.map(e => e.id === updatedEvidence.id ? norm : e));
        
        // Reload alerts and entities to sync re-correlation
        const [alertsRes, entitiesRes] = await Promise.all([
          alertsApi.getAll(),
          entitiesApi.getAll()
        ]);
        if (alertsRes.data?.alerts) setAlerts(alertsRes.data.alerts.map(normalizeAlert));
        if (entitiesRes.data?.entities) setEntities(entitiesRes.data.entities.map(normalizeEntity));
        return;
      }
    }
    setEvidence(prev => prev.map(e => e.id === updatedEvidence.id ? updatedEvidence : e));
  }, [activeOfficer.name]);

  // ─── Alert Handlers ───────────────────────────────────────────────
  const handleResolveAlert = useCallback(async (alertId) => {
    if (isServerOnline()) {
      await alertsApi.resolve(alertId);
    }
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const handleNavigateToCase = useCallback((caseId) => {
    setActiveCaseId(caseId);
    setActiveTab('cases');
  }, []);

  // ─── Sidebar Nav Style ────────────────────────────────────────────
  const navStyle = (tab) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: activeTab === tab ? 'rgba(0,240,255,0.08)' : 'transparent',
    color: activeTab === tab ? 'var(--primary)' : '#94a3b8',
    fontWeight: activeTab === tab ? 700 : 500,
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.2s ease',
    borderLeft: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
  });

  // ─── Loading Screen ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="app-container" data-theme={theme} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px'
      }}>
        <Shield style={{ color: 'var(--primary)', width: 64, height: 64, animation: 'pulse 2s infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.1em' }}>CHRONEX</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>Initializing Investigation Platform...</div>
        </div>
        <div style={{
          width: 240, height: 3, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden'
        }}>
          <div style={{
            height: '100%', width: '60%',
            background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            borderRadius: 4,
            animation: 'shimmer 1.5s infinite'
          }} />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => {
      setCurrentUser(user);
      setActiveOfficer({
        name: user.name,
        role: user.role,
        badge: user.badge || 'IPS-89240',
        district: user.district || 'Noida Cyber Cell'
      });
      // Redirect based on role
      if (user.role === 'SP') {
        setActiveTab('dashboard');
      } else if (user.role === 'CYBER CELL INCHARGE') {
        setActiveTab('dashboard');
      } else if (user.role === 'INVESTIGATION OFFICER') {
        setActiveTab('cases');
      } else if (user.role === 'ANALYST') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('dashboard');
      }
      loadAllData();
    }} />;
  }

  return (

    <div className="app-container" data-theme={theme}>

      {/* ─── SIDEBAR ─────────────────────────────────────────── */}
      <div className="sidebar no-print">

        {/* Brand */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Shield style={{ color: 'var(--primary)', width: '28px', height: '28px', flexShrink: 0 }} />
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.06em' }}>CHRONEX</h1>
            <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cyber Intelligence Cell</span>
          </div>
        </div>

        {/* API Status Banner */}
        <div style={{
          margin: '8px 10px',
          padding: '6px 10px',
          borderRadius: '6px',
          background: apiOnline 
            ? 'rgba(16, 185, 129, 0.1)' 
            : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${apiOnline ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.7rem',
          color: apiOnline ? '#10b981' : '#f59e0b',
          fontWeight: 600
        }}>
          {apiOnline 
            ? <><Wifi size={11} /> API CONNECTED</>
            : <><WifiOff size={11} /> OFFLINE MODE</>
          }
          <button
            onClick={loadAllData}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
            title="Refresh data"
          >
            <RefreshCw size={11} />
          </button>
        </div>

        {/* Nav Items */}
        <div style={{ flexGrow: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {[
            { tab: 'dashboard',      icon: <LayoutDashboard size={16} />, label: 'Command Dashboard' },
            { tab: 'cases',          icon: <ShieldAlert size={16} />,     label: 'Cases Dossier' },
            { tab: 'evidence',       icon: <FolderGit size={16} />,       label: 'Evidence Ingest & OCR' },
            { tab: 'historical-importer', icon: <Import size={16} />,     label: 'Historical Importer' },
            { tab: 'osint-workspace', icon: <Radar size={16} />,          label: 'OSINT Workspace' },
            { tab: 'link-analysis',  icon: <Share2 size={16} />,          label: 'Link Analysis Canvas' },
            { tab: 'entities',       icon: <Database size={16} />,        label: 'Intelligence Directory' },
            { tab: 'alerts',         icon: <AlertTriangle size={16} />,   label: 'Threat Matrix' },
            { tab: 'report',         icon: <FileText size={16} />,        label: 'Docket Export' },
            { tab: 'audit',          icon: <Lock size={16} />,            label: 'Security Governance' },
          ]
          .filter(({ tab }) => hasTabPermission(tab, currentUser?.role))
          .map(({ tab, icon, label }) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={navStyle(tab)}>
              {icon} {label}
              {tab === 'alerts' && alerts.filter(a => !a.resolved && (a.severity === 'Critical' || a.severity === 'High')).length > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--critical)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {alerts.filter(a => !a.resolved && (a.severity === 'Critical' || a.severity === 'High')).length}
                </span>
              )}
            </button>
          ))}

        </div>

        {/* Profile + Theme Toggle */}
        <div className="sidebar-profile" style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backgroundColor: 'rgba(0,0,0,0.3)',
          fontSize: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Officer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00f0ff22, #3b82f622)',
              border: '1px solid rgba(0,240,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <UserCheck size={14} style={{ color: '#10b981' }} />
            </div>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.8rem' }}>{activeOfficer.name}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{activeOfficer.role} • {activeOfficer.badge}</div>
            </div>
            <button
              onClick={() => handleLogout()}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              Logout
            </button>
          </div>


          {/* Session Time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
            <span>Session duration:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{formatSessionTime(sessionTime)}</span>
          </div>

          {/* Dark / Light Toggle */}
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark'
              ? <><Sun size={13} style={{ color: '#fbbf24' }} /> SWITCH TO LIGHT MODE</>
              : <><Moon size={13} style={{ color: '#818cf8' }} /> SWITCH TO DARK MODE</>
            }
          </button>
        </div>

      </div>

      {/* ─── MAIN CONTENT ────────────────────────────────────── */}
      <div className="main-content">

        {activeTab === 'dashboard' && (
          <Dashboard
            cases={cases}
            evidence={evidence}
            entities={entities}
            alerts={alerts}
            onNavigate={setActiveTab}
            apiOnline={apiOnline}
            onRefresh={loadAllData}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'cases' && (
          <CaseWorkspace
            cases={cases}
            evidence={evidence}
            onAddCase={handleAddCase}
            onUpdateCase={handleUpdateCase}
            activeCaseId={activeCaseId}
            setActiveCaseId={setActiveCaseId}
            onAddAuditLog={handleAddAuditLog}
            onAddEvidence={handleAddEvidence}
            apiOnline={apiOnline}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceVault
            evidence={evidence}
            cases={cases}
            onAddEvidence={handleAddEvidence}            onUploadEvidence={handleUploadEvidence}            onUpdateEvidence={handleUpdateEvidence}
            onAddAuditLog={handleAddAuditLog}
            apiOnline={apiOnline}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'link-analysis' && (
          <LinkAnalysis
            cases={cases}
            entities={entities}
            evidence={evidence}
            alerts={alerts}
          />
        )}

        {activeTab === 'entities' && (
          <IntelligenceDatabase
            entities={entities}
            cases={cases}
            evidence={evidence}
            onNavigate={setActiveTab}
            setActiveCaseId={setActiveCaseId}
            apiOnline={apiOnline}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsCenter
            alerts={alerts}
            onResolveAlert={handleResolveAlert}
            onAddAuditLog={handleAddAuditLog}
            apiOnline={apiOnline}
            onRunCorrelation={async () => {
              if (isServerOnline()) {
                const { data } = await alertsApi.runCorrelation();
                if (data?.new_alerts?.length > 0) {
                  const { data: freshAlerts } = await alertsApi.getAll();
                  if (freshAlerts?.alerts) setAlerts(freshAlerts.alerts.map(normalizeAlert));
                }
              }
            }}
          />
        )}

        {activeTab === 'report' && (
          <ReportGenerator
            cases={cases}
            evidence={evidence}
            entities={entities}
            alerts={alerts}
            apiOnline={apiOnline}
            currentUser={currentUser}
            onGenerateReport={async (caseId) => {
              if (isServerOnline()) {
                return reportsApi.generate(caseId, { generated_by: currentUser?.name || currentUser?.username || 'System' });
              }
              return { data: null, error: 'Backend not available' };
            }}
          />
        )}

        {activeTab === 'audit' && (
          <SecurityAudit
            auditLogs={auditLogs}
            evidence={evidence}
            activeOfficer={activeOfficer}
            onChangeOfficer={setActiveOfficer}
            onAddAuditLog={handleAddAuditLog}
            apiOnline={apiOnline}
          />
        )}

        {activeTab === 'historical-importer' && (
          <HistoricalImporter
            apiOnline={apiOnline}
            onAddAuditLog={handleAddAuditLog}
          />
        )}

        {activeTab === 'osint-workspace' && (
          <OsintWorkspace
            apiOnline={apiOnline}
            activeOfficer={activeOfficer}
            onAddAuditLog={handleAddAuditLog}
            currentUser={currentUser}
          />
        )}


      </div>
    </div>
  );
}
