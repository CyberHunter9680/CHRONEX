/**
 * CHRONEX API Service Layer
 * Centralizes all backend communication. Falls back gracefully when server is offline.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let serverOnline = null; // null = unknown, true/false = tested

// ─── Health Check ─────────────────────────────────────────────────
export async function checkServerHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    serverOnline = res.ok;
    return res.ok;
  } catch {
    serverOnline = false;
    return false;
  }
}

export function isServerOnline() {
  return serverOnline;
}

// ─── Generic Fetch Wrapper ─────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  // Don't override Content-Type for FormData
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  try {
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { data, error: null };
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err.message);
    return { data: null, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════════
//  CASES API
// ════════════════════════════════════════════════════════════════════

export const casesApi = {
  // GET /api/cases
  async getAll(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.classification) params.set('classification', filters.classification);
    const query = params.toString() ? `?${params}` : '';
    return apiFetch(`/cases${query}`);
  },

  // GET /api/cases/:id
  async getById(caseId) {
    return apiFetch(`/cases/${caseId}`);
  },

  // POST /api/cases
  async create(caseData) {
    return apiFetch('/cases', {
      method: 'POST',
      body: JSON.stringify(caseData),
    });
  },

  // PUT /api/cases/:id
  async update(caseId, updates) {
    return apiFetch(`/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // GET /api/cases/:id/evidence
  async getEvidence(caseId) {
    return apiFetch(`/cases/${caseId}/evidence`);
  },

  // GET /api/cases/:id/chain-of-custody
  async getChainOfCustody(caseId) {
    return apiFetch(`/cases/${caseId}/chain-of-custody`);
  },
};

// ════════════════════════════════════════════════════════════════════
//  EVIDENCE API
// ════════════════════════════════════════════════════════════════════

export const evidenceApi = {
  // GET /api/evidence?caseId=...
  async getAll(caseId) {
    const query = caseId ? `?caseId=${encodeURIComponent(caseId)}` : '';
    return apiFetch(`/evidence${query}`);
  },

  // POST /api/evidence  (multipart form-data with file)
  async upload(caseId, file, meta = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);
    if (meta.uploaded_by) formData.append('uploaded_by', meta.uploaded_by);
    if (meta.tags) formData.append('tags', JSON.stringify(meta.tags));

    return apiFetch('/evidence', {
      method: 'POST',
      body: formData,
    });
  },

  // GET /api/evidence/:id
  async getById(evidenceId) {
    return apiFetch(`/evidence/${evidenceId}`);
  },

  // POST /api/evidence/:id/ocr
  async runOcr(evidenceId) {
    return apiFetch(`/evidence/${evidenceId}/ocr`, { method: 'POST' });
  },

  // GET /api/evidence/:id/chain-of-custody
  async getChainOfCustody(evidenceId) {
    return apiFetch(`/evidence/${evidenceId}/chain-of-custody`);
  },

  // GET /api/evidence/:id/verify
  async verifyIntegrity(evidenceId) {
    return apiFetch(`/evidence/${evidenceId}/verify`);
  },
};

// ════════════════════════════════════════════════════════════════════
//  ENTITIES API
// ════════════════════════════════════════════════════════════════════

export const entitiesApi = {
  // GET /api/entities
  async getAll(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.risk) params.set('risk', filters.risk);
    const query = params.toString() ? `?${params}` : '';
    return apiFetch(`/entities${query}`);
  },

  // GET /api/entities/:id
  async getById(entityId) {
    return apiFetch(`/entities/${entityId}`);
  },

  // POST /api/entities
  async create(entityData) {
    return apiFetch('/entities', {
      method: 'POST',
      body: JSON.stringify(entityData),
    });
  },

  // PUT /api/entities/:id
  async update(entityId, updates) {
    return apiFetch(`/entities/${entityId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // GET /api/entities/stats/summary
  async getSummary() {
    return apiFetch('/entities/stats/summary');
  },
};

// ════════════════════════════════════════════════════════════════════
//  TIMELINE API
// ════════════════════════════════════════════════════════════════════

export const timelineApi = {
  // GET /api/timeline/:caseId
  async getEvents(caseId) {
    return apiFetch(`/timeline/${caseId}`);
  },

  // POST /api/timeline/:caseId
  async addEvent(caseId, eventData) {
    return apiFetch(`/timeline/${caseId}`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  // POST /api/timeline/:caseId/reconstruct
  async reconstruct(caseId) {
    return apiFetch(`/timeline/${caseId}/reconstruct`, { method: 'POST' });
  },

  // DELETE /api/timeline/:caseId/:eventId
  async deleteEvent(caseId, eventId) {
    return apiFetch(`/timeline/${caseId}/${eventId}`, { method: 'DELETE' });
  },
};

// ════════════════════════════════════════════════════════════════════
//  ALERTS API
// ════════════════════════════════════════════════════════════════════

export const alertsApi = {
  // GET /api/alerts
  async getAll(filters = {}) {
    const params = new URLSearchParams();
    if (filters.resolved !== undefined) params.set('resolved', filters.resolved);
    if (filters.severity) params.set('severity', filters.severity);
    const query = params.toString() ? `?${params}` : '';
    return apiFetch(`/alerts${query}`);
  },

  // GET /api/alerts/stats
  async getStats() {
    return apiFetch('/alerts/stats');
  },

  // POST /api/alerts/:id/resolve
  async resolve(alertId) {
    return apiFetch(`/alerts/${alertId}/resolve`, { method: 'PATCH' });
  },

  // POST /api/alerts/run-correlation
  async runCorrelation() {
    return apiFetch('/alerts/run-correlation', { method: 'POST' });
  },

  // POST /api/alerts
  async create(alertData) {
    return apiFetch('/alerts', {
      method: 'POST',
      body: JSON.stringify(alertData),
    });
  },
};

// ════════════════════════════════════════════════════════════════════
//  REPORTS API
// ════════════════════════════════════════════════════════════════════

export const reportsApi = {
  // GET /api/reports/dashboard-stats
  async getDashboardStats() {
    return apiFetch('/reports/dashboard-stats');
  },

  // POST /api/reports/generate/:caseId
  async generate(caseId, meta = {}) {
    return apiFetch(`/reports/generate/${caseId}`, {
      method: 'POST',
      body: JSON.stringify(meta),
    });
  },
};

// ════════════════════════════════════════════════════════════════════
//  AUDIT API
// ════════════════════════════════════════════════════════════════════

export const auditApi = {
  // GET /api/audit
  async getLogs() {
    return apiFetch('/audit');
  },

  // POST /api/audit
  async log(action, username = 'System', ip = '127.0.0.1') {
    return apiFetch('/audit', {
      method: 'POST',
      body: JSON.stringify({ action, username, ip_address: ip }),
    });
  },
};
