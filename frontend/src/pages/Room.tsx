import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { generateRoomId } from '../utils/roomId';
import { useRoom } from '../hooks/useRoom';
import YouTubePlayer, { type YouTubePlayerHandle } from '../components/YouTubePlayer';
import VideoControls from '../components/VideoControls';
import ParticipantList from '../components/ParticipantList';
import type { Role } from '../types/index';

export default function Room() {
  const { roomId: rawRoomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const username = searchParams.get('username') ?? '';

  // If "new" was passed, generate a fresh room ID on the client side
  // The server will create the room when the socket connects and sends join_room
  const [resolvedRoomId] = useState<string>(() => {
    if (!rawRoomId || rawRoomId === 'new') return generateRoomId();
    return rawRoomId.toUpperCase();
  });

  // Redirect to home if no username was provided (e.g. someone opened the shared link)
  // Pass the room code so Home can pre-fill the join form
  useEffect(() => {
    if (!username) {
      navigate(`/?join=${resolvedRoomId}`, { replace: true });
    }
  }, [username, navigate, resolvedRoomId]);

  // Replace the URL with the real room ID so it's shareable
  useEffect(() => {
    if (rawRoomId === 'new') {
      window.history.replaceState(
        null,
        '',
        `/room/${resolvedRoomId}?username=${encodeURIComponent(username)}`
      );
    }
  }, [rawRoomId, resolvedRoomId, username]);

  const {
    roomState,
    isConnected,
    error,
    notification,
    sendPlay,
    sendPause,
    sendSeek,
    sendChangeVideo,
    sendAssignRole,
    sendRemoveParticipant,
    sendTransferHost,
    remoteCommandRef,
    isButtonActionRef,
    clearError,
    clearNotification,
  } = useRoom(resolvedRoomId, username);

  // ── Player ref — we need to read getCurrentTime from the YT player ──────────
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const [copied, setCopied] = useState(false);

  function copyInviteLink() {
    // Copy a clean URL with just the room code — no username embedded.
    // Recipient will be prompted to enter their name on the Home page,
    // then redirected into the room.
    const url = `${window.location.origin}/room/${resolvedRoomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for browsers that block clipboard without HTTPS
      prompt('Copy this invite link:', `${window.location.origin}/room/${resolvedRoomId}`);
    });
  }

  // Auto-dismiss notification after 3 seconds
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(clearNotification, 3000);
    return () => clearTimeout(t);
  }, [notification, clearNotification]);

  // ── If we were removed, go home ──────────────────────────────────────────────
  useEffect(() => {
    if (error?.includes('removed from the room')) {
      const t = setTimeout(() => navigate('/', { replace: true }), 3000);
      return () => clearTimeout(t);
    }
  }, [error, navigate]);

  if (!username) return null; // Redirecting

  const canControl = roomState?.myRole === 'HOST' || roomState?.myRole === 'MODERATOR';
  const isHost = roomState?.myRole === 'HOST';

  return (
    <div className="room-container">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="room-header">
        <div className="room-header-left">
          <span className="logo-small">▶</span>
          <span className="app-name">Watch Party</span>
        </div>
        <div className="room-header-center">
          <span className="room-code-label">Room:</span>
          <span className="room-code">{resolvedRoomId}</span>
          <button className="btn btn-copy" onClick={copyInviteLink}>
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
        </div>
        <div className="room-header-right">
          {isConnected ? (
            <span className="status connected">
              <span className="status-dot" /> Live
            </span>
          ) : (
            <span className="status disconnected">
              <span className="status-dot" /> Connecting…
            </span>
          )}
        </div>
      </header>

      {/* ── Notifications / Errors ──────────────────────────────────────── */}
      {notification && (
        <div className="toast toast-info" onClick={clearNotification}>
          {notification}
        </div>
      )}
      {error && (
        <div className="toast toast-error" onClick={clearError}>
          ⚠ {error}
        </div>
      )}

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="room-body">
        {/* Left — player + controls */}
        <div className="player-section">
          {roomState ? (
            <>
              <YouTubePlayer
                ref={playerRef}
                videoId={roomState.videoId}
                canControl={canControl}
                remoteCommandRef={remoteCommandRef}
                onPlay={(currentTime) => sendPlay(currentTime)}
                onPause={(currentTime) => sendPause(currentTime)}
                onSeek={(time) => sendSeek(time)}
              />
              <VideoControls
                playState={roomState.playState}
                canControl={canControl}
                currentVideoId={roomState.videoId}
                onPlay={() => {
                  // Emit to server — server broadcasts back to everyone including
                  // us, which updates roomState.playState AND drives the player
                  sendPlay(playerRef.current?.getCurrentTime() ?? 0);
                }}
                onPause={() => {
                  sendPause(playerRef.current?.getCurrentTime() ?? 0);
                }}
                onSeek={(time) => {
                  // Seek: drive local player immediately for responsiveness,
                  // then tell server to broadcast to everyone else
                  isButtonActionRef.current = true;
                  playerRef.current?.seekTo(time);
                  sendSeek(time);
                }}
                onChangeVideo={sendChangeVideo}
              />
            </>
          ) : (
            <div className="player-loading">
              <div className="spinner" />
              <p>Connecting to room…</p>
            </div>
          )}
        </div>

        {/* Right — participants */}
        <aside className="sidebar">
          {roomState && (
            <ParticipantList
              participants={roomState.participants}
              myUserId={roomState.myUserId}
              isHost={isHost}
              onAssignRole={(userId, role) => sendAssignRole(userId, role as Role)}
              onRemoveParticipant={sendRemoveParticipant}
              onTransferHost={sendTransferHost}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
