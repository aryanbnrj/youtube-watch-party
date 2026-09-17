/**
 * Centralised list of every Socket.IO event name used in the app.
 * Keeping them here means a typo is a compile-time error, not a silent bug.
 */

// Client → Server
export const CLIENT_EVENTS = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  CHANGE_VIDEO: 'change_video',
  ASSIGN_ROLE: 'assign_role',
  REMOVE_PARTICIPANT: 'remove_participant',
  TRANSFER_HOST: 'transfer_host',
} as const;

// Server → Client
export const SERVER_EVENTS = {
  SYNC_STATE: 'sync_state',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  VIDEO_CHANGED: 'video_changed',
  ROLE_ASSIGNED: 'role_assigned',
  PARTICIPANT_REMOVED: 'participant_removed',
  PERMISSION_DENIED: 'permission_denied',
  ERROR: 'error',
  YOU_WERE_REMOVED: 'you_were_removed',
} as const;
