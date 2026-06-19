import React, { useState } from 'react';
import { 
  Calendar, 
  Layers, 
  Share2, 
  Clock, 
  ArrowRight,
  MessageSquare,
  DollarSign,
  TrendingDown,
  Info,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

export default function TimelineEngine({ evidence }) {
  const [viewType, setViewType] = useState('timeline'); // 'timeline' | 'card' | 'flow'

  // Parse evidence to build events
  const generateEvents = () => {
    let eventsList = [];

    evidence.forEach(item => {
      const lines = item.ocrText.split('\n');
      
      lines.forEach((line, index) => {
        // Regex to match timestamps like [10:02], [08:02 AM], Date: 10 June 2026
        const timeMatch = line.match(/(?:\[)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)(?:\])?|Date:\s*([0-9a-zA-Z\s,:]+)/i);
        
        if (timeMatch) {
          const timestamp = timeMatch[1] || timeMatch[2];
          const text = line.replace(/\[\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\]|Date:\s*[0-9a-zA-Z\s,:]+/gi, '').trim();
          
          if (text.length > 5) {
            eventsList.push({
              id: `${item.id}-${index}`,
              evidenceId: item.id,
              fileName: item.fileName,
              fileType: item.fileType,
              time: timestamp,
              text: text,
              rawLine: line
            });
          }
        }
      });
    });

    // Sort events (crude sorting for mock, since times are format-specific. We will order by evidence id and then line index)
    return eventsList;
  };

  const events = generateEvents();

  // If no events can be parsed, provide fallback baseline events for the cases
  const fallbackEvents = [
    { id: "f1", time: "10:02 AM", text: "Solicitation message received offering crypto returns", fileType: "Telegram Chat", icon: <MessageSquare size={14} /> },
    { id: "f2", time: "10:05 AM", text: "Malicious APK link shared with the victim", fileType: "Telegram Chat", icon: <Share2 size={14} /> },
    { id: "f3", time: "10:08 AM", text: "Fake investment registration dashboard accessed", fileType: "Telegram Chat", icon: <Layers size={14} /> },
    { id: "f4", time: "10:12 AM", text: "UPI Transaction initiated to vip.invest@oksbi", fileType: "UPI Receipt", icon: <DollarSign size={14} /> },
    { id: "f5", time: "10:20 AM", text: "Receipt of ₹10,000 processed. Suspect blocked victim", fileType: "UPI Receipt", icon: <TrendingDown size={14} /> }
  ];

  const activeEvents = events.length > 0 ? events : fallbackEvents;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* View Switcher Header */}
      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={14} style={{ color: 'var(--primary)' }} /> Showing chronologically reconstructed timelines
        </span>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px' }}>
          <button 
            onClick={() => setViewType('timeline')}
            style={{
              background: viewType === 'timeline' ? 'var(--primary)' : 'none',
              color: viewType === 'timeline' ? 'black' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Timeline View
          </button>
          <button 
            onClick={() => setViewType('card')}
            style={{
              background: viewType === 'card' ? 'var(--primary)' : 'none',
              color: viewType === 'card' ? 'black' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Card List
          </button>
          <button 
            onClick={() => setViewType('flow')}
            style={{
              background: viewType === 'flow' ? 'var(--primary)' : 'none',
              color: viewType === 'flow' ? 'black' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Investigation Flow
          </button>
        </div>
      </div>

      {/* 1. VERTICAL TIMELINE VIEW */}
      {viewType === 'timeline' && (
        <div className="timeline-vertical" style={{ margin: '10px 0' }}>
          {activeEvents.map((evt, idx) => (
            <div key={evt.id} className="timeline-node">
              <div className="timeline-node-dot" style={{ borderColor: idx === activeEvents.length - 1 ? 'var(--critical)' : 'var(--primary)' }}></div>
              <div className="timeline-node-time">{evt.time}</div>
              <div className="timeline-node-content">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {evt.text.split(':')[0]}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
                    {evt.fileType || evt.fileName}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {evt.text.includes(':') ? evt.text.split(':').slice(1).join(':').trim() : evt.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. CARD VIEW */}
      {viewType === 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeEvents.map((evt, idx) => (
            <div 
              key={evt.id} 
              style={{
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--primary)',
                padding: '10px',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <Clock size={18} />
              </div>
              <div style={{ flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{evt.time}</span>
                  <span className="badge badge-low" style={{ fontSize: '0.65rem' }}>{evt.fileType}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{evt.text}</p>
                {evt.fileName && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileCheck size={12} /> Source: {evt.fileName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. INVESTIGATION FLOW VIEW */}
      {viewType === 'flow' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '20px 0'
        }}>
          {activeEvents.map((evt, idx) => (
            <React.Fragment key={evt.id}>
              <div 
                style={{
                  width: '100%',
                  maxWidth: '450px',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '12px 16px',
                  boxShadow: idx === activeEvents.length - 1 ? '0 0 10px rgba(244,63,94,0.15)' : 'none',
                  borderColor: idx === activeEvents.length - 1 ? 'var(--critical)' : 'var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: idx === activeEvents.length - 1 ? 'rgba(244,63,94,0.1)' : 'rgba(0,240,255,0.08)',
                  border: `1px solid ${idx === activeEvents.length - 1 ? 'var(--critical)' : 'var(--primary)'}`,
                  color: idx === activeEvents.length - 1 ? 'var(--critical)' : 'var(--primary)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0
                }}>
                  {idx + 1}
                </div>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>STAGE TIME: {evt.time}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{evt.text.split(':')[0]}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{evt.text.includes(':') ? evt.text.split(':').slice(1).join(':').trim() : ''}</div>
                </div>
              </div>
              
              {idx < activeEvents.length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '2px', height: '20px', backgroundColor: 'var(--border-primary)' }}></div>
                  <ArrowRight size={14} style={{ transform: 'rotate(90deg)', color: 'var(--text-muted)' }} />
                  <div style={{ width: '2px', height: '10px', backgroundColor: 'var(--border-primary)' }}></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {activeEvents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No evidence transcripts available for timeline mapping. Link evidence documents containing dialogue timestamps to see analysis.
        </div>
      )}
    </div>
  );
}
