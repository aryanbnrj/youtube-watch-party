# YouTube Watch Party

Watch YouTube videos together with friends in perfect real-time sync. No accounts, no installs — just pick a name, create a room, and share the link.

**Live Demo:** `<ADD AFTER DEPLOYMENT>`  
**GitHub Repository:** `<ADD REPOSITORY URL>`

---

## Features

- **Create or join rooms** with a 6-character room code or shareable URL
- **Real-time sync** — play, pause, seek, and video changes broadcast to everyone instantly
- **Role-based access control** — Host, Moderator, and Participant roles with backend enforcement
- **Host management** — promote to Moderator, demote, kick participants, transfer host role
- **New joiner sync** — joining mid-session starts you at the current playback position
- **No database required** — rooms live in server memory for the MVP
- **Responsive UI** — works on desktop and mobile

---

## Tech Stack

| Layer      | Technology                                      |
|------------|--------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, React Router v6     |
| Realtime   | Socket.IO Client (WebSocket + polling fallback) |
| Video      | YouTube IFrame Player API                        |
| Backend    | Node.js, Express, TypeScript                    |
| Realtime   | Socket.IO Server                                |
| State      | In-memory Maps (RoomManager class)              |
| Deployment | Render (backend), Vercel/Netlify (frontend)     |

---

## Architecture

```
Browser (User A)          Browser (User B)
     │                         │
  React UI                  React UI
     │                         │
  Socket.IO client          Socket.IO client
     │                         │
     └──────────┬──────────────┘
                │  WebSocket (ws://)
                ▼
         Node.js / Express
                │
          Socket.IO Server
                │
          socketHandlers.ts
          (validate + authorize)
                │
          RoomManager
          (singleton Map)
                │
          Room class
          (authoritative state)
                │
     Broadcast to all sockets
     in the Socket.IO room
                │
     ┌──────────┴──────────┐
     ▼                     ▼
 User A player         User B player
 (YT IFrame API)       (YT IFrame API)
```

### How YouTube IFrame API integrates with Socket.IO

1. The IFrame API is loaded via `<script>` in `index.html` and fires `onYouTubeIframeAPIReady` when ready.
2. `YouTubePlayer.tsx` creates a `YT.Player` instance and registers `onStateChange`.
3. When the **local user** presses play/pause (either native YT controls or our buttons), `onStateChange` fires → we emit a Socket.IO event to the server.
4. The server validates the role, updates authoritative state, and broadcasts to everyone else.
5. Remote clients receive the event, write a `RemoteCommand` into `remoteCommandRef`, and a 100ms poller in `YouTubePlayer` picks it up and calls `player.playVideo()` / `player.pauseVideo()` / `player.seekTo()`.
6. **Loop prevention**: `isApplyingRemoteRef` is set to `true` before applying a remote command. When `onStateChange` fires as a result, the emit is skipped.

---

## Roles and Permissions

| Action              | HOST | MODERATOR | PARTICIPANT |
|---------------------|------|-----------|-------------|
| Play                | ✅   | ✅        | ❌          |
| Pause               | ✅   | ✅        | ❌          |
| Seek                | ✅   | ✅        | ❌          |
| Change video        | ✅   | ✅        | ❌          |
| Assign role         | ✅   | ❌        | ❌          |
| Remove participant  | ✅   | ❌        | ❌          |
| Transfer host       | ✅   | ❌        | ❌          |

> **All permissions are enforced on the server.** Frontend controls are hidden for unauthorized users, but the backend independently validates every event. A participant sending a `play` event via DevTools is rejected with `permission_denied`.

---

## Socket Events

### Client → Server

| Event                | Payload                                         | Description                        |
|----------------------|-------------------------------------------------|------------------------------------|
| `join_room`          | `{ roomId, username }`                          | Join or create a room              |
| `leave_room`         | `{ roomId }`                                    | Leave the room                     |
| `play`               | `{ roomId, currentTime }`                       | Request play                       |
| `pause`              | `{ roomId, currentTime }`                       | Request pause                      |
| `seek`               | `{ roomId, time }`                              | Seek to timestamp                  |
| `change_video`       | `{ roomId, videoId }`                           | Load a new YouTube video           |
| `assign_role`        | `{ roomId, userId, role }`                      | Change a participant's role        |
| `remove_participant` | `{ roomId, userId }`                            | Kick a participant                 |
| `transfer_host`      | `{ roomId, userId }`                            | Transfer Host role                 |

### Server → Client

| Event                  | Payload                                              | Description                          |
|------------------------|------------------------------------------------------|--------------------------------------|
| `sync_state`           | `{ videoId, playState, currentTime, participants }`  | Full room state on join              |
| `user_joined`          | `{ participant, participants }`                      | Someone joined                       |
| `user_left`            | `{ userId, username, participants }`                 | Someone left                         |
| `play`                 | `{ currentTime }`                                    | Remote play command                  |
| `pause`                | `{ currentTime }`                                    | Remote pause command                 |
| `seek`                 | `{ time }`                                           | Remote seek command                  |
| `video_changed`        | `{ videoId }`                                        | New video loaded                     |
| `role_assigned`        | `{ userId, role, participants }`                     | Role changed                         |
| `participant_removed`  | `{ userId, username, participants }`                 | Participant kicked                   |
| `you_were_removed`     | `{ message }`                                        | Sent to the kicked user              |
| `permission_denied`    | `{ message }`                                        | Unauthorized action attempt          |
| `error`                | `{ message }`                                        | General error                        |

---

## Local Setup

### Prerequisites

- Node.js 18+ and npm

### Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### Environment variables

**backend/.env**
```
PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

**frontend/.env**
```
VITE_BACKEND_URL=http://localhost:4000
```

---

## Running Locally

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# Server starts on http://localhost:4000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# App opens on http://localhost:5173
```

Then open `http://localhost:5173` in multiple browser tabs to test multi-user sync.

### Testing commands

```bash
# Backend typecheck
cd backend && npx tsc --noEmit

# Frontend typecheck
cd frontend && npx tsc --noEmit

# Frontend production build
cd frontend && npm run build
```

---

## Deployment

### Backend → Render

1. Push the repo to GitHub.
2. Create a new **Web Service** on [render.com](https://render.com).
3. Set:
   - **Root directory**: `backend`
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm start`
4. Add environment variables in the Render dashboard:
   ```
   PORT=4000
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   NODE_ENV=production
   ```
5. Note your Render service URL, e.g. `https://watch-party-backend.onrender.com`.

### Frontend → Vercel (or Netlify)

1. Create a new project on [vercel.com](https://vercel.com).
2. Set:
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
3. Add environment variable:
   ```
   VITE_BACKEND_URL=https://watch-party-backend.onrender.com
   ```
4. Deploy.

### render.yaml (optional — see `render.yaml` in root)

A `render.yaml` is included for one-click Render deployment of the backend.

---

## Design Decisions

### Why Socket.IO?
Socket.IO gives us WebSocket with an automatic polling fallback, built-in room support (`io.to(roomId).emit()`), and automatic reconnection — all out of the box. This avoids writing manual room tracking and makes the broadcast model very simple.

### Why in-memory room state for the MVP?
Adding a database (MongoDB, Postgres) for a real-time watch party introduces latency on every event and significant setup complexity. For an MVP, a `Map<string, Room>` gives O(1) lookup and zero network overhead. The `RoomManager` class is designed as a clean interface so swapping to a DB-backed store later only requires changing that one class.

### Why backend authorization?
Frontend role checks are trivially bypassed — anyone can open DevTools and emit `change_video` directly. Every privileged event is validated on the server against the socket's actual room membership and role. The frontend controls are a UX nicety, not a security boundary.

### How synchronization avoids loops
When the server broadcasts `play` to all clients, each client calls `player.playVideo()`. This triggers the YouTube player's `onStateChange(PLAYING)` callback, which would normally emit `play` back to the server — causing an infinite loop. We prevent this with `isApplyingRemoteRef`: set to `true` before calling any IFrame API method in response to a server event, and checked at the top of `onPlay` / `onPause` / `onSeek` before emitting. If the flag is set, we clear it and return without emitting.

---

## Limitations

- **In-memory state**: All rooms are lost when the server restarts. This is acceptable for an MVP but not production-grade.
- **Single server instance**: Socket.IO rooms are local to one Node.js process. Horizontal scaling would require sticky sessions or a shared pub/sub layer (e.g. Redis adapter).
- **No authentication**: Users choose any username. There is no login, no session persistence, and no way to reclaim a username after a disconnect.
- **YouTube restrictions**: Some videos are not embeddable due to YouTube's own settings. The player will show an error for those videos.
- **Seek detection heuristic**: We detect seek events by checking if the paused timestamp differs from the expected position by >1 second. This is a heuristic and may occasionally misclassify a pause as a seek.
- **Room expiry**: Rooms only disappear when all participants leave. There is no timeout for inactive rooms.
