import { Server, Socket } from 'socket.io';
import { roomManager } from '../rooms/RoomManager';
import { CLIENT_EVENTS, SERVER_EVENTS } from './socketEvents';
import { isValidRole, isValidVideoId, isValidTime } from '../utils/permissions';
import type {
  JoinRoomPayload,
  PlayPayload,
  PausePayload,
  SeekPayload,
  ChangeVideoPayload,
  AssignRolePayload,
  RemoveParticipantPayload,
} from '../types/index';

// ─── Helper: send permission denied ─────────────────────────────────────────

function permissionDenied(socket: Socket, message: string): void {
  socket.emit(SERVER_EVENTS.PERMISSION_DENIED, { message });
  console.warn(`[RBAC] Permission denied for ${socket.id}: ${message}`);
}

// ─── Register all handlers for one socket connection ─────────────────────────

export function registerSocketHandlers(io: Server, socket: Socket): void {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
    const { roomId, username } = payload ?? {};

    // Validate inputs
    if (!roomId || typeof roomId !== 'string') {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid room ID.' });
      return;
    }
    if (!username || typeof username !== 'string' || username.trim() === '') {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Username is required.' });
      return;
    }

    const trimmedUsername = username.trim().slice(0, 30);
    const upperRoomId = roomId.toUpperCase();

    let room = roomManager.getRoom(upperRoomId);

    // Room doesn't exist — create it using the client-supplied ID, make this socket Host
    if (!room) {
      room = roomManager.createRoom(upperRoomId, socket.id, trimmedUsername);
      socket.join(room.roomId);

      socket.emit(SERVER_EVENTS.SYNC_STATE, {
        videoId: room.videoId,
        playState: room.playState,
        currentTime: room.getEstimatedCurrentTime(),
        participants: room.getParticipants(),
      });

      console.log(`[Room] ${trimmedUsername} created room ${room.roomId}`);
      return;
    }

    // Room exists — validate before joining
    if (room.hasParticipant(socket.id)) {
      // Reconnecting on the same socket (unlikely but safe)
      socket.join(upperRoomId);
      socket.emit(SERVER_EVENTS.SYNC_STATE, {
        videoId: room.videoId,
        playState: room.playState,
        currentTime: room.getEstimatedCurrentTime(),
        participants: room.getParticipants(),
      });
      return;
    }

    if (room.isUsernameTaken(trimmedUsername)) {
      socket.emit(SERVER_EVENTS.ERROR, {
        message: `Username "${trimmedUsername}" is already taken in this room.`,
      });
      return;
    }

    // Join as participant
    const participant = room.addParticipant(socket.id, trimmedUsername);
    socket.join(upperRoomId);

    // Send current room state to the new joiner so they sync immediately
    socket.emit(SERVER_EVENTS.SYNC_STATE, {
      videoId: room.videoId,
      playState: room.playState,
      currentTime: room.getEstimatedCurrentTime(),
      participants: room.getParticipants(),
    });

    // Tell everyone else someone joined
    socket.to(upperRoomId).emit(SERVER_EVENTS.USER_JOINED, {
      participant,
      participants: room.getParticipants(),
    });

    console.log(`[Room] ${trimmedUsername} joined room ${upperRoomId}`);
  });

  // ── leave_room ─────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.LEAVE_ROOM, (payload: { roomId: string }) => {
    handleLeave(io, socket, payload?.roomId);
  });

  // ── play ───────────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.PLAY, (payload: PlayPayload) => {
    const { roomId, currentTime } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    // BACKEND RBAC — never trust the client
    if (!room.canControl(socket.id)) {
      permissionDenied(socket, 'Only Host or Moderator can play the video.');
      return;
    }

    const time = isValidTime(currentTime) ? currentTime : room.getEstimatedCurrentTime();
    room.updatePlayback('playing', time);

    // Broadcast to ALL including sender so sender's roomState.playState updates
    // and the Play/Pause button flips. The sender's isApplyingRemoteRef prevents
    // the echo from being re-emitted back to the server.
    io.to(room.roomId).emit(SERVER_EVENTS.PLAY, { currentTime: time });
    console.log(`[Sync] PLAY in ${room.roomId} at ${time.toFixed(2)}s`);
  });

  // ── pause ──────────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.PAUSE, (payload: PausePayload) => {
    const { roomId, currentTime } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    if (!room.canControl(socket.id)) {
      permissionDenied(socket, 'Only Host or Moderator can pause the video.');
      return;
    }

    const time = isValidTime(currentTime) ? currentTime : room.currentTime;
    room.updatePlayback('paused', time);

    // Broadcast to ALL including sender — same reason as play
    io.to(room.roomId).emit(SERVER_EVENTS.PAUSE, { currentTime: time });
    console.log(`[Sync] PAUSE in ${room.roomId} at ${time.toFixed(2)}s`);
  });

  // ── seek ───────────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.SEEK, (payload: SeekPayload) => {
    const { roomId, time } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    if (!room.canControl(socket.id)) {
      permissionDenied(socket, 'Only Host or Moderator can seek.');
      return;
    }

    if (!isValidTime(time)) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid seek time.' });
      return;
    }

    room.updatePlayback(room.playState, time);

    // Broadcast seek to ALL clients including sender so everyone snaps to time
    io.to(room.roomId).emit(SERVER_EVENTS.SEEK, { time });
    console.log(`[Sync] SEEK in ${room.roomId} to ${time.toFixed(2)}s`);
  });

  // ── change_video ───────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.CHANGE_VIDEO, (payload: ChangeVideoPayload) => {
    const { roomId, videoId } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    if (!room.canControl(socket.id)) {
      permissionDenied(socket, 'Only Host or Moderator can change the video.');
      return;
    }

    if (!videoId || !isValidVideoId(videoId)) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid YouTube video ID.' });
      return;
    }

    room.changeVideo(videoId);

    // Broadcast to ALL including sender — sender's input triggered it but
    // everyone (including sender) needs to load the new video
    io.to(room.roomId).emit(SERVER_EVENTS.VIDEO_CHANGED, { videoId });
    console.log(`[Sync] VIDEO_CHANGED in ${room.roomId} to ${videoId}`);
  });

  // ── assign_role ────────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.ASSIGN_ROLE, (payload: AssignRolePayload) => {
    const { roomId, userId, role } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    // Only HOST can assign roles
    if (!room.canManageParticipants(socket.id)) {
      permissionDenied(socket, 'Only Host can assign roles.');
      return;
    }

    if (!userId || !isValidRole(role)) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid role assignment payload.' });
      return;
    }

    // Cannot reassign the host role through this event
    if (userId === room.hostId) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Cannot change the Host role.' });
      return;
    }

    const success = room.assignRole(userId, role);
    if (!success) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Could not assign role.' });
      return;
    }

    io.to(room.roomId).emit(SERVER_EVENTS.ROLE_ASSIGNED, {
      userId,
      role,
      participants: room.getParticipants(),
    });
    console.log(`[RBAC] ${userId} assigned role ${role} in ${room.roomId}`);
  });

  // ── remove_participant ─────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.REMOVE_PARTICIPANT, (payload: RemoveParticipantPayload) => {
    const { roomId, userId } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    if (!room.canManageParticipants(socket.id)) {
      permissionDenied(socket, 'Only Host can remove participants.');
      return;
    }

    // Host cannot remove themselves
    if (userId === socket.id) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'You cannot remove yourself.' });
      return;
    }

    const target = room.getParticipant(userId);
    if (!target) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Participant not found.' });
      return;
    }

    room.removeParticipant(userId);

    // Tell the removed user they've been kicked
    io.to(userId).emit(SERVER_EVENTS.YOU_WERE_REMOVED, {
      message: 'You have been removed from the room by the host.',
    });

    // Tell everyone else who was removed
    io.to(room.roomId).emit(SERVER_EVENTS.PARTICIPANT_REMOVED, {
      userId,
      username: target.username,
      participants: room.getParticipants(),
    });

    console.log(`[Room] ${target.username} removed from ${room.roomId}`);
  });

  // ── transfer_host ──────────────────────────────────────────────────────────
  socket.on(CLIENT_EVENTS.TRANSFER_HOST, (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload ?? {};
    const room = roomManager.getRoom(roomId?.toUpperCase());

    if (!room) return;
    if (!room.hasParticipant(socket.id)) return;

    // Only current host can transfer
    if (room.hostId !== socket.id) {
      permissionDenied(socket, 'Only the current Host can transfer host role.');
      return;
    }

    if (!userId || userId === socket.id) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid transfer target.' });
      return;
    }

    const success = room.transferHost(userId);
    if (!success) {
      socket.emit(SERVER_EVENTS.ERROR, { message: 'Could not transfer host.' });
      return;
    }

    io.to(room.roomId).emit(SERVER_EVENTS.ROLE_ASSIGNED, {
      userId: 'multiple', // signal client to re-render the full list
      role: 'HOST',
      participants: room.getParticipants(),
    });
    console.log(`[RBAC] Host transferred to ${userId} in ${room.roomId}`);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    // Find which room this socket was in and clean up
    // We check all rooms because a socket can only be in one room
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue; // skip the default personal room

      const leavingParticipant = roomManager.getRoom(roomId)?.getParticipant(socket.id);
      const room = roomManager.handleParticipantLeave(roomId, socket.id);

      if (room) {
        io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, {
          userId: socket.id,
          username: leavingParticipant?.username ?? 'Unknown',
          participants: room.getParticipants(),
        });
      }
    }
  });
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function handleLeave(io: Server, socket: Socket, rawRoomId: string): void {
  if (!rawRoomId) return;
  const roomId = rawRoomId.toUpperCase();
  const leavingParticipant = roomManager.getRoom(roomId)?.getParticipant(socket.id);

  const room = roomManager.handleParticipantLeave(roomId, socket.id);
  socket.leave(roomId);

  if (room) {
    io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, {
      userId: socket.id,
      username: leavingParticipant?.username ?? 'Unknown',
      participants: room.getParticipants(),
    });
  }
}
