import express, { Request, Response } from 'express';
import cors from 'cors';

export function createApp(): express.Application {
  const app = express();

  // ── CORS ───────────────────────────────────────────────────────────────────
  // In production, FRONTEND_URL is set in the environment.
  // Multiple origins supported via comma-separated list.
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman) in dev
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json());

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── 404 fallback ───────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
