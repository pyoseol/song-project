import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import SiteHeader from '../components/layout/SiteHeader';
import RealtimeJamPanel from '../components/collab/RealtimeJamPanel';
import { db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import {
  COLLAB_PRESENCE_PING_INTERVAL_MS,
  COLLAB_PRESENCE_TIMEOUT_MS,
  COLLAB_SESSION_ID,
  type CollabPresence,
} from '../store/collabStore';
import './JamPage.css';

type JamRoom = {
  id: string;
  title: string;
  roomCode: string;
  bpm: number;
  hostEmail: string;
  hostName: string;
  createdAt: number;
  updatedAt: number;
};

const DEFAULT_ROOM_ID = 'main-stage';

function normalizeRoomId(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return normalized || DEFAULT_ROOM_ID;
}

function createRoomId(title: string) {
  return `${normalizeRoomId(title)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function JamPage() {
  const user = useAuthStore((state) => state.user);
  const [rooms, setRooms] = useState<JamRoom[]>([]);
  const [roomTitleDraft, setRoomTitleDraft] = useState('새 합주방');
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [bpm, setBpm] = useState(100);
  const [presence, setPresence] = useState<CollabPresence[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [roomError, setRoomError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 4_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'jam_rooms'),
      (snapshot) => {
        setRoomError('');
        setRooms(
          snapshot.docs
            .map((entry) => {
              const data = entry.data();
              return {
                id: entry.id,
                title: String(data.title ?? '합주방'),
                roomCode: String(data.roomCode ?? entry.id),
                bpm: Number(data.bpm ?? 100),
                hostEmail: String(data.hostEmail ?? ''),
                hostName: String(data.hostName ?? '호스트'),
                createdAt: Number(data.createdAt ?? 0),
                updatedAt: Number(data.updatedAt ?? 0),
              };
            })
            .sort((left, right) => right.updatedAt - left.updatedAt)
        );
      },
      (error) => {
        console.error(error);
        setRoomError('합주방 목록을 불러오지 못했습니다.');
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const presenceQuery = query(collection(db, 'jam_presence'), where('roomId', '==', roomId));
    const unsubscribe = onSnapshot(
      presenceQuery,
      (snapshot) => {
        setRoomError('');
        setPresence(
          snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              projectId: roomId,
              sessionId: String(data.sessionId ?? ''),
              email: String(data.email ?? ''),
              name: String(data.name ?? '게스트'),
              focus: String(data.focus ?? ''),
              lastSeenAt: Number(data.lastSeenAt ?? 0),
            };
          })
        );
      },
      (error) => {
        console.error(error);
        setRoomError('합주방 접속 상태를 불러오지 못했습니다.');
      }
    );

    return () => unsubscribe();
  }, [roomId, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const presenceId = `${roomId}_${COLLAB_SESSION_ID}`;
    const presenceRef = doc(db, 'jam_presence', presenceId);
    const ping = () =>
      setDoc(
        presenceRef,
        {
          roomId,
          sessionId: COLLAB_SESSION_ID,
          email: user.email,
          name: user.name,
          focus: 'jam',
          lastSeenAt: Date.now(),
        },
        { merge: true }
      );

    void ping().catch((error) => {
      console.error(error);
      setRoomError('합주방에 입장하지 못했습니다.');
    });

    const timer = window.setInterval(() => {
      void ping().catch(console.error);
    }, COLLAB_PRESENCE_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      void deleteDoc(presenceRef).catch(console.error);
    };
  }, [roomId, user]);

  const activeParticipants = useMemo(
    () =>
      user
        ? presence.filter(
            (participant) => now - participant.lastSeenAt <= COLLAB_PRESENCE_TIMEOUT_MS
          )
        : [],
    [now, presence, user]
  );

  const currentRoomId = normalizeRoomId(roomId);
  const currentRoom = rooms.find((room) => room.roomCode === currentRoomId) ?? null;
  const roomProjectId = `jam-${currentRoomId}`;

  const joinRoom = (nextRoomCode: string, nextBpm = bpm) => {
    const normalizedRoomId = normalizeRoomId(nextRoomCode);
    setRoomId(normalizedRoomId);
    setBpm(Math.min(240, Math.max(40, nextBpm)));
  };

  const createRoom = async () => {
    if (!user) {
      setRoomError('합주방을 만들려면 로그인이 필요합니다.');
      return;
    }

    const title = roomTitleDraft.trim() || '새 합주방';
    const nextRoomCode = createRoomId(title);
    const nowTime = Date.now();

    try {
      setRoomError('');
      await setDoc(doc(db, 'jam_rooms', nextRoomCode), {
        title,
        roomCode: nextRoomCode,
        bpm,
        hostEmail: user.email,
        hostName: user.name,
        createdAt: nowTime,
        updatedAt: nowTime,
      });
      joinRoom(nextRoomCode, bpm);
    } catch (error) {
      console.error(error);
      setRoomError('합주방을 만들지 못했습니다.');
    }
  };

  return (
    <div className="jam-page">
      <SiteHeader activeSection="jam" />

      <main className="jam-shell">
        <section className="jam-hero">
          <div>
            <span className="jam-kicker">실시간 합주</span>
            <h1>합주방 만들기</h1>
            <p>방을 만들고, 같은 방에 들어온 멤버끼리 바로 합주를 시작합니다.</p>
          </div>

          <div className="jam-room-controls">
            <label>
              <span>방 이름</span>
              <input
                value={roomTitleDraft}
                onChange={(event) => setRoomTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void createRoom();
                  }
                }}
              />
            </label>
            <label>
              <span>BPM</span>
              <input
                type="number"
                min={40}
                max={240}
                value={bpm}
                onChange={(event) =>
                  setBpm(Math.min(240, Math.max(40, Number(event.target.value) || 100)))
                }
              />
            </label>
            <button type="button" className="jam-apply-button" onClick={() => void createRoom()}>
              방 만들기
            </button>
          </div>
        </section>

        {roomError ? <p className="jam-error">{roomError}</p> : null}

        <section className="jam-room-browser">
          <div className="jam-section-head">
            <strong>합주방 목록</strong>
            <span>방을 만들거나 기존 방에 입장하세요.</span>
          </div>

          <div className="jam-room-list">
            {rooms.length ? (
              rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className={`jam-room-card${
                    room.roomCode === currentRoomId ? ' is-active' : ''
                  }`}
                  onClick={() => joinRoom(room.roomCode, room.bpm)}
                >
                  <strong>{room.title}</strong>
                  <span>{room.roomCode}</span>
                  <em>
                    {room.bpm} BPM · {room.hostName}
                  </em>
                </button>
              ))
            ) : (
              <div className="jam-room-empty">아직 열린 합주방이 없습니다.</div>
            )}
          </div>
        </section>

        <section className="jam-layout">
          <RealtimeJamPanel
            projectId={roomProjectId}
            participants={activeParticipants}
            localUser={user ? { email: user.email, name: user.name } : null}
            bpm={bpm}
            disabled={false}
          />

          <aside className="jam-side-panel">
            <strong>현재 방</strong>
            <span>{currentRoom?.title ?? currentRoomId}</span>
            <small>{currentRoomId}</small>
            <div className="jam-participant-list">
              {activeParticipants.length ? (
                activeParticipants.map((participant) => (
                  <div key={participant.sessionId} className="jam-participant-card">
                    <strong>{participant.name}</strong>
                    <span>{participant.sessionId === COLLAB_SESSION_ID ? '나' : participant.email}</span>
                  </div>
                ))
              ) : (
                <p>아직 대기 중인 멤버가 없습니다.</p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
