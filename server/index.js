import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ─── Route Imports ───────────────────────────────────────────────
import casesRouter from './routes/cases.js';
import evidenceRouter from './routes/evidence.js';
import entitiesRouter from './routes/entities.js';
import timelineRouter from './routes/timeline.js';
import alertsRouter from './routes/alerts.js';
import reportsRouter from './routes/reports.js';
import auditRouter from './routes/audit.js';

// ─── App Setup ───────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Security Middleware ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── CORS (React dev server) ──────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Officer-ID']
}));

// ─── Body Parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Evidence Files ────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ─── Request Logger (Audit Middleware) ───────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`;
    if (res.statusCode >= 400) {
      console.error(log);
    } else {
      console.log(log);
    }
  });
  next();
});

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/cases', casesRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);

// ─── Health Check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    platform: 'CHRONEX',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[CHRONEX SERVER ERROR]', err.stack);
  res.status(500).json({ success: false, error: 'Internal server error', details: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         CHRONEX INVESTIGATION INTELLIGENCE PLATFORM          ║');
  console.log('║       Cyber Evidence Timeline & Intelligence System           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ API Server running at: http://localhost:${PORT}`);
  console.log(`📁 Evidence uploads at:   http://localhost:${PORT}/uploads`);
  console.log(`🔍 Health check at:        http://localhost:${PORT}/api/health`);
  console.log('\n📡 Active API Routes:');
  console.log(`   GET/POST   /api/cases`);
  console.log(`   GET/POST   /api/evidence`);
  console.log(`   GET/POST   /api/entities`);
  console.log(`   GET/POST   /api/timeline/:caseId`);
  console.log(`   GET/POST   /api/alerts`);
  console.log(`   GET/POST   /api/reports`);
  console.log(`   GET/POST   /api/audit`);
  console.log('\n─────────────────────────────────────────────────────────────\n');
});

export default app;
