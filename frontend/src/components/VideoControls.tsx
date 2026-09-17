import { useState, FormEvent } from 'react';
import { extractVideoId } from '../utils/youtube';
import type { PlayState } from '../types/index';

interface VideoControlsProps {
  playState: PlayState;
  canControl: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onChangeVideo: (videoId: string) => void;
  currentVideoId: string;
}

export default function VideoControls({
  playState,
  canControl,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo,
  currentVideoId,
}: VideoControlsProps) {
  const [videoInput, setVideoInput] = useState('');
  const [seekInput, setSeekInput] = useState('');
  const [videoError, setVideoError] = useState('');
  const [seekError, setSeekError] = useState('');

  function handleVideoSubmit(e: FormEvent) {
    e.preventDefault();
    const id = extractVideoId(videoInput.trim());
    if (!id) {
      setVideoError('Invalid YouTube URL or video ID.');
      return;
    }
    if (id === currentVideoId) {
      setVideoError('That video is already loaded.');
      return;
    }
    setVideoError('');
    setVideoInput('');
    onChangeVideo(id);
  }

  function handleSeekSubmit(e: FormEvent) {
    e.preventDefault();
    const seconds = parseFloat(seekInput);
    if (isNaN(seconds) || seconds < 0) {
      setSeekError('Enter seconds (e.g. 90)');
      return;
    }
    setSeekError('');
    setSeekInput('');
    onSeek(seconds);
  }

  if (!canControl) {
    return (
      <div className="video-controls">
        <div className="participant-notice">
          <span>👁</span>
          <span>You are watching — only the Host or Moderator can control playback</span>
        </div>
      </div>
    );
  }

  return (
    <div className="video-controls">
      {/* ── Row 1: Play/Pause + status ──────────────────────────────────── */}
      <div className="controls-main">
        {playState === 'playing' ? (
          <button className="btn btn-control btn-pause" onClick={onPause}>
            ⏸ Pause
          </button>
        ) : (
          <button className="btn btn-control btn-play" onClick={onPlay}>
            ▶ Play
          </button>
        )}

        <span className={`playstate-badge ${playState === 'playing' ? 'playing' : ''}`}>
          {playState === 'playing' ? '● Playing' : '● Paused'}
        </span>

        <div className="divider-v" />

        {/* ── Seek ──────────────────────────────────────────────────────── */}
        <form style={{ display: 'flex', alignItems: 'center', gap: 6 }} onSubmit={handleSeekSubmit}>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Seek (sec)"
            value={seekInput}
            onChange={(e) => { setSeekInput(e.target.value); setSeekError(''); }}
            className="input-small"
          />
          <button type="submit" className="btn btn-control">⏩ Go</button>
          {seekError && <span className="inline-error">{seekError}</span>}
        </form>
      </div>

      {/* ── Row 2: Load video ───────────────────────────────────────────── */}
      <form className="controls-secondary" onSubmit={handleVideoSubmit}>
        <input
          type="text"
          placeholder="YouTube URL or video ID"
          value={videoInput}
          onChange={(e) => { setVideoInput(e.target.value); setVideoError(''); }}
          className="input-url"
        />
        <button type="submit" className="btn btn-control">🎬 Load Video</button>
        {videoError && <span className="inline-error">{videoError}</span>}
      </form>
    </div>
  );
}
