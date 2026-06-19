-- PostgreSQL Database Schema for CHRONEX

-- 1. Users table (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'Administrator', 'Inspector', 'Analyst', 'Read Only Viewer'
    name VARCHAR(255) NOT NULL,
    badge VARCHAR(100),
    district VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cases table
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(50) PRIMARY KEY, -- Format: CX-YYYY-XXXX
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Open', -- 'Open', 'Under Investigation', 'Pending', 'Closed'
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    classification VARCHAR(100) NOT NULL, -- e.g. 'Investment Scam', 'Job Fraud', etc.
    victim_name VARCHAR(255) NOT NULL,
    victim_age INTEGER,
    victim_phone VARCHAR(50),
    victim_email VARCHAR(100),
    victim_occupation VARCHAR(100),
    victim_location VARCHAR(255),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_officer VARCHAR(255),
    assigned_cell VARCHAR(255) DEFAULT 'Noida Cyber Cell (Zone 1)',
    fir_number VARCHAR(100),
    complaint_number VARCHAR(100),
    loss_amount NUMERIC(15, 2) DEFAULT 0.00,
    notes JSONB DEFAULT '[]'::jsonb,
    integrity_hash VARCHAR(64) NOT NULL
);

-- 3. Evidence table
CREATE TABLE IF NOT EXISTS evidence (
    id VARCHAR(50) PRIMARY KEY, -- Format: E-XXXXX
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL, -- e.g. 'WhatsApp Chat', 'UPI Receipt', etc.
    file_path TEXT NOT NULL,
    file_size VARCHAR(50),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(255),
    sha256_hash VARCHAR(64) NOT NULL,
    ocr_language VARCHAR(50) DEFAULT 'English',
    ocr_confidence INTEGER DEFAULT 0,
    ocr_text TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[]
);

-- 4. Intelligence Directory (extracted entities)
CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL, -- 'Mobile Number', 'UPI ID', 'Email Address', 'URL', 'Transaction ID', 'Bank Account Number', 'IFSC Code', 'IP Address', 'Wallet ID', 'Social Media Username', 'Amount', 'Date', 'Time'
    entity_value VARCHAR(255) NOT NULL,
    risk_score VARCHAR(50) DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    details TEXT,
    UNIQUE (entity_type, entity_value)
);

-- 5. Linkage join table for Case & Evidence with Entities
CREATE TABLE IF NOT EXISTS evidence_entities (
    evidence_id VARCHAR(50) REFERENCES evidence(id) ON DELETE CASCADE,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    PRIMARY KEY (evidence_id, entity_id)
);

-- 6. Timeline Events
CREATE TABLE IF NOT EXISTS timeline_events (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(255) NOT NULL
);

-- 7. Threat Alerts (correlations)
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(50) PRIMARY KEY, -- Format: A-XXXXX
    type VARCHAR(100) NOT NULL, -- e.g. 'Duplicate Entity Match'
    severity VARCHAR(50) NOT NULL DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    entity_type VARCHAR(100),
    entity_value VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    cases TEXT[] DEFAULT '{}'::TEXT[]
);

-- 8. Printable Case Reports
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    content TEXT, -- HTML or JSON formatted police report
    path TEXT
);

-- 9. Security Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(255) NOT NULL,
    action TEXT NOT NULL,
    ip_address VARCHAR(50) NOT NULL
);

-- 10. Chain of Custody Record
CREATE TABLE IF NOT EXISTS chain_of_custody (
    id SERIAL PRIMARY KEY,
    evidence_id VARCHAR(50) REFERENCES evidence(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL, -- e.g. 'Uploaded', 'OCR Corrected', 'Downloaded'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    handled_by VARCHAR(255) NOT NULL,
    description TEXT NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cases_officer ON cases(assigned_officer);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_entities_value ON entities(entity_value);
CREATE INDEX IF NOT EXISTS idx_evidence_entities_case ON evidence_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_case ON timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts(entity_value);
