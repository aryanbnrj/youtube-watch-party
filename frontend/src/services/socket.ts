import { io, Socket } from 'socket.io-client';

// Read the backend URL from the Vite env variable (set in .env or deployment env).
// Vercel env vars must include the protocol, e.g. https://your-app.up.railway.app
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';
const BACKEND_URL =
  rawBackendUrl.startsWith('http://') || rawBackendUrl.startsWith('https://')
    ? rawBackendUrl
    : `https://${rawBackendUrl}`;

/**
 * We create ONE socket instance for the whole app.
 * It is NOT connected on import — it connects when the user joins a room
 * and we call socket.connect() explicitly.
 */
const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,     // We control when to connect
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'], // WebSocket preferred, polling as fallback
});

export default socket;
