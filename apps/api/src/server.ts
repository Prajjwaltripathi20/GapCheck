import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

import authRouter from './routes/auth';
import resumeRouter from './routes/resume';
import githubRouter from './routes/github';
import jobRouter from './routes/job';
import analysisRouter from './routes/analysis';
import dashboardRouter from './routes/dashboard';
import { generalRateLimiter } from './middleware/rateLimiter';
import { ensureDbReady } from './db';

const app = express();
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Security headers
app.use(helmet());

// Production CORS configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const isDevOrTest = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    // Requests with no origin (e.g., mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // In development or test, allow local origins
    if (isDevOrTest && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }

    // Check configured allowed origins (including wildcards like *.vercel.app)
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === origin) return true;
      if (allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return pattern.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging (sanitized, no sensitive credential dumps)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.url === '/api/health',
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (for Render and uptime monitoring)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gapcheck-api',
  });
});

// Ensure database tables and schemas are ready before any API route executes
app.use(async (_req, _res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (err) {
    next(err);
  }
});

// Global API rate limiting
app.use('/api', generalRateLimiter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/resume', resumeRouter);
app.use('/api/github', githubRouter);
app.use('/api/job', jobRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/dashboard', dashboardRouter);

// Production-safe Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message === 'CORS_ORIGIN_NOT_ALLOWED') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'CORS origin not allowed' });
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const status = typeof err.status === 'number' ? err.status : 500;

  console.error('[API Error]', {
    status,
    message: err.message,
    code: err.code || 'UNHANDLED_ERROR',
  });

  res.status(status).json({
    error: isProd && status === 500 ? 'INTERNAL_ERROR' : (err.code || 'SERVER_ERROR'),
    message: isProd && status === 500
      ? 'An unexpected error occurred. Please try again.'
      : (err.message || 'Internal server error'),
  });
});

// Bind to 0.0.0.0 for container / cloud hosting platforms (Render, Railway, etc.)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GapCheck API running on port ${PORT}`);
});

export default app;
