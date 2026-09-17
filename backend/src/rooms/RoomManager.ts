import { Room } from './Room';

/**
 * RoomManager is a singleton-style in-memory store for all active rooms.
 * Structure is designed so it can be swapped for a DB-backed store later
 * by replacing just this class while keeping the same interface.
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(roomId: string, hostId: string, hostUsername: string): Room {
    // Use the client-supplied room ID (already validated as unique by caller)
    const room = new Room(roomId, hostId, hostUsername);
    this.rooms.set(roomId, room);
    console.log(`[RoomManager] Room created: ${roomId} by ${hostUsername}`);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    console.log(`[RoomManager] Room deleted: ${roomId}`);
  }

  /**
   * Remove a participant from a room. If the room becomes empty, delete it.
   * If the host leaves and others remain, transfer host to the next participant.
   */
  handleParticipantLeave(roomId: string, userId: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const leavingParticipant = room.getParticipant(userId);
    room.removeParticipant(userId);

    if (room.isEmpty()) {
      this.deleteRoom(roomId);
      return null;
    }

    // If the host left, auto-transfer host to the longest-standing participant
    if (leavingParticipant?.role === 'HOST') {
      const remaining = room.getParticipants().sort((a, b) => a.joinedAt - b.joinedAt);
      if (remaining.length > 0) {
        room.transferHost(remaining[0].userId);
        console.log(`[RoomManager] Host transferred to ${remaining[0].username} in room ${roomId}`);
      }
    }

    return room;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}

// Export a single shared instance — the whole server shares one RoomManager
export const roomManager = new RoomManager();
