import { useEffect, useRef, useCallback, useState } from 'react';
import socket from '../services/socket';
import type {
  RoomState,
  SyncStatePayload,
  UserJoinedPayload,
  UserLeftPayload,
  RoleAssignedPayload,
  ParticipantRemovedPayload,
  PlaybackEventPayload,
  SeekEventPayload,
  VideoChangedPayload,
  PermissionDeniedPayload,
  ErrorPayload,
  YouWereRemovedPayload,
} from '../types/index';

// ─── Event name constants (mirror backend) ───────────────────────────────────

const EV = {
  // C→S
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  CHANGE_VIDEO: 'change_video',
  ASSIGN_ROLE: 'assign_role',
  REMOVE_PARTICIPANT: 'remove_participant',
  TRANSFER_HOST: 'transfer_host',
  // S→C
  SYNC_STATE: 'sync_state',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  ROLE_ASSIGNED: 'role_assigned',
  PARTICIPANT_REMOVED: 'participant_removed',
  PERMISSION_DENIED: 'permission_denied',
  ERROR: 'error',
  YOU_WERE_REMOVED: 'you_were_removed',
  VIDEO_CHANGED: 'video_changed',
} as const;

// ─── Hook interface ──────────────────────────────────────────────────────────

export interface UseRoomReturn {
  roomState: RoomState | null;
  isConnected: boolean;
  error: string | null;
  notification: string | null;

  // Player sync — the Room page calls these when the YT player fires events
  onPlayerPlay: (currentTime: number) => void;
  onPlayerPause: (currentTime: number) => void;
  onPlayerSeek: (time: number) => void;

  // Controls — called by VideoControls buttons
  sendPlay: (currentTime: number) => void;
  sendPause: (currentTime: number) => void;
  sendSeek: (time: number) => void;
  sendChangeVideo: (videoId: string) => void;

  // Host management
  sendAssignRole: (userId: string, role: string) => void;
  sendRemoveParticipant: (userId: string) => void;
  sendTransferHost: (userId: string) => void;

  // Called when the remote server sends a play/pause/seek — the Room page
  // reads this ref to actually drive the YouTube player
  remoteCommandRef: React.MutableRefObject<RemoteCommand | null>;

  // Set to true before directly calling player.play/pause/seek from a button
  // so onStateChange knows not to re-emit to the server
  isButtonActionRef: React.MutableRefObject<boolean>;

  clearError: () => void;
  clearNotification: () => void;
}

export interface RemoteCommand {
  type: 'play' | 'pause' | 'seek' | 'change_video';
  currentTime?: number;
  time?: number;
  videoId?: string;
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useRoom(roomId: string, username: string): UseRoomReturn {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  /**
   * remoteCommandRef holds the latest command from the server.
   * The YouTubePlayer component watches this ref via useEffect and applies it.
   * Using a ref (not state) avoids unnecessary re-renders on every sync event.
   */
  const remoteCommandRef = useRef<RemoteCommand | null>(null);

  /**
   * isApplyingRemote — prevents the infinite loop:
   *   Server sends play → we call player.playVideo() → player fires onStateChange
   *   → we would emit play again → server broadcasts again → infinite loop
   *
   * Also set when the VideoControls button directly calls player.playVideo()
   * since in that case we've already emitted to the server above.
   */
  const isApplyingRemoteRef = useRef(false);

  /**
   * isButtonAction — set when the VideoControls button drives the local player.
   * Prevents onStateChange from emitting a second time to the server.
   */
  const isButtonActionRef = useRef(false);

  const upperRoomId = roomId.toUpperCase();

  // ── Connect and join ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !username) return;

    // Remove any stale listeners before registering fresh ones.
    // Needed because React StrictMode mounts → unmounts → remounts in dev,
    // and socket is a module-level singleton that persists across remounts.
    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');

    function joinRoom() {
      setIsConnected(true);
      socket.emit(EV.JOIN_ROOM, { roomId: upperRoomId, username });
    }

    socket.on('connect', joinRoom);
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () =>
      setError('Unable to connect to the server. Please try again.')
    );

    // If the socket is already connected (e.g. StrictMode second mount),
    // the 'connect' event won't fire again — emit join_room immediately.
    if (socket.connected) {
      joinRoom();
    } else {
      socket.connect();
    }

    // ── Server → Client events ─────────────────────────────────────────────

    socket.on(EV.SYNC_STATE, (payload: SyncStatePayload) => {
      const myUserId = socket.id ?? '';
      const me = payload.participants.find((p) => p.userId === myUserId);
      setRoomState({
        roomId: upperRoomId,
        videoId: payload.videoId,
        playState: payload.playState,
        currentTime: payload.currentTime,
        participants: payload.participants,
        myUserId,
        myRole: me?.role ?? 'PARTICIPANT',
      });
      // Tell the player to load the right video at the right time
      remoteCommandRef.current = {
        type: payload.playState === 'playing' ? 'play' : 'pause',
        currentTime: payload.currentTime,
        videoId: payload.videoId,
      };
    });

    socket.on(EV.USER_JOINED, (payload: UserJoinedPayload) => {
      setRoomState((prev) =>
        prev ? { ...prev, participants: payload.participants } : prev
      );
      setNotification(`${payload.participant.username} joined the room.`);
    });

    socket.on(EV.USER_LEFT, (payload: UserLeftPayload) => {
      setRoomState((prev) =>
        prev ? { ...prev, participants: payload.participants } : prev
      );
      setNotification(`${payload.username} left the room.`);
    });

    socket.on(EV.ROLE_ASSIGNED, (payload: RoleAssignedPayload) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        const myUserId = socket.id ?? '';
        const me = payload.participants.find((p) => p.userId === myUserId);
        return {
          ...prev,
          participants: payload.participants,
          myRole: me?.role ?? prev.myRole,
        };
      });
    });

    socket.on(EV.PARTICIPANT_REMOVED, (payload: ParticipantRemovedPayload) => {
      setRoomState((prev) =>
        prev ? { ...prev, participants: payload.participants } : prev
      );
      setNotification(`${payload.username} was removed from the room.`);
    });

    // Remote play — server tells us to play
    socket.on(EV.PLAY, (payload: PlaybackEventPayload) => {
      setRoomState((prev) =>
        prev ? { ...prev, playState: 'playing', currentTime: payload.currentTime } : prev
      );
      isApplyingRemoteRef.current = true;
      remoteCommandRef.current = { type: 'play', currentTime: payload.currentTime };
    });

    // Remote pause
    socket.on(EV.PAUSE, (payload: PlaybackEventPayload) => {
      setRoomState((prev) =>
        prev ? { ...prev, playState: 'paused', currentTime: payload.currentTime } : prev
      );
      isApplyingRemoteRef.current = true;
      remoteCommandRef.current = { type: 'pause', currentTime: payload.currentTime };
    });

    // Remote seek
    socket.on(EV.SEEK, (payload: SeekEventPayload) => {
      setRoomState((prev) =>
        prev ? { ...prev, currentTime: payload.time } : prev
      );
      isApplyingRemoteRef.current = true;
      remoteCommandRef.current = { type: 'seek', time: payload.time };
    });

    // Remote video change
    socket.on(EV.VIDEO_CHANGED, (payload: VideoChangedPayload) => {
      setRoomState((prev) =>
        prev
          ? { ...prev, videoId: payload.videoId, playState: 'paused', currentTime: 0 }
          : prev
      );
      isApplyingRemoteRef.current = true;
      remoteCommandRef.current = { type: 'change_video', videoId: payload.videoId };
    });

    socket.on(EV.PERMISSION_DENIED, (payload: PermissionDeniedPayload) => {
      setError(payload.message);
    });

    socket.on(EV.ERROR, (payload: ErrorPayload) => {
      setError(payload.message);
    });

    socket.on(EV.YOU_WERE_REMOVED, (payload: YouWereRemovedPayload) => {
      setError(payload.message);
      setRoomState(null);
    });

    return () => {
      socket.emit(EV.LEAVE_ROOM, { roomId: upperRoomId });
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [roomId, username, upperRoomId]);

  // ── Emit helpers (called by the player / controls) ─────────────────────────

  /**
   * Called by the YouTube player's onStateChange when the LOCAL user presses play.
   * We guard with isApplyingRemoteRef and isButtonActionRef to prevent double-emit.
   */
  const onPlayerPlay = useCallback(
    (currentTime: number) => {
      if (isApplyingRemoteRef.current) {
        isApplyingRemoteRef.current = false;
        return;
      }
      if (isButtonActionRef.current) {
        // Button already emitted to server — just clear the flag, don't re-emit
        isButtonActionRef.current = false;
        return;
      }
      if (!roomState) return;
      socket.emit(EV.PLAY, { roomId: upperRoomId, currentTime });
    },
    [roomState, upperRoomId]
  );

  const onPlayerPause = useCallback(
    (currentTime: number) => {
      if (isApplyingRemoteRef.current) {
        isApplyingRemoteRef.current = false;
        return;
      }
      if (isButtonActionRef.current) {
        isButtonActionRef.current = false;
        return;
      }
      if (!roomState) return;
      socket.emit(EV.PAUSE, { roomId: upperRoomId, currentTime });
    },
    [roomState, upperRoomId]
  );

  const onPlayerSeek = useCallback(
    (time: number) => {
      if (isApplyingRemoteRef.current) {
        isApplyingRemoteRef.current = false;
        return;
      }
      if (isButtonActionRef.current) {
        isButtonActionRef.current = false;
        return;
      }
      if (!roomState) return;
      socket.emit(EV.SEEK, { roomId: upperRoomId, time });
    },
    [roomState, upperRoomId]
  );

  // These are called by the VideoControls buttons (explicit user intent)
  const sendPlay = useCallback(
    (currentTime: number) => {
      socket.emit(EV.PLAY, { roomId: upperRoomId, currentTime });
    },
    [upperRoomId]
  );

  const sendPause = useCallback(
    (currentTime: number) => {
      socket.emit(EV.PAUSE, { roomId: upperRoomId, currentTime });
    },
    [upperRoomId]
  );

  const sendSeek = useCallback(
    (time: number) => {
      socket.emit(EV.SEEK, { roomId: upperRoomId, time });
    },
    [upperRoomId]
  );

  const sendChangeVideo = useCallback(
    (videoId: string) => {
      socket.emit(EV.CHANGE_VIDEO, { roomId: upperRoomId, videoId });
    },
    [upperRoomId]
  );

  const sendAssignRole = useCallback(
    (userId: string, role: string) => {
      socket.emit(EV.ASSIGN_ROLE, { roomId: upperRoomId, userId, role });
    },
    [upperRoomId]
  );

  const sendRemoveParticipant = useCallback(
    (userId: string) => {
      socket.emit(EV.REMOVE_PARTICIPANT, { roomId: upperRoomId, userId });
    },
    [upperRoomId]
  );

  const sendTransferHost = useCallback(
    (userId: string) => {
      socket.emit(EV.TRANSFER_HOST, { roomId: upperRoomId, userId });
    },
    [upperRoomId]
  );

  return {
    roomState,
    isConnected,
    error,
    notification,
    onPlayerPlay,
    onPlayerPause,
    onPlayerSeek,
    sendPlay,
    sendPause,
    sendSeek,
    sendChangeVideo,
    sendAssignRole,
    sendRemoveParticipant,
    sendTransferHost,
    remoteCommandRef,
    isButtonActionRef,
    clearError: () => setError(null),
    clearNotification: () => setNotification(null),
  };
}
