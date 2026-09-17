import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { registerSocketHandlers } from './socket/socketHandlers';
import { getAllowedOrigins, isOriginAllowed } from './utils/corsOrigins';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ── HTTP server ──────────────────────────────────────────────────────────────
const app = createApp();
const httpServer = createServer(app);

// ── Socket.IO server ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Improves reliability on Render (which terminates long-lived connections)
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Register handlers for every new connection
io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

// ── Start listening ──────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[Server] YouTube Watch Party backend running on port ${PORT}`);
  console.log(`[Server] Allowed frontend origins: ${getAllowedOrigins().join(', ')}`);
  if (
    process.env.NODE_ENV === 'production' &&
    getAllowedOrigins().every((origin) => origin.includes('localhost'))
  ) {
    console.warn(
      '[Server] FRONTEND_URL is still localhost — also allowing https://*.vercel.app in production'
    );
  }
  console.log(`[Server] Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  httpServer.close(() => process.exit(0));
});
