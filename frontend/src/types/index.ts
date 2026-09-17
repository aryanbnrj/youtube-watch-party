// ─── Shared with backend ─────────────────────────────────────────────────────

export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT';

export type PlayState = 'playing' | 'paused';

export interface Participant {
  userId: string;
  username: string;
  role: Role;
  joinedAt: number;
}

// ─── Room state held in React ─────────────────────────────────────────────────

export interface RoomState {
  roomId: string;
  videoId: string;
  playState: PlayState;
  currentTime: number;
  participants: Participant[];
  myUserId: string;       // our own socket ID
  myRole: Role;
}

// ─── Socket event payloads (Server → Client) ─────────────────────────────────

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

export interface PlaybackEventPayload {
  currentTime: number;
}

export interface SeekEventPayload {
  time: number;
}

export interface VideoChangedPayload {
  videoId: string;
}

export interface PermissionDeniedPayload {
  message: string;
}

export interface ErrorPayload {
  message: string;
}

export interface YouWereRemovedPayload {
  message: string;
}
