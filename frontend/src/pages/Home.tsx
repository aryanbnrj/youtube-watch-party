import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Mode = 'choose' | 'create' | 'join';

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-fill join form if someone opened a shared room link
  const joinCode = searchParams.get('join') ?? '';

  const [mode, setMode] = useState<Mode>(joinCode ? 'join' : 'choose');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState(joinCode.toUpperCase());
  const [error, setError] = useState('');

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username.');
      return;
    }
    if (trimmed.length > 30) {
      setError('Username must be 30 characters or less.');
      return;
    }
    // Navigate to a special route — the backend will create the room
    // when the socket connects and sends join_room with a new room ID.
    // We use "new" as a sentinel that the Room page resolves.
    navigate(`/room/new?username=${encodeURIComponent(trimmed)}`);
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedCode = roomCode.trim().toUpperCase();

    if (!trimmedUser) {
      setError('Please enter a username.');
      return;
    }
    if (trimmedUser.length > 30) {
      setError('Username must be 30 characters or less.');
      return;
    }
    if (!trimmedCode || trimmedCode.length < 4) {
      setError('Please enter a valid room code.');
      return;
    }
    navigate(`/room/${trimmedCode}?username=${encodeURIComponent(trimmedUser)}`);
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="logo">▶</div>
        <h1>YouTube Watch Party</h1>
        <p className="tagline">Watch YouTube videos together, in perfect sync.</p>
      </header>

      <main className="home-main">
        {mode === 'choose' && (
          <div className="choose-mode">
            <button className="btn btn-primary btn-large" onClick={() => setMode('create')}>
              Create a Room
            </button>
            <span className="divider">or</span>
            <button className="btn btn-secondary btn-large" onClick={() => setMode('join')}>
              Join a Room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form className="form-card" onSubmit={handleCreate}>
            <h2>Create a Room</h2>
            <p className="form-hint">You'll become the Host and get a shareable room code.</p>
            <label htmlFor="username-create">Your name</label>
            <input
              id="username-create"
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              maxLength={30}
              autoFocus
              autoComplete="off"
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary">
              Create Room
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setMode('choose'); setError(''); }}>
              ← Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form className="form-card" onSubmit={handleJoin}>
            <h2>Join a Room</h2>
            <p className="form-hint">
              {joinCode
                ? `You were invited to room ${joinCode}. Enter your name to join.`
                : 'Enter a room code or paste a room link.'}
            </p>
            <label htmlFor="username-join">Your name</label>
            <input
              id="username-join"
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              maxLength={30}
              autoFocus
              autoComplete="off"
            />
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              type="text"
              placeholder="e.g. AB12CD"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
              maxLength={8}
              autoComplete="off"
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary">
              Join Room
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setMode('choose'); setError(''); }}>
              ← Back
            </button>
          </form>
        )}
      </main>

      <footer className="home-footer">
        <p>No account needed. Just pick a name and start watching.</p>
      </footer>
    </div>
  );
}
