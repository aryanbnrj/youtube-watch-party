import type { Participant, Role } from '../types/index';

interface ParticipantListProps {
  participants: Participant[];
  myUserId: string;
  isHost: boolean;
  onAssignRole: (userId: string, role: Role) => void;
  onRemoveParticipant: (userId: string) => void;
  onTransferHost: (userId: string) => void;
}

const ROLE_LABELS: Record<Role, string> = {
  HOST:        '👑 Host',
  MODERATOR:   '🛡 Mod',
  PARTICIPANT: '👤 Viewer',
};

const ROLE_CLASSES: Record<Role, string> = {
  HOST:        'badge badge-host',
  MODERATOR:   'badge badge-mod',
  PARTICIPANT: 'badge badge-participant',
};

export default function ParticipantList({
  participants,
  myUserId,
  isHost,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}: ParticipantListProps) {
  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>Participants</span>
          <span className="sidebar-count">{participants.length}</span>
        </div>
      </div>

      <div className="participant-list">
        {participants.map((p) => (
          <div
            key={p.userId}
            className={`participant-item ${p.userId === myUserId ? 'me' : ''}`}
          >
            <div className="participant-info">
              <span className="participant-name">
                {p.username}
                {p.userId === myUserId && (
                  <span className="you-tag"> (you)</span>
                )}
              </span>
              <span className={ROLE_CLASSES[p.role]}>{ROLE_LABELS[p.role]}</span>
            </div>

            {/* Host management — only visible to Host, never for themselves */}
            {isHost && p.userId !== myUserId && (
              <div className="participant-actions">
                {p.role === 'PARTICIPANT' && (
                  <button
                    className="btn btn-tiny btn-mod"
                    onClick={() => onAssignRole(p.userId, 'MODERATOR')}
                    title="Make Moderator"
                  >
                    Make Mod
                  </button>
                )}
                {p.role === 'MODERATOR' && (
                  <button
                    className="btn btn-tiny"
                    onClick={() => onAssignRole(p.userId, 'PARTICIPANT')}
                    title="Remove Moderator role"
                  >
                    Demote
                  </button>
                )}
                <button
                  className="btn btn-tiny btn-transfer"
                  onClick={() => {
                    if (window.confirm(`Transfer host to ${p.username}?`)) {
                      onTransferHost(p.userId);
                    }
                  }}
                >
                  Host →
                </button>
                <button
                  className="btn btn-tiny btn-danger"
                  onClick={() => {
                    if (window.confirm(`Remove ${p.username} from the room?`)) {
                      onRemoveParticipant(p.userId);
                    }
                  }}
                >
                  Kick
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
