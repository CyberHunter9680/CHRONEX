import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  ShieldAlert, 
  Key, 
  Clipboard, 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  Check, 
  Globe, 
  FileText, 
  Activity, 
  FolderOpen, 
  Clock, 
  Info,
  Server
} from 'lucide-react';
import { authApi } from '../services/api';

export default function LoginScreen({ onLoginSuccess }) {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Investigation Officer');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Authenticating Officer Credentials...');

  // MFA states
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp] = useState('');
  const [mockOtp, setMockOtp] = useState('');
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Lockout info
  const [lockoutMsg, setLockoutMsg] = useState(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Define role dropdown list
  const rolesList = [
    'SP',
    'Cyber Cell Incharge',
    'Investigation Officer',
    'Analyst',
    'Read Only Viewer'
  ];

  // Map dropdown values to DB roles
  const roleMap = {
    'SP': 'SP',
    'Cyber Cell Incharge': 'CYBER CELL INCHARGE',
    'Investigation Officer': 'INVESTIGATION OFFICER',
    'Analyst': 'ANALYST',
    'Read Only Viewer': 'READ ONLY VIEWER'
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identity || !password) return;
    setError(null);
    setLockoutMsg(null);
    setLoading(true);
    setLoadingMsg('Authenticating Officer Credentials...');

    try {
      const response = await authApi.login(identity, password);
      
      if (response.error) {
        setLoading(false);
        setError(response.error);
        if (response.error.includes('Locked')) {
          setLockoutMsg(response.error);
        }
        return;
      }

      const { data } = response;
      
      // Perform role verification before proceeding
      const user = data.user;
      if (!data.mfa_required && user) {
        if (user.role !== 'SUPER ADMIN' && user.role !== roleMap[selectedRole]) {
          setLoading(false);
          setError(`Access Denied: Logged in officer role (${user.role}) does not match the selected portal role (${selectedRole}).`);
          return;
        }
      }

      if (data.mfa_required) {
        setLoading(false);
        setMfaRequired(true);
        setTempToken(data.temp_token);
        setMockOtp(data.mock_otp || '');
      } else if (data.token) {
        localStorage.setItem('chronex_token', data.token);
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failure. Cyber Intelligence Command Server offline.');
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    if (!otp) return;
    setError(null);
    setLoading(true);
    setLoadingMsg('Validating Secure MFA Key...');

    try {
      const response = await authApi.verifyMfa(tempToken, otp);
      
      if (response.error) {
        setLoading(false);
        setError(response.error);
        return;
      }

      const { data } = response;

      // Verify selected role after MFA confirmation as well
      const user = data.user;
      if (user) {
        if (user.role !== 'SUPER ADMIN' && user.role !== roleMap[selectedRole]) {
          setLoading(false);
          setError(`Access Denied: Logged in officer role (${user.role}) does not match the selected portal role (${selectedRole}).`);
          return;
        }
      }

      if (data.token) {
        localStorage.setItem('chronex_token', data.token);
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setLoading(false);
      setError('MFA Validation handshake failed.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mockOtp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const features = [
    { name: 'Case Management', desc: 'Secure Case Dossiers & Assignment', icon: <FolderOpen size={16} /> },
    { name: 'Evidence Locker', desc: 'Chain of Custody & Forensic Hashes', icon: <Lock size={16} /> },
    { name: 'OCR Intelligence', desc: 'Tesseract OCR Text Extraction', icon: <FileText size={16} /> },
    { name: 'Timeline Reconstruction', desc: 'Interactive Investigation Timelines', icon: <Clock size={16} /> },
    { name: 'Correlation Engine', desc: 'Cross-Case Automated Link Alerts', icon: <Activity size={16} /> },
    { name: 'OSINT Workspace', desc: 'Multi-Source Credential Verification', icon: <Globe size={16} /> },
    { name: 'Investigation Reports', desc: 'NIC Standard Docket Export', icon: <Clipboard size={16} /> },
    { name: 'Threat Intelligence', desc: 'Advanced Fraud Risk Mapping', icon: <Shield size={16} /> },
  ];

  const securityBadges = [
    'Role Based Access Control',
    'End-to-End Audit Logging',
    'Evidence Integrity Protection',
    'Multi-Factor Authentication',
    'Secure Investigation Environment'
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: '#020408',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      <style>{`
        @media (max-width: 1024px) {
          .login-left {
            display: none !important;
          }
          .login-right {
            width: 100% !important;
            max-width: 100% !important;
            flex: 1 !important;
          }
        }
        @media (min-width: 1025px) {
          .login-left {
            display: flex !important;
            width: 50% !important;
            flex-shrink: 0 !important;
          }
          .login-right {
            width: 50% !important;
            flex-shrink: 0 !important;
          }
        }
        .feature-card {
          transition: all 0.3s ease;
          border: 1px solid #14234c;
        }
        .feature-card:hover {
          border-color: #00f0ff !important;
          background: rgba(0, 240, 255, 0.05) !important;
          transform: translateY(-2px);
        }
        .login-btn {
          transition: all 0.2s ease;
        }
        .login-btn:hover {
          background: #2563eb !important;
          box-shadow: 0 0 15px rgba(37, 99, 235, 0.4) !important;
        }
        .input-field {
          transition: border-color 0.2s ease;
        }
        .input-field:focus {
          border-color: #00f0ff !important;
          outline: none;
        }
        .security-badge {
          background: rgba(30, 41, 59, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #94a3b8;
          font-size: 0.65rem;
          font-family: monospace;
          padding: 6px 10px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .security-badge:hover {
          border-color: rgba(0, 240, 255, 0.2);
          color: #f8fafc;
        }
        @keyframes rotateSpinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-spinner {
          animation: rotateSpinner 1s linear infinite;
        }
      `}</style>

      {/* ─── LEFT SPLIT-SCREEN: BRANDING & FEATURES ─── */}
      <div className="login-left" style={{
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '54px 48px',
        background: 'linear-gradient(135deg, #040817 0%, #0c142d 100%)',
        borderRight: '1px solid #111a36',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle Cyber Network Vector Graphic Overlay */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00f0ff" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          <circle cx="100" cy="180" r="5" fill="#00f0ff" />
          <circle cx="350" cy="130" r="4" fill="#00f0ff" />
          <circle cx="280" cy="340" r="6" fill="#3b82f6" />
          <circle cx="480" cy="240" r="5" fill="#00f0ff" />
          <circle cx="160" cy="450" r="4" fill="#3b82f6" />
          
          <line x1="100" y1="180" x2="350" y2="130" stroke="#00f0ff" strokeWidth="0.75" />
          <line x1="350" y1="130" x2="280" y2="340" stroke="#3b82f6" strokeWidth="0.75" strokeDasharray="3,3" />
          <line x1="280" y1="340" x2="480" y2="240" stroke="#00f0ff" strokeWidth="0.75" />
          <line x1="100" y1="180" x2="160" y2="450" stroke="#3b82f6" strokeWidth="0.75" />
          <line x1="280" y1="340" x2="160" y2="450" stroke="#00f0ff" strokeWidth="0.75" />
        </svg>

        {/* Top Header Branding Block */}
        <div style={{ position: 'relative', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src="/upp_logo.png" 
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 10px rgba(0, 102, 204, 0.4))'
              }}
              alt="Uttar Pradesh Police"
              onError={(e) => {
                // Fallback to circular badge if image fails to load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37,99,235,0.1)',
              border: '1px solid rgba(37,99,235,0.3)',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Shield size={28} />
            </div>
            <div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                letterSpacing: '0.5px',
                color: '#fff'
              }}>
                UTTAR PRADESH POLICE
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#00f0ff',
                fontWeight: 600,
                fontFamily: 'monospace'
              }}>
                CYBER CELL INTELLIGENCE DIVISION
              </div>
            </div>
          </div>

          <h2 style={{
            fontSize: '3.2rem',
            fontWeight: 900,
            color: '#f8fafc',
            marginTop: '36px',
            marginBottom: '4px',
            letterSpacing: '-1.5px',
            lineHeight: 1
          }}>
            CHRONEX
          </h2>
          <p style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '12px'
          }}>
            Cyber Evidence Timeline & Investigation Intelligence Platform
          </p>

          <p style={{
            fontSize: '0.9rem',
            lineHeight: 1.5,
            color: '#cbd5e1',
            marginTop: '16px',
            maxWidth: '540px'
          }}>
            CHRONEX is an AI-assisted Cyber Evidence Timeline and Investigation Intelligence Platform designed to help law-enforcement agencies manage cyber crime investigations, analyze digital evidence, correlate intelligence, and accelerate case resolution.
          </p>
        </div>

        {/* Feature Cards Grid Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginTop: '24px',
          marginBottom: '24px',
          position: 'relative',
          zIndex: 5
        }}>
          {features.map((feat) => (
            <div 
              key={feat.name}
              className="feature-card" 
              style={{
                background: 'rgba(8, 15, 36, 0.4)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{
                color: '#00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {feat.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                  {feat.name}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px' }}>
                  {feat.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Programme Footer */}
        <div style={{
          fontSize: '0.72rem',
          color: '#64748b',
          fontWeight: 600,
          letterSpacing: '0.5px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '14px',
          position: 'relative',
          zIndex: 5
        }}>
          APCSIP 2026 CYBER SECURITY INTERNSHIP PROGRAMME
        </div>
      </div>

      {/* ─── RIGHT SPLIT-SCREEN: SECURE LOGIN FORM ─── */}
      <div className="login-right" style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#040713',
        position: 'relative'
      }}>
        {/* Subtle Cyber Dots Background */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            pointerEvents: 'none'
          }}
        />

        {/* Secure Form Card */}
        <div style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#0a0f26',
          border: '1px solid #14234c',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          padding: '36px',
          zIndex: 10,
          position: 'relative'
        }}>
          {/* Card Top Branding Badge */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#0a0f26',
            border: '1px solid #14234c',
            borderRadius: '20px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.7rem',
            color: '#00f0ff',
            fontWeight: 700,
            fontFamily: 'monospace'
          }}>
            <Shield size={12} /> SECURE COMMAND PORTAL
          </div>

          <div style={{ textAlign: 'center', marginBottom: '28px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.25px' }}>
              Secure Officer Authentication
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Enter credentials to access official investigation node
            </p>
          </div>

          {error && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'start',
              gap: '8px'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {lockoutMsg && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'start',
              gap: '8px'
            }}>
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{lockoutMsg}</div>
            </div>
          )}

          {/* Loading Animation Layer */}
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(10, 15, 38, 0.95)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 20
            }}>
              <div 
                className="loading-spinner" 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '3px solid rgba(37,99,235,0.2)',
                  borderTopColor: '#00f0ff',
                  marginBottom: '16px'
                }}
              />
              <p style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
                {loadingMsg}
              </p>
            </div>
          )}

          {!mfaRequired ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Username / Official Email
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', insetY: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', height: '100%', color: '#475569' }}>
                    <Mail size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter identity or email"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      fontSize: '0.85rem',
                      backgroundColor: '#050812',
                      border: '1px solid #14234c',
                      borderRadius: '6px',
                      color: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Access Passphrase
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', insetY: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', height: '100%', color: '#475569' }}>
                    <Key size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      fontSize: '0.85rem',
                      backgroundColor: '#050812',
                      border: '1px solid #14234c',
                      borderRadius: '6px',
                      color: '#fff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Assigned Officer Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    backgroundColor: '#050812',
                    border: '1px solid #14234c',
                    borderRadius: '6px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                >
                  {rolesList.map(role => (
                    <option key={role} value={role} style={{ backgroundColor: '#0a0f26' }}>{role}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="login-btn"
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}
              >
                SECURE LOGIN
              </button>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginTop: '4px',
                  alignSelf: 'center'
                }}
              >
                Forgot Password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: 'rgba(0, 240, 255, 0.04)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderRadius: '8px'
              }}>
                <ShieldAlert size={28} style={{ color: '#00f0ff', margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Multi-Factor Authentication
                </div>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                  Simulated OTP authorization required for administrative nodes.
                </p>
              </div>

              {/* Developer Helper OTP Panel */}
              {mockOtp && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>SIMULATED OTP SENT</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00f0ff', trackingSpacing: '4px', fontFamily: 'monospace' }}>{mockOtp}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    style={{
                      backgroundColor: 'rgba(0, 240, 255, 0.1)',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                      color: '#00f0ff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {copiedOtp ? 'COPIED' : 'COPY CODE'}
                  </button>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', textAlign: 'center' }}>
                  Enter 6-Digit MFA Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength="6"
                  placeholder="0 0 0 0 0 0"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    letterSpacing: '0.5em',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    padding: '10px 0',
                    backgroundColor: '#050812',
                    border: '1px solid #14234c',
                    borderRadius: '6px',
                    color: '#00f0ff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #14234c',
                    borderRadius: '6px',
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  BACK
                </button>
                <button
                  type="submit"
                  disabled={otp.length !== 6}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: otp.length === 6 ? 1 : 0.5
                  }}
                >
                  ACTIVATE
                </button>
              </div>
            </form>
          )}

          {/* Security Badges Grid */}
          <div style={{
            marginTop: '28px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '20px'
          }}>
            <span style={{
              display: 'block',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '10px',
              textAlign: 'center'
            }}>
              Active Security Protocols
            </span>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              justifyContent: 'center'
            }}>
              {securityBadges.map(badge => (
                <div key={badge} className="security-badge">
                  <Shield size={10} style={{ color: '#00f0ff' }} />
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info centered at bottom of right panel */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          right: '24px',
          textAlign: 'center',
          fontSize: '0.68rem',
          lineHeight: 1.4,
          color: '#334155',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          <div>CONFIDENTIAL GOVERNMENT SYSTEM • AUTHORIZED PERSONNEL ONLY</div>
          <div style={{ marginTop: '2px', color: '#1e293b' }}>
            UNAUTHORIZED ACCESS SUBJECT TO LEGAL ACTION UNDER APPLICABLE CYBER LAWS
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (UP Police official message) */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(2, 4, 8, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0a0f26',
            border: '1px solid #1e3a8a',
            borderRadius: '12px',
            padding: '28px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
              <Info style={{ color: '#3b82f6' }} />
              <h4 style={{ fontWeight: 800, color: '#fff', fontSize: '1rem', margin: 0 }}>
                Credential Recovery Protocol
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
              In accordance with government security protocol and role permissions, automated online password recovery is disabled on the CHRONEX terminal gateway.
            </p>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, marginTop: '8px' }}>
              To recover or reset your access key, please contact the Cyber Cell System Administrator at:
              <strong style={{ color: '#00f0ff', display: 'block', marginTop: '4px', fontFamily: 'monospace' }}>admin.cybercell@uppolice.gov.in</strong>
              or raise a secure ticket via the internal cell portal.
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '10px',
                backgroundColor: '#1d4ed8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
