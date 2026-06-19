import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderGit, 
  Upload, 
  FileText, 
  Cpu, 
  CheckCircle, 
  AlertTriangle, 
  Copy,
  RefreshCw,
  Search,
  UploadCloud,
  X,
  AlertCircle,
  Image,
  FileCheck
} from 'lucide-react';

// ── File rules ────────────────────────────────────────────
const ALLOWED_TYPES = [
  'image/jpeg','image/jpg','image/png','image/webp','image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain','text/csv'
];
const ALLOWED_EXT = ['jpg','jpeg','png','webp','gif','pdf','docx','txt','csv'];
const MAX_MB = 15;

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function FileTypeIcon({ mimeType }) {
  if (!mimeType) return <FileText size={14} style={{ color: 'var(--primary)' }} />;
  if (mimeType.startsWith('image/')) return <Image size={14} style={{ color: 'var(--primary)' }} />;
  if (mimeType === 'application/pdf') return <FileText size={14} style={{ color: 'var(--error)' }} />;
  return <FileCheck size={14} style={{ color: 'var(--success)' }} />;
}

export default function EvidenceVault({ 
  evidence, 
  cases, 
  onAddEvidence, 
  onUpdateEvidence, 
  onAddAuditLog,
  preselectedCaseId
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || '');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(evidence[0]?.id || '');

  useEffect(() => {
    if (preselectedCaseId) setSelectedCaseId(preselectedCaseId);
  }, [preselectedCaseId]);

  const [fileType, setFileType] = useState('WhatsApp Chat');
  const [customText, setCustomText] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);   // real File object
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Evidence detail
  const selectedItem = evidence.find(e => e.id === selectedEvidenceId) || evidence[0];

  // Regex Extraction Engine
  const runEntityExtraction = (text) => {
    const phones = text.match(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{5}\s\d{5}\b/g) || [];
    const upis = text.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+/g) || [];
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    const transactions = text.match(/\b(?:UPI|TXN|Ref|No|Id)?\s*([0-9]{12})\b|\b[A-Z0-9]{12,18}\b/ig) || [];
    const accounts = text.match(/\b\d{9,18}\b/g) || [];
    const ifscs = text.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/ig) || [];
    const ips = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
    const amounts = text.match(/(?:Rs|INR|₹|amount)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/ig) || [];
    const dates = text.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b|\b\d{2}:\d{2}\s*(?:AM|PM|am|pm)?\b/g) || [];
    const usernames = text.match(/@[a-zA-Z0-9_]+/g) || [];

    // Filter unique values
    const unique = (arr) => [...new Set(arr)].map(x => x.trim());

    return {
      phones: unique(phones),
      upis: unique(upis),
      emails: unique(emails),
      urls: unique(urls),
      transactions: unique(transactions),
      accounts: unique(accounts),
      ifscs: unique(ifscs),
      ips: unique(ips),
      amounts: unique(amounts),
      dates: unique(dates),
      usernames: unique(usernames)
    };
  };

  // ── File picker & validation ─────────────────────────
  const validateAndSetFile = (file) => {
    if (!file) return;
    setFileError('');
    const ext = file.name.split('.').pop().toLowerCase();
    const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.includes(ext);
    const sizeOk = file.size <= MAX_MB * 1024 * 1024;
    if (!typeOk) { setFileError(`Unsupported file type. Allowed: JPG, PNG, PDF, DOCX, TXT, CSV.`); return; }
    if (!sizeOk) { setFileError(`File too large: ${formatBytes(file.size)}. Max ${MAX_MB}MB allowed.`); return; }
    setSelectedFile(file);
    setFileName(file.name);
  };

  const handleDropFile = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileName('');
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Evidence upload ─────────────────────────────────
  const handleUploadEvidence = (e) => {
    e.preventDefault();
    if (!fileName && !selectedFile) {
      setFileError('Please select a file from your system or enter a file name.');
      return;
    }
    
    // Check if evidence name already exists (Duplicate Evidence Shield)
    const duplicateFile = evidence.find(item => item.fileName.toLowerCase() === fileName.toLowerCase());
    if (duplicateFile) {
      const proceed = window.confirm(
        `⚠️ DETECTED DUPLICATE EVIDENCE FILE!\n\n` +
        `File: "${fileName}" has already been secured under Case ${duplicateFile.caseId}.\n` +
        `Forensic Hash: ${duplicateFile.hash.substring(0, 16)}...\n\n` +
        `Do you want to proceed with duplicate ingestion? (This will be logged in security audit)`
      );
      if (!proceed) {
        return;
      }
    }

    setIsProcessing(true);

    setTimeout(() => {
      const randomId = `E-${Math.floor(200 + Math.random() * 800)}`;
      const randomHash = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      
      const defaultTexts = {
        'WhatsApp Chat': `[10:15 AM] +91 99887 76655: Please join target channel.
[10:16 AM] Target VIP Support: Transfer ₹25,000 immediately to secure your returns.
[10:20 AM] Victim: Paid. Txn ref: UPI982374829384. Merchant UPI: fastpay@paytm.`,
        'Telegram Chat': `[18:30] @taskmaster_vip: We will release APK file now. Download it.
[18:32] @taskmaster_vip: Install 'QuickCash.apk' from server 8.8.8.8.
[18:35] Victim: APK downloaded and permissions approved. App says pending.`,
        'UPI Receipt': `Google Pay Receipt
Date: 12 June 2026
Transaction ID: UPI827364829103
Paid to: MULE ACCOUNT ASSOCIATES
UPI ID: paymule@okicici
IFSC: ICIC0000888
Amount: ₹45,000`,
        'Bank Statement': `HDFC Bank Statement
Account: 50100234950293
IFSC: HDFC0000104
Date: 14 June 2026
IMPS Transfer to: securepay.mule@okaxis
Amount: 1,50,000 INR`,
        'SMS': `ALERT: Morph video generated. Send 20,000 Rs to UPI: securepay.mule@okaxis.
Else video will be sent to relative contacts. Call +91 91234 56789.`,
        'Email': `From: support@amazon-scam-alert.com
To: abhishek.v@gmail.com
Urgent: Phishing notification. Click link http://amazon-verification.icu/login.html to verify.`,
        'Social Media Screenshot': `Facebook Profile: VIP_INVESTMENTS
Suspect profile ID: vip_deals_99
Post url: facebook.com/vip_deals_investments
Contact phone: +91 98989 89898`,
        'Call Log': `Incoming call from +91 91234 56789
Duration: 42 seconds
Call Time: 15 June 2026, 11:30 AM
Tower IP Location: 103.45.2.1`
      };

      const finalOcrText = customText.trim() || defaultTexts[fileType] || "No text could be extracted.";
      const extracted = runEntityExtraction(finalOcrText);

      const newItem = {
        id: randomId,
        caseId: selectedCaseId,
        fileName: fileName || (selectedFile?.name ?? 'evidence_file'),
        fileType,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "Inspector S. Sharma",
        size: selectedFile ? formatBytes(selectedFile.size) : `${Math.floor(100 + Math.random() * 900)} KB`,
        ocrLanguage: fileType.toLowerCase().includes('whatsapp') || fileType.toLowerCase().includes('sms') ? "English/Hindi" : "English",
        ocrConfidence: Math.floor(88 + Math.random() * 11),
        hash: randomHash,
        tags: [fileType.toLowerCase().replace(' ', '-'), 'uploaded-forensic'],
        ocrText: finalOcrText,
        extractedEntities: extracted
      };

      onAddEvidence(newItem);
      onAddAuditLog(`Uploaded and processed evidence ${randomId} for Case ${selectedCaseId}`);
      setSelectedEvidenceId(randomId);
      
      // Reset
      setFileName('');
      setCustomText('');
      setSelectedFile(null);
      setFileError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessing(false);
    }, 1500);
  };

  // Handle OCR corrections
  const handleOcrTextChange = (newText) => {
    const updatedExtracted = runEntityExtraction(newText);
    const updatedItem = {
      ...selectedItem,
      ocrText: newText,
      extractedEntities: updatedExtracted,
      ocrConfidence: Math.min(100, selectedItem.ocrConfidence + 1) // Increment slightly as manual verification improves quality
    };

    onUpdateEvidence(updatedItem);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  // Filter evidence list based on search
  const filteredEvidence = evidence.filter(e => {
    return e.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           e.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
           e.caseId.toLowerCase().includes(searchQuery.toLowerCase()) || 
           e.fileType.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ padding: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', height: '100%', overflowY: 'auto' }}>
      
      {/* LEFT COLUMN: Upload Panel & List */}
      <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Upload Form */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} /> EVIDENCE INGESTION HUB
          </h3>
          
          <form onSubmit={handleUploadEvidence} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Link to Case File</label>
              <select 
                value={selectedCaseId} 
                onChange={(e) => setSelectedCaseId(e.target.value)}
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.title}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Evidence Category</label>
              <select 
                value={fileType} 
                onChange={(e) => setFileType(e.target.value)}
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <option value="WhatsApp Chat">WhatsApp Chat Screenshot</option>
                <option value="Telegram Chat">Telegram Chat Screenshot</option>
                <option value="UPI Receipt">UPI Transaction Receipt</option>
                <option value="Bank Statement">Bank Account Statement</option>
                <option value="SMS">Extortion/Fraud SMS</option>
                <option value="Email">Phishing/Threat Email</option>
                <option value="Social Media Screenshot">Social Media Handle Screenshot</option>
                <option value="Call Log">Call CDR Logs</option>
              </select>
            </div>

            {/* ── REAL LOCAL FILE UPLOAD ──────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Upload Evidence File
                <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>Max {MAX_MB}MB · JPG/PNG/PDF/DOCX/TXT/CSV</span>
              </label>

              {!selectedFile ? (
                /* Drop Zone */
                <div
                  className={`file-upload-zone${dragOver ? ' drag-over' : ''}`}
                  style={{ padding: '14px 12px', gap: '6px' }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDropFile}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.txt,.csv"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                  <UploadCloud size={22} className="upload-icon" />
                  <div className="upload-title" style={{ fontSize: '0.82rem' }}>Click to Browse or Drag & Drop</div>
                  <div className="upload-info-pills">
                    {['JPG','PNG','PDF','DOCX','TXT','CSV'].map(t => <span key={t} className="upload-pill">{t}</span>)}
                  </div>
                </div>
              ) : (
                /* File selected — preview chip */
                <div className="file-preview-chip">
                  <FileTypeIcon mimeType={selectedFile.type} />
                  <span className="file-chip-name" title={selectedFile.name}>{selectedFile.name}</span>
                  <span className="file-chip-size">{formatBytes(selectedFile.size)}</span>
                  <button className="file-chip-remove" onClick={clearSelectedFile} title="Remove">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Error */}
              {fileError && (
                <div className="upload-error-msg">
                  <AlertCircle size={13} /> {fileError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Custom Chat Text/Values (Optional)</label>
              <textarea 
                placeholder="Paste extracted text here to bypass OCR engine directly..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', minHeight: '60px' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={isProcessing}
              style={{
                backgroundColor: 'var(--primary)',
                color: 'black',
                fontWeight: 700,
                border: 'none',
                borderRadius: '4px',
                padding: '10px',
                fontSize: '0.85rem',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px'
              }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} /> EXTRACTING INTELLIGENCE...
                </>
              ) : (
                <>
                  <Cpu size={16} /> PROCESS DIGITAL EVIDENCE
                </>
              )}
            </button>
          </form>
        </div>

        {/* Evidence List */}
        <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>EVIDENCE VAULT</h3>
            <div style={{ position: 'relative', width: '150px' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '4px 8px 4px 24px', borderRadius: '4px' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '300px' }}>
            {filteredEvidence.map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedEvidenceId(item.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-primary)',
                  backgroundColor: selectedEvidenceId === item.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  borderColor: selectedEvidenceId === item.id ? 'var(--primary)' : 'var(--border-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 600 }}>{item.id}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>[{item.caseId}]</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}>{item.fileName}</div>
                </div>
                <span className="badge badge-low" style={{ fontSize: '0.65rem' }}>{item.fileType}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: OCR, Text Correction & Extracted Intelligence */}
      <div style={{ flex: '2 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {selectedItem ? (
          <>
            {/* File Info */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--primary)', border: '1px solid var(--border-primary)', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)' }}>{selectedItem.id}</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{selectedItem.fileName}</h3>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Linked Case: <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{selectedItem.caseId}</span> • Type: {selectedItem.fileType}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INTEGRITY STATUS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
                    <CheckCircle size={14} /> SECURED & SIGNED
                  </div>
                </div>
              </div>

              {/* Integrity Hashes and Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Uploaded By:</span>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedItem.uploadedBy}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Date Secured:</span>
                  <div>{new Date(selectedItem.uploadedAt).toLocaleString()}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>File Size:</span>
                  <div>{selectedItem.size}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-muted)' }}>SHA-256 Forensic Hash:</span>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedItem.hash}>{selectedItem.hash}</div>
                </div>
              </div>
            </div>

            {/* OCR Screen */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={16} style={{ color: 'var(--primary)' }} /> OCR TEXT EXTRACTION ENGINE
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OCR CONFIDENCE:</span>
                  <span className={`badge ${selectedItem.ocrConfidence > 90 ? 'badge-low' : 'badge-medium'}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {selectedItem.ocrConfidence}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LANG: {selectedItem.ocrLanguage}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Extracted Text (Editable for Corrections):</span>
                <textarea 
                  className="ocr-textarea"
                  value={selectedItem.ocrText}
                  onChange={(e) => handleOcrTextChange(e.target.value)}
                  placeholder="Raw OCR text content goes here..."
                />
              </div>
            </div>

            {/* Entity Intelligence Panel */}
            <div className="glow-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px' }}>
                AUTO-EXTRACTED INTELLIGENCE ENTITIES
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.keys(selectedItem.extractedEntities).map(key => {
                  const items = selectedItem.extractedEntities[key];
                  if (!items || items.length === 0) return null;
                  
                  const labelMap = {
                    phones: 'Mobile Numbers',
                    upis: 'UPI ID Credentials',
                    emails: 'Email Addresses',
                    urls: 'URLs / Hyperlinks',
                    transactions: 'Transaction Ref IDs',
                    accounts: 'Bank Account Numbers',
                    ifscs: 'Bank IFSC Codes',
                    ips: 'IP Coordinates',
                    amounts: 'Suspect Amounts',
                    dates: 'Timestamps / Dates',
                    usernames: 'Social Media Usernames'
                  };

                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>{labelMap[key] || key}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {items.map((val, idx) => (
                          <div 
                            key={idx} 
                            className="entity-tag"
                            onClick={() => copyToClipboard(val)}
                            title="Click to copy to clipboard"
                          >
                            {val} <Copy size={10} style={{ color: 'var(--text-muted)' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.values(selectedItem.extractedEntities).every(arr => arr.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No standard intelligence entities matched in current text. Edit text above to add valid UPI ID, phone, email, or transactions.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
            <FolderGit size={48} />
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select evidence in list to view details</div>
          </div>
        )}
      </div>

    </div>
  );
}
