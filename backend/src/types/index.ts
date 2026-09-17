// ─── Role Definitions ───────────────────────────────────────────────────────

export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT';

export type PlayState = 'playing' | 'paused';

// ─── Participant ─────────────────────────────────────────────────────────────

export interface Participant {
  userId: string;      // socket.id
  username: string;
  role: Role;
  joinedAt: number;    // Date.now()
}

// ─── Room State ──────────────────────────────────────────────────────────────

export interface RoomState {
  roomId: string;
  hostId: string;
  videoId: string;
  playState: PlayState;
  currentTime: number;
  lastUpdatedAt: number;   // timestamp when currentTime was last recorded
  participants: Participant[];
}

// ─── Socket Event Payloads (Client → Server) ─────────────────────────────────

export interface JoinRoomPayload {
  roomId: string;
  username: string;
}

export interface PlayPayload {
  roomId: string;
  currentTime: number;
}

export interface PausePayload {
  roomId: string;
  currentTime: number;
}

export interface SeekPayload {
  roomId: string;
  time: number;
}

export interface ChangeVideoPayload {
  roomId: string;
  videoId: string;
}

export interface AssignRolePayload {
  roomId: string;
  userId: string;
  role: Role;
}

export interface RemoveParticipantPayload {
  roomId: string;
  userId: string;
}

// ─── Socket Event Payloads (Server → Client) ─────────────────────────────────

export interface SyncStatePayload {
  videoId: string;
  playState: PlayState;
  currentTime: number;
  participants: Participant[];
}

export interface UserJoinedPayload {
  participant: Participant;
  participants: Participant[];
}

export interface UserLeftPayload {
  userId: string;
  username: string;
  participants: Participant[];
}

export interface RoleAssignedPayload {
  userId: string;
  role: Role;
  participants: Participant[];
}

export interface ParticipantRemovedPayload {
  userId: string;
  username: string;
  participants: Participant[];
}

export interface VideoChangedPayload {
  videoId: string;
}

export interface PlaybackEventPayload {
  currentTime: number;
}

export interface PermissionDeniedPayload {
  message: string;
}
