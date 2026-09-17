import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  MutableRefObject,
} from 'react';
import type { RemoteCommand } from '../hooks/useRoom';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface YouTubePlayerHandle {
  getCurrentTime: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
}

interface YouTubePlayerProps {
  videoId: string;
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onSeek: (time: number) => void;
  remoteCommandRef: MutableRefObject<RemoteCommand | null>;
  canControl: boolean;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, onPlay, onPause, onSeek, remoteCommandRef, canControl },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const isReadyRef = useRef(false);
    const currentVideoIdRef = useRef<string>(videoId);

    // Store the latest callbacks in a ref so the player's onStateChange closure
    // always calls the current version — avoids the stale closure bug.
    const callbacksRef = useRef({ onPlay, onPause, onSeek });
    useEffect(() => {
      callbacksRef.current = { onPlay, onPause, onSeek };
    });

    // Tracks the last time we applied a seek (remote or native drag).
    // Used to distinguish a seek-triggered pause from a real pause.
    const lastSeekTimeRef = useRef<number>(0);

    // Expose player controls to the parent (Room page)
    useImperativeHandle(ref, () => ({
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      playVideo: () => {
        if (playerRef.current && isReadyRef.current) playerRef.current.playVideo();
      },
      pauseVideo: () => {
        if (playerRef.current && isReadyRef.current) playerRef.current.pauseVideo();
      },
      seekTo: (seconds: number) => {
        if (playerRef.current && isReadyRef.current) {
          lastSeekTimeRef.current = seconds;
          playerRef.current.seekTo(seconds, true);
        }
      },
    }));

    // ── Apply a remote command written into remoteCommandRef ──────────────
    const applyRemoteCommand = useCallback((cmd: RemoteCommand) => {
      const player = playerRef.current;
      if (!player || !isReadyRef.current) return;

      if (cmd.type === 'change_video' && cmd.videoId) {
        currentVideoIdRef.current = cmd.videoId;
        player.loadVideoById(cmd.videoId, 0);
        return;
      }

      if (cmd.type === 'seek' && cmd.time !== undefined) {
        lastSeekTimeRef.current = cmd.time;
        player.seekTo(cmd.time, true);
        return;
      }

      if (cmd.type === 'play') {
        if (cmd.currentTime !== undefined) {
          const current = player.getCurrentTime() ?? 0;
          if (Math.abs(current - cmd.currentTime) > 2) {
            lastSeekTimeRef.current = cmd.currentTime;
            player.seekTo(cmd.currentTime, true);
          }
        }
        player.playVideo();
        return;
      }

      if (cmd.type === 'pause') {
        if (cmd.currentTime !== undefined) {
          const current = player.getCurrentTime() ?? 0;
          if (Math.abs(current - cmd.currentTime) > 2) {
            lastSeekTimeRef.current = cmd.currentTime;
            player.seekTo(cmd.currentTime, true);
          }
        }
        player.pauseVideo();
        return;
      }
    }, []);

    // Poll remoteCommandRef every 100ms and apply any pending command.
    // We poll instead of using a useEffect because refs don't trigger renders.
    useEffect(() => {
      const interval = setInterval(() => {
        if (remoteCommandRef.current && isReadyRef.current) {
          const cmd = remoteCommandRef.current;
          remoteCommandRef.current = null;
          applyRemoteCommand(cmd);
        }
      }, 100);
      return () => clearInterval(interval);
    }, [remoteCommandRef, applyRemoteCommand]);

    // ── Initialize YouTube IFrame player (runs once) ───────────────────────
    useEffect(() => {
      function createPlayer() {
        if (!containerRef.current) return;

        new window.YT.Player(containerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: canControl ? 1 : 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            enablejsapi: 1,
          },
          events: {
            onReady: (event: YT.PlayerEvent) => {
              playerRef.current = event.target;
              currentVideoIdRef.current = videoId;
              isReadyRef.current = true;
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              // Always read from callbacksRef so we get the latest props,
              // not the stale closure captured at player creation time.
              handleStateChange(event.data);
            },
            onError: (event: YT.OnErrorEvent) => {
              console.error('[YouTube Player] Error code:', event.data);
            },
          },
        });
      }

      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          createPlayer();
        };
      }

      return () => {
        isReadyRef.current = false;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Handle video ID changes after initial mount ────────────────────────
    useEffect(() => {
      if (!isReadyRef.current || !playerRef.current) return;
      if (currentVideoIdRef.current === videoId) return;
      currentVideoIdRef.current = videoId;
      playerRef.current.loadVideoById(videoId, 0);
    }, [videoId]);

    // ── State-change handler ───────────────────────────────────────────────
    // Uses callbacksRef so it always calls the latest onPlay/onPause/onSeek.
    const handleStateChange = useCallback((state: number) => {
      const player = playerRef.current;
      if (!player || !isReadyRef.current) return;

      if (state === window.YT.PlayerState.PLAYING) {
        callbacksRef.current.onPlay(player.getCurrentTime());
      } else if (state === window.YT.PlayerState.PAUSED) {
        const currentTime = player.getCurrentTime();
        const diff = Math.abs(currentTime - lastSeekTimeRef.current);
        if (diff > 1) {
          callbacksRef.current.onPause(currentTime);
        } else {
          callbacksRef.current.onSeek(currentTime);
        }
        lastSeekTimeRef.current = currentTime;
      }
    }, []); // stable — reads latest callbacks through callbacksRef

    return (
      <div className="youtube-player-wrapper">
        <div ref={containerRef} className="youtube-player" />
        {/* Block all mouse interaction for participants.
            Without this, clicking the iframe pauses/plays regardless of role. */}
        {!canControl && <div className="player-overlay" />}
      </div>
    );
  }
);

export default YouTubePlayer;
