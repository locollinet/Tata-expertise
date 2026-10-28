import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initDatabase, db } from './server/db.js';
import { apiRouter } from './server/api.js';
import { seedData } from './server/seed.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
initDatabase();

// Check if database needs seeding
try {
  const missionCount = db.prepare('SELECT COUNT(*) as c FROM missions').get() as { c: number } | undefined;
  if (!missionCount || missionCount.c === 0) {
    console.log('[VP Expertise] Database empty. Running initial synthetic seed...');
    seedData();
  }
} catch (e) {
  console.error('[VP Expertise] Error checking/seeding DB:', e);
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
    app: "VP EXPERTISE",
    database: 'connected',
    time: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(clientDist, 'index.html'));
      });
    }
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[VP Expertise] App running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
