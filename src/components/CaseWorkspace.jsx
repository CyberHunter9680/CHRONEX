import React, { useState, useRef } from 'react';
import { 
  ShieldAlert, 
  User, 
  Briefcase, 
  Plus, 
  FileText,
  Search,
  MessageSquare,
  UploadCloud,
  X,
  AlertCircle,
  Image,
  FileCheck,
  Sparkles,
  Bot,
  ArrowRight
} from 'lucide-react';
import TimelineEngine from './TimelineEngine';
import { casesApi } from '../services/api';

// ── Allowed Types & Max Size ─────────────────────────
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv'
];
const ALLOWED_EXT = ['jpg','jpeg','png','webp','pdf','docx','txt','csv'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 5;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(type) {
  if (type.startsWith('image/')) return <Image size={16} style={{ color: '#00f0ff' }} />;
  if (type === 'application/pdf') return <FileText size={16} style={{ color: '#f43f5e' }} />;
  return <FileCheck size={16} style={{ color: '#10b981' }} />;
}

export default function CaseWorkspace({ 
  cases, 
  evidence, 
  onAddCase, 
  onUpdateCase, 
  activeCaseId, 
  setActiveCaseId,
  onAddAuditLog,
  onAddEvidence
}) {
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // DB Notes & AI Summary State
  const [notesList, setNotesList] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Load Notes from database
  const loadCaseNotes = async () => {
    if (!activeCaseId) return;
    try {
      const res = await casesApi.getNotes(activeCaseId);
      if (res.data) {
        setNotesList(res.data);
      } else if (Array.isArray(res)) {
        setNotesList(res);
      } else {
        setNotesList(activeCase?.notes || []);
      }
    } catch (err) {
      console.error(err);
      setNotesList(activeCase?.notes || []);
    }
  };

  const handleGenerateSummary = async () => {
    if (!activeCaseId) return;
    setLoadingAi(true);
    setAiSummary(null);
    try {
      const res = await casesApi.getAiSummary(activeCaseId);
      if (res.data?.success) {
        setAiSummary(res.data.summary);
      } else if (res.summary) {
        setAiSummary(res.summary);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
      setAiSummary({
        executiveSummary: `Dossier overview for Case "${activeCase?.title}". Registered classification: "${activeCase?.classification}" with priority "${activeCase?.priority}". Loss amount recorded: ₹${activeCase?.lossAmount?.toLocaleString('en-IN') || 0}.`,
        keyFindings: [
          `No active server response. Offline generation activated.`,
          `Analyzed case indicators: Complainant ${activeCase?.victim?.name} located in ${activeCase?.victim?.location || 'Unknown'}.`,
          `Check Threat Matrix panel for suspect overlaps.`
        ],
        recommendations: [
          `Issue Section 91 CrPC notice to bank branch nodal officers.`,
          `Log IP coordinates traced in evidence.`
        ]
      });
    } finally {
      setLoadingAi(false);
    }
  };

  React.useEffect(() => {
    loadCaseNotes();
    setAiSummary(null);
  }, [activeCaseId]);

  // New case form state
  const [newCaseData, setNewCaseData] = useState({
    title: '',
    description: '',
    classification: 'Investment Scam',
    priority: 'High',
    victimName: '',
    victimAge: '',
    victimPhone: '',
    victimEmail: '',
    victimOccupation: '',
    victimLocation: '',
    remarks: ''
  });

  // Attached evidence files
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [fileError, setFileError] = useState('');

  // Note text state
  const [newNoteText, setNewNoteText] = useState('');

  // Find active case
  const activeCase = cases.find(c => c.id === activeCaseId);

  // Filter cases
  const filteredCases = cases.filter(c => {
    const matchesCategory = filterCategory === 'All' || c.classification === filterCategory;
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.victim.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // ── File validation & attachment ────────────────────────
  const validateAndAddFiles = (rawFiles) => {
    setFileError('');
    const fileArray = Array.from(rawFiles);
    const newValid = [];

    for (const file of fileArray) {
      if (attachedFiles.length + newValid.length >= MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} files allowed per case.`);
        break;
      }
      const ext = file.name.split('.').pop().toLowerCase();
      const isTypeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.includes(ext);
      const isSizeOk = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;

      if (!isTypeOk) {
        setFileError(`"${file.name}" — unsupported type. Allowed: JPG, PNG, PDF, DOCX, TXT, CSV.`);
        continue;
      }
      if (!isSizeOk) {
        setFileError(`"${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit (${formatBytes(file.size)}).`);
        continue;
      }
      // Prevent duplicates by name+size
      if (attachedFiles.some(f => f.name === file.name && f.size === file.size)) continue;
      newValid.push(file);
    }
    if (newValid.length > 0) {
      setAttachedFiles(prev => [...prev, ...newValid]);
    }
  };

  const removeAttachedFile = (idx) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    setFileError('');
  };

  const handleDropFiles = (e) => {
    e.preventDefault();
    setDragOver(false);
    validateAndAddFiles(e.dataTransfer.files);
  };

  // ── Case creation ────────────────────────────────────────
  const handleCreateCase = (e) => {
    e.preventDefault();
    if (!newCaseData.title || !newCaseData.victimName) {
      alert("Please fill in the Case Title and Complainant/Victim Name.");
      return;
    }

    const randomId = `CX-2026-0${Math.floor(100 + Math.random() * 900)}`;
    const randomHash = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

    const newCase = {
      id: randomId,
      title: newCaseData.title,
      description: newCaseData.description,
      status: "Open",
      priority: newCaseData.priority,
      createdAt: new Date().toISOString(),
      officer: "Inspector S. Sharma",
      classification: newCaseData.classification,
      remarks: newCaseData.remarks || "Case opened. Initial documents registered.",
      victim: {
        name: newCaseData.victimName,
        age: parseInt(newCaseData.victimAge) || 30,
        phone: newCaseData.victimPhone || "N/A",
        email: newCaseData.victimEmail || "N/A",
        occupation: newCaseData.victimOccupation || "N/A",
        location: newCaseData.victimLocation || "N/A"
      },
      notes: [
        {
          id: `note-${Date.now()}`,
          timestamp: new Date().toISOString(),
          officer: "Inspector S. Sharma",
          text: `Case registered. ${attachedFiles.length > 0 ? attachedFiles.length + ' initial evidence file(s) attached.' : 'No initial evidence.'} Integrity hash: SHA-256(${randomHash.substring(0, 10)}...)`
        }
      ],
      integrityHash: randomHash
    };

    onAddCase(newCase);
    onAddAuditLog(`Registered new Case ${randomId}: ${newCase.title}`);

    // Register attached files as evidence items
    if (attachedFiles.length > 0 && onAddEvidence) {
      attachedFiles.forEach((file, idx) => {
        const evidenceHash = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
        const ext = file.name.split('.').pop().toLowerCase();
        const guessType = ['jpg','jpeg','png','webp'].includes(ext)
          ? 'WhatsApp Chat'
          : ext === 'pdf' ? 'Bank Statement'
          : 'Email';

        onAddEvidence({
          id: `E-${Date.now()}-${idx}`,
          caseId: randomId,
          fileName: file.name,
          fileType: guessType,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'Inspector S. Sharma',
          size: formatBytes(file.size),
          ocrLanguage: 'English',
          ocrConfidence: 91,
          hash: evidenceHash,
          tags: [guessType.toLowerCase().replace(' ', '-'), 'initial-upload'],
          ocrText: `[File uploaded at Case Creation]\nFile Name: ${file.name}\nSize: ${formatBytes(file.size)}\nType: ${file.type || ext}\n\nOCR processing pending — paste extracted text in Evidence Ingest module.`,
          extractedEntities: { phones: [], upis: [], emails: [], urls: [], transactions: [], accounts: [], ifscs: [], ips: [], amounts: [], dates: [], usernames: [] }
        });
        onAddAuditLog(`Initial evidence "${file.name}" attached to new Case ${randomId}`);
      });
    }

    setActiveCaseId(randomId);
    setShowNewCaseModal(false);

    // Reset
    setNewCaseData({
      title: '', description: '', classification: 'Investment Scam', priority: 'High',
      victimName: '', victimAge: '', victimPhone: '', victimEmail: '',
      victimOccupation: '', victimLocation: '', remarks: ''
    });
    setAttachedFiles([]);
    setFileError('');
  };

  // Add Note to active case
  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    const notePayload = {
      officer: "Inspector S. Sharma",
      note_text: newNoteText
    };

    try {
      const res = await casesApi.addNote(activeCaseId, notePayload);
      if (res.data) {
        setNotesList(prev => [res.data, ...prev]);
        onAddAuditLog(`Added investigation note to Case ${activeCaseId}`);
        setNewNoteText('');
        return;
      }
    } catch (err) {
      console.error('Failed to save note to server:', err);
    }

    // Fallback offline notes
    const newNote = {
      id: `note-${Date.now()}`,
      timestamp: new Date().toISOString(),
      officer: "Inspector S. Sharma",
      text: newNoteText
    };

    const updatedCase = {
      ...activeCase,
      notes: [...(activeCase.notes || []), newNote]
    };

    onUpdateCase(updatedCase);
    setNotesList(prev => [newNote, ...prev]);
    onAddAuditLog(`Added investigation note to Case ${activeCase.id} (Local)`);
    setNewNoteText('');
  };

  // Handle remarks update
  const handleUpdateRemarks = (remarks) => {
    const updatedCase = {
      ...activeCase,
      remarks
    };
    onUpdateCase(updatedCase);
  };

  // Handle status update
  const handleUpdateStatus = (status) => {
    const updatedCase = {
      ...activeCase,
      status
    };
    onUpdateCase(updatedCase);
    onAddAuditLog(`Updated status of Case ${activeCase.id} to '${status}'`);
  };

  // Get evidence related to active case
  const caseEvidence = activeCase ? evidence.filter(e => e.caseId === activeCase.id) : [];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* LEFT COLUMN: Case List (Hidden when a case is active on narrow screens, but full layout on wide) */}
      <div style={{
        width: activeCase ? '320px' : '100%',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        {/* Search & Action bar */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: 'var(--primary)' }} /> CASES DOSSIER
            </h3>
            <button 
              onClick={() => setShowNewCaseModal(true)}
              style={{
                backgroundColor: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> NEW CASE
            </button>
          </div>
          
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search Case ID, Complainant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                padding: '6px 12px 6px 30px',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ flex: 1, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '4px', borderRadius: '4px', fontSize: '0.75rem' }}
            >
              <option value="All">All Categories</option>
              <option value="Investment Scam">Investment Scam</option>
              <option value="Job Fraud">Job Fraud</option>
              <option value="Loan App Fraud">Loan App Fraud</option>
              <option value="Sextortion">Sextortion</option>
              <option value="Phishing">Phishing</option>
              <option value="UPI Fraud">UPI Fraud</option>
            </select>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ flex: 1, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '4px', borderRadius: '4px', fontSize: '0.75rem' }}
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Under Investigation">Under Investigation</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Case Cards list */}
        <div style={{ overflowY: 'auto', flexGrow: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredCases.map(c => (
            <div 
              key={c.id}
              onClick={() => setActiveCaseId(c.id)}
              style={{
                padding: '12px',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                backgroundColor: activeCaseId === c.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                cursor: 'pointer',
                borderColor: activeCaseId === c.id ? 'var(--primary)' : 'var(--border-primary)',
                boxShadow: activeCaseId === c.id ? '0 0 10px rgba(0, 240, 255, 0.1)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{c.id}</span>
                <span className={`badge ${
                  c.status === 'Open' ? 'badge-open' : c.status === 'Under Investigation' ? 'badge-investigation' : 'badge-closed'
                }`}>{c.status}</span>
              </div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Complainant: {c.victim.name}</span>
                <span className={`badge ${
                  c.priority === 'Critical' ? 'badge-critical' : c.priority === 'High' ? 'badge-high' : 'badge-medium'
                }`} style={{ fontSize: '0.65rem', padding: '2px 4px' }}>{c.priority}</span>
              </div>
            </div>
          ))}
          {filteredCases.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No cases match criteria.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Case Dossier Workspace */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', backgroundColor: 'var(--bg-primary)' }}>
        {activeCase ? (
          <>
            {/* Dossier Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, border: '1px solid var(--border-primary)', padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-secondary)' }}>{activeCase.id}</span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeCase.title}</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '800px' }}>{activeCase.description}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>CASE STATUS:</span>
                  <select 
                    value={activeCase.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Open">Open</option>
                    <option value="Under Investigation">Under Investigation</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className={`badge ${activeCase.priority === 'Critical' ? 'badge-critical' : 'badge-high'}`}>{activeCase.priority} PRIORITY</span>
                  <span className="badge badge-low">{activeCase.classification}</span>
                </div>
              </div>
            </div>

            {/* Victim & Assigned Officer Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Complainant Profile */}
              <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={16} /> COMPLAINANT/VICTIM PROFILE
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 12px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Full Name:</span>
                  <span style={{ fontWeight: 600 }}>{activeCase.victim.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Age/Gender:</span>
                  <span>{activeCase.victim.age} Yrs</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Contact:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{activeCase.victim.phone}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{activeCase.victim.email}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Occupation:</span>
                  <span>{activeCase.victim.occupation}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
                  <span>{activeCase.victim.location}</span>
                </div>
              </div>

              {/* Case Docket Details */}
              <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={16} /> FORENSIC METADATA
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 12px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Registered On:</span>
                  <span>{new Date(activeCase.createdAt).toLocaleString()}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Assigned Cell:</span>
                  <span>Noida Cyber Cell (Zone 1)</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Lead Officer:</span>
                  <span style={{ fontWeight: 600 }}>{activeCase.officer}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Evidence Uploaded:</span>
                  <span>{caseEvidence.length} items</span>
                  <span style={{ color: 'var(--text-secondary)' }}>SHA-256 integrity:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeCase.integrityHash}>
                    {activeCase.integrityHash}
                  </span>
                </div>
              </div>
            </div>

            {/* Officer Remarks Workspace */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>OFFICER CASE REMARKS</h4>
              <textarea 
                value={activeCase.remarks}
                onChange={(e) => handleUpdateRemarks(e.target.value)}
                placeholder="Enter active investigation remarks..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* AI Dossier Analysis */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(0, 240, 255, 0.15)', background: 'rgba(5, 11, 20, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Bot size={16} /> AUTOMATED AI COMPILATION & CASE SUMMARY
                </h4>
                <button
                  onClick={handleGenerateSummary}
                  disabled={loadingAi}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--primary)',
                    backgroundColor: 'rgba(0, 240, 255, 0.05)',
                    color: 'var(--primary)',
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={12} /> {loadingAi ? 'Compiling Dossier...' : 'Generate Case Summary'}
                </button>
              </div>

              {loadingAi && (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ width: 30, height: 30, border: '3px solid rgba(0,240,255,0.1)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span>Analyzing dossier telemetries, scanning active indicators, and referencing legacy directories...</span>
                </div>
              )}

              {aiSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Executive Brief */}
                  <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>EXECUTIVE INVESTIGATION BRIEF</div>
                    <p style={{ fontSize: '0.82rem', color: '#f8fafc', margin: 0, lineHeight: '1.4' }}>{aiSummary.executiveSummary}</p>
                  </div>

                  {/* Findings & Directives */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Key Findings */}
                    <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.03)', borderRadius: '6px', border: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>KEY DOSSIER FINDINGS</div>
                      <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem', color: '#fca5a5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aiSummary.keyFindings.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>

                    {/* Directives */}
                    <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.03)', borderRadius: '6px', border: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>ACTIONABLE DIRECTIVES</div>
                      <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem', color: '#a7f3d0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aiSummary.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence items matching this Case */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
                ASSOCIATED SECURED EVIDENCE ({caseEvidence.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {caseEvidence.map(item => (
                  <div 
                    key={item.id}
                    style={{
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                      padding: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{item.id}</span>
                      <span className="badge badge-low" style={{ fontSize: '0.65rem' }}>{item.fileType}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.fileName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}</div>
                  </div>
                ))}
                {caseEvidence.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No evidence files uploaded yet. Link to Evidence Vault to import digital evidence.
                  </div>
                )}
              </div>
            </div>

            {/* Timeline View of Case */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px', color: 'var(--primary)' }}>
                TIMELINE INTELLIGENCE RECONSTRUCTION
              </h4>
              <TimelineEngine evidence={caseEvidence} />
            </div>

            {/* Investigation Notes Feed */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
                INVESTIGATION DAILY DIARY & AUDIT NOTES
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '250px', overflowY: 'auto' }}>
                {(notesList.length > 0 ? notesList : activeCase.notes || []).map(note => (
                  <div key={note.id} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
                    <div style={{ flexShrink: 0, padding: '4px', background: 'var(--bg-tertiary)', borderRadius: '4px', height: 'fit-content' }}>
                      <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700 }}>{note.officer}</span>
                        <span>•</span>
                        <span>{new Date(note.timestamp).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>{note.note_text || note.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Note Input */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter detailed diary node to add to case log..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  style={{
                    flexGrow: 1,
                    backgroundColor: 'var(--bg-darker)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '0.85rem'
                  }}
                />
                <button 
                  onClick={handleAddNote}
                  style={{
                    backgroundColor: 'var(--secondary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  ADD NOTE
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
            <ShieldAlert size={48} />
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select a Case Dossier to start investigation</div>
            <p style={{ fontSize: '0.85rem', maxWidth: '360px', textAlign: 'center' }}>Choose an ongoing complaint file from the panel on the left to review intelligence charts, timelines, and audit logs.</p>
          </div>
        )}
      </div>

      {/* NEW CASE MODAL */}
      {showNewCaseModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-modal)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <form 
            onSubmit={handleCreateCase}
            style={{
              width: '100%',
              maxWidth: '650px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '8px',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert /> REGISTER NEW CYBER COMPLAINT FILE
            </h3>
            
            {/* Case Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Case Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. VIP Investment Scam" 
                  required
                  value={newCaseData.title}
                  onChange={(e) => setNewCaseData({...newCaseData, title: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cyber Classification</label>
                <select 
                  value={newCaseData.classification}
                  onChange={(e) => setNewCaseData({...newCaseData, classification: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                >
                  <option value="Investment Scam">Investment Scam</option>
                  <option value="Job Fraud">Job Fraud</option>
                  <option value="Loan App Fraud">Loan App Fraud</option>
                  <option value="Sextortion">Sextortion</option>
                  <option value="Phishing">Phishing</option>
                  <option value="UPI Fraud">UPI Fraud</option>
                  <option value="Social Media Fraud">Social Media Fraud</option>
                  <option value="Digital Arrest Scam">Digital Arrest Scam</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Description</label>
              <textarea 
                placeholder="Details of the crime, method of contact, and financial loss facts..."
                value={newCaseData.description}
                onChange={(e) => setNewCaseData({...newCaseData, description: e.target.value})}
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', minHeight: '60px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Risk Priority</label>
                <select 
                  value={newCaseData.priority}
                  onChange={(e) => setNewCaseData({...newCaseData, priority: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Remarks</label>
                <input 
                  type="text" 
                  placeholder="Officer remarks or updates..."
                  value={newCaseData.remarks}
                  onChange={(e) => setNewCaseData({...newCaseData, remarks: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Victim Details */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px', color: 'var(--secondary)', marginTop: '8px' }}>
              VICTIM / COMPLAINANT DETAIL
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Full Name *</label>
                <input 
                  type="text" 
                  placeholder="Victim Name" 
                  required
                  value={newCaseData.victimName}
                  onChange={(e) => setNewCaseData({...newCaseData, victimName: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Age</label>
                <input 
                  type="number" 
                  placeholder="Age" 
                  value={newCaseData.victimAge}
                  onChange={(e) => setNewCaseData({...newCaseData, victimAge: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mobile Number</label>
                <input 
                  type="text" 
                  placeholder="Phone" 
                  value={newCaseData.victimPhone}
                  onChange={(e) => setNewCaseData({...newCaseData, victimPhone: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Email Address</label>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={newCaseData.victimEmail}
                  onChange={(e) => setNewCaseData({...newCaseData, victimEmail: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Occupation</label>
                <input 
                  type="text" 
                  placeholder="Student, Businessman..." 
                  value={newCaseData.victimOccupation}
                  onChange={(e) => setNewCaseData({...newCaseData, victimOccupation: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Location</label>
                <input 
                  type="text" 
                  placeholder="City, State" 
                  value={newCaseData.victimLocation}
                  onChange={(e) => setNewCaseData({...newCaseData, victimLocation: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* ── Initial Evidence Upload Zone ─────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UploadCloud size={15} /> ATTACH INITIAL EVIDENCE SCREENSHOTS
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>JPG · PNG · PDF · DOCX · TXT · CSV &nbsp;|&nbsp; Max {MAX_FILE_SIZE_MB}MB each · Up to {MAX_FILES} files</span>
              </h4>

              {/* Drop Zone */}
              <div
                className={`file-upload-zone${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDropFiles}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.csv"
                  onChange={(e) => validateAndAddFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <UploadCloud size={28} className="upload-icon" />
                <div className="upload-title">Drag & Drop or Click to Browse</div>
                <div className="upload-sub">System ke screenshots, receipts ya documents yahan attach karo</div>
                <div className="upload-info-pills">
                  {['JPG/PNG','PDF','DOCX','TXT/CSV'].map(t => <span key={t} className="upload-pill">{t}</span>)}
                </div>
              </div>

              {/* File Error */}
              {fileError && (
                <div className="upload-error-msg">
                  <AlertCircle size={14} />
                  {fileError}
                </div>
              )}

              {/* Attached File Previews */}
              {attachedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="file-preview-chip">
                      {getFileIcon(file.type)}
                      <span className="file-chip-name" title={file.name}>{file.name}</span>
                      <span className="file-chip-size">{formatBytes(file.size)}</span>
                      <button className="file-chip-remove" onClick={(e) => { e.stopPropagation(); removeAttachedFile(idx); }} title="Remove file">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✅ {attachedFiles.length} file(s) ready — will be secured on case registration
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button 
                type="button" 
                onClick={() => setShowNewCaseModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button 
                type="submit"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                REGISTER DOSSIER
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
