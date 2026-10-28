import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initDatabase, db } from './db.js';
import { apiRouter } from './api.js';
import { seedData } from './seed.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SQLite database
initDatabase();

// Check if database needs seeding
const missionCount = db.prepare('SELECT COUNT(*) as c FROM missions').get() as { c: number };
if (missionCount.c === 0) {
  console.log('Database empty. Running initial synthetic seed...');
  seedData();
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files securely
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    app: 'VP Expertise',
    database: 'connected',
    time: new Date().toISOString(),
  });
});

// In production, serve Vite client build
const clientDist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(clientDist, 'index.html'));
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[VP Expertise] Backend running at http://localhost:${PORT}`);
});
