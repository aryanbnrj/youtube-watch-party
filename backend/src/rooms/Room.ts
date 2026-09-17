import { Participant, PlayState, Role } from '../types/index';

/**
 * The Room class is the authoritative state for a single watch party room.
 * All business logic lives here — socket handlers just call these methods.
 */
export class Room {
  readonly roomId: string;
  hostId: string;

  // Playback state
  videoId: string;
  playState: PlayState;
  currentTime: number;
  lastUpdatedAt: number; // Date.now() when currentTime was last recorded

  // Participants keyed by socket ID for O(1) lookups
  private participantMap: Map<string, Participant>;

  constructor(roomId: string, hostId: string, hostUsername: string) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.videoId = 'dQw4w9WgXcQ'; // Default video — Rick Astley as placeholder
    this.playState = 'paused';
    this.currentTime = 0;
    this.lastUpdatedAt = Date.now();
    this.participantMap = new Map();

    // Add host as first participant
    this.participantMap.set(hostId, {
      userId: hostId,
      username: hostUsername,
      role: 'HOST',
      joinedAt: Date.now(),
    });
  }

  // ─── Participant Management ─────────────────────────────────────────────────

  addParticipant(userId: string, username: string): Participant {
    const participant: Participant = {
      userId,
      username,
      role: 'PARTICIPANT',
      joinedAt: Date.now(),
    };
    this.participantMap.set(userId, participant);
    return participant;
  }

  removeParticipant(userId: string): boolean {
    return this.participantMap.delete(userId);
  }

  getParticipant(userId: string): Participant | undefined {
    return this.participantMap.get(userId);
  }

  hasParticipant(userId: string): boolean {
    return this.participantMap.has(userId);
  }

  getParticipants(): Participant[] {
    return Array.from(this.participantMap.values());
  }

  isEmpty(): boolean {
    return this.participantMap.size === 0;
  }

  isUsernameTaken(username: string): boolean {
    for (const p of this.participantMap.values()) {
      if (p.username.toLowerCase() === username.toLowerCase()) return true;
    }
    return false;
  }

  // ─── Role Management ────────────────────────────────────────────────────────

  assignRole(userId: string, role: Role): boolean {
    const participant = this.participantMap.get(userId);
    if (!participant) return false;

    // Cannot change HOST role through assignRole (use transferHost instead)
    if (participant.role === 'HOST') return false;

    participant.role = role;
    return true;
  }

  transferHost(newHostId: string): boolean {
    const newHost = this.participantMap.get(newHostId);
    const oldHost = this.participantMap.get(this.hostId);
    if (!newHost || !oldHost) return false;

    // Demote old host to Participant
    oldHost.role = 'PARTICIPANT';
    // Promote new host
    newHost.role = 'HOST';
    this.hostId = newHostId;
    return true;
  }

  // ─── Permission Checks ──────────────────────────────────────────────────────

  canControl(userId: string): boolean {
    const p = this.participantMap.get(userId);
    return p !== undefined && (p.role === 'HOST' || p.role === 'MODERATOR');
  }

  canManageParticipants(userId: string): boolean {
    const p = this.participantMap.get(userId);
    return p !== undefined && p.role === 'HOST';
  }

  // ─── Playback State ─────────────────────────────────────────────────────────

  updatePlayback(playState: PlayState, currentTime: number): void {
    this.playState = playState;
    this.currentTime = currentTime;
    this.lastUpdatedAt = Date.now();
  }

  /**
   * Returns the estimated current playback time, accounting for elapsed
   * time since the state was last recorded (only when playing).
   */
  getEstimatedCurrentTime(): number {
    if (this.playState === 'paused') return this.currentTime;
    const elapsed = (Date.now() - this.lastUpdatedAt) / 1000;
    return this.currentTime + elapsed;
  }

  changeVideo(videoId: string): void {
    this.videoId = videoId;
    this.playState = 'paused';
    this.currentTime = 0;
    this.lastUpdatedAt = Date.now();
  }
}
