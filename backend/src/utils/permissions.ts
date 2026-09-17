import { Role } from '../types/index';

/** Returns true if the role can control playback (play/pause/seek/change video) */
export function canControlPlayback(role: Role): boolean {
  return role === 'HOST' || role === 'MODERATOR';
}

/** Returns true if the role can manage participants (assign role / remove) */
export function canManageParticipants(role: Role): boolean {
  return role === 'HOST';
}

/** Validates that a role string is a known Role */
export function isValidRole(role: string): role is Role {
  return role === 'HOST' || role === 'MODERATOR' || role === 'PARTICIPANT';
}

/** Validates a YouTube video ID (11 alphanumeric/dash/underscore chars) */
export function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/** Validates a seek time is a finite non-negative number */
export function isValidTime(time: unknown): time is number {
  return typeof time === 'number' && isFinite(time) && time >= 0;
}
