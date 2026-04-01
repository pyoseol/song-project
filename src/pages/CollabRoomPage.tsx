import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  COLLAB_PRESENCE_PING_INTERVAL_MS,
  COLLAB_PRESENCE_TIMEOUT_MS,
  useCollabStore,
  type CollabProject,
  type CollabStatus,
} from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import { useSongStore } from '../store/songStore';
import './CollabPage.css';
import './CollabRoomPage.css';

const STATUS_OPTIONS: Array<{ key: CollabStatus; label: string }> = [
  { key: 'planning', label: '준비 중' },
  { key: 'working', label: '작업 중' },
  { key: 'feedback', label: '피드백' },
];

function formatDateTime(value: number) {
  return new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusLabel(status: CollabProject['status']) {
  return STATUS_OPTIONS.find((option) => option.key === status)?.label ?? status;
}

export default function CollabRoomPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const user = useAuthStore((state) => state.user);
  const projects = useCollabStore((state) => state.projects);
  const messages = useCollabStore((state) => state.messages);
  const tasks = useCollabStore((state) => state.tasks);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const joinProject = useCollabStore((state) => state.joinProject);
  const addMessage = useCollabStore((state) => state.addMessage);
  const addTask = useCollabStore((state) => state.addTask);
  const toggleTask = useCollabStore((state) => state.toggleTask);
  const setStatus = useCollabStore((state) => state.setStatus);
  const presenceByProject = useCollabStore((state) => state.presenceByProject);
  const touchPresence = useCollabStore((state) => state.touchPresence);
  const leavePresence = useCollabStore((state) => state.leavePresence);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const loadProject = useSongStore((state) => state.loadProject);
  const deleteProject = useCollabStore((state) => state.deleteProject);

  const [messageDraft, setMessageDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const [roomError, setRoomError] = useState('');

  useEffect(() => {
    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [initializeRealtime]);

  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
  }, [seedLibrary]);

  const project = projects.find((item) => item.id === projectId) ?? null;
  const linkedProject =
    composerProjects.find((item) => item.id === project?.sourceProjectId) ?? null;

  const projectMessages = useMemo(
    () =>
      messages
        .filter((message) => message.projectId === projectId)
        .sort((left, right) => right.createdAt - left.createdAt),
    [messages, projectId]
  );

  const projectTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.projectId === projectId)
        .sort((left, right) => Number(left.completed) - Number(right.completed)),
    [tasks, projectId]
  );

  const isOwner = user?.email === project?.ownerEmail;

  const isMember = user
    ? project?.members.some((member) => member.email === user.email) ?? false
    : false;

  const activePresenceMembers = useMemo(() => {
    const entries = presenceByProject[projectId ?? ''] ?? [];
    const liveEntries = entries.filter(
      (presence) => presenceNow - presence.lastSeenAt <= COLLAB_PRESENCE_TIMEOUT_MS
    );
    const grouped = new Map<string, string>();

    liveEntries.forEach((presence) => {
      grouped.set(presence.email, presence.name);
    });

    return Array.from(grouped, ([email, name]) => ({ email, name }));
  }, [presenceByProject, presenceNow, projectId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceNow(Date.now());
    }, 4_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!projectId || !user || !isMember) {
      return;
    }

    void touchPresence(projectId, {
      email: user.email,
      name: user.name,
    }).catch((error) => {
      console.error(error);
    });

    const timer = window.setInterval(() => {
      void touchPresence(projectId, {
        email: user.email,
        name: user.name,
      }).catch((error) => {
        console.error(error);
      });
    }, COLLAB_PRESENCE_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      void leavePresence(projectId).catch((error) => {
        console.error(error);
      });
    };
  }, [isMember, leavePresence, projectId, touchPresence, user]);

  if (!project) {
    return (
      <div className="collab-room-page">
        <SiteHeader activeSection="collab" />
        <main className="collab-room-shell">
          <section className="collab-room-missing">
            <strong>협업 작업실을 찾을 수 없습니다.</strong>
            <button
              type="button"
              className="collab-secondary-button"
              onClick={() => navigate('/collab')}
            >
              협업 목록으로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  const handleJoin = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setRoomError('');
      await joinProject(project.id, {
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '협업 참여에 실패했습니다.');
    }
  };

  const handleOpenComposer = () => {
    const snapshot = project.snapshot ?? linkedProject?.project;
    if (!snapshot) {
      return;
    }

    loadProject(snapshot);
    navigate(`/composer?collab=${project.id}`);
  };

  const handleDelete = async () => {
    if (!user || !isOwner) return; // 방장인지 한 번 더 체크

    if (window.confirm('정말 이 협업 프로젝트를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.')) {
      try {
        await deleteProject(project.id);
        alert('프로젝트가 삭제되었습니다.');
        navigate('/collab'); // 삭제 후 목록 페이지로 이동
      } catch (error) {
        console.error('프로젝트 삭제 실패:', error);
        alert('프로젝트 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleSendMessage = async () => {
    if (!user || !messageDraft.trim()) {
      return;
    }

    try {
      setRoomError('');
      await addMessage(project.id, {
        email: user.email,
        name: user.name,
        content: messageDraft,
      });
      setMessageDraft('');
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '코멘트를 남기지 못했습니다.');
    }
  };

  const handleAddTask = async () => {
    if (!user || !taskDraft.trim()) {
      return;
    }

    try {
      setRoomError('');
      await addTask(project.id, {
        content: taskDraft,
        assigneeName: user.name,
      });
      setTaskDraft('');
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '작업을 추가하지 못했습니다.');
    }
  };

  return (
    <div className="collab-room-page">
      <SiteHeader activeSection="collab" />

      <main className="collab-room-shell">
        <section className="collab-room-hero">
          <div>
            <span className="collab-hero-kicker">Project Room</span>
            <h1>{project.title}</h1>
            <p>{project.summary}</p>
            <div className="collab-connection-row">
              <span className={`collab-connection-chip is-${connectionStatus}`}>
                {connectionStatus === 'connected'
                  ? '실시간 서버 연결됨'
                  : connectionStatus === 'connecting'
                    ? '실시간 서버 연결 중'
                    : connectionStatus === 'error'
                      ? '실시간 서버 연결 실패'
                      : '실시간 서버 대기 중'}
              </span>
              {connectionError || roomError ? <small>{roomError || connectionError}</small> : null}
            </div>
          </div>

          <div className="collab-room-status-group">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`collab-status-button${
                  project.status === option.key ? ' is-active' : ''
                }`}
                onClick={() => {
                  void setStatus(project.id, option.key).catch((error) => {
                    console.error(error);
                    setRoomError(
                      error instanceof Error ? error.message : '상태를 바꾸지 못했습니다.'
                    );
                  });
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="collab-room-layout">
          <div className="collab-room-main">
            <article className="collab-room-panel">
              <div className="collab-room-panel-head">
                <strong>프로젝트 개요</strong>
                <span>
                  {project.genre} · {project.bpm} BPM · {project.steps} steps ·{' '}
                  {getStatusLabel(project.status)}
                </span>
              </div>

              <div className="collab-room-summary-grid">
                <div className="collab-room-summary-card">
                  <span>오너</span>
                  <strong>{project.ownerName}</strong>
                </div>
                <div className="collab-room-summary-card">
                  <span>팀원</span>
                  <strong>{project.members.length}명</strong>
                </div>
                <div className="collab-room-summary-card">
                  <span>실시간 접속</span>
                  <strong>{activePresenceMembers.length}명</strong>
                </div>
                <div className="collab-room-summary-card">
                  <span>최근 수정</span>
                  <strong>{formatDateTime(project.updatedAt)}</strong>
                </div>
                <div className="collab-room-summary-card">
                  <span>연결 프로젝트</span>
                  <strong>{linkedProject?.title ?? '샘플 협업'}</strong>
                </div>
              </div>

              <div className="collab-room-tag-row">
                {project.tags.map((tag) => (
                  <span key={`${project.id}-${tag}`}>#{tag}</span>
                ))}
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head">
                <strong>작업 체크리스트</strong>
                <span>남은 포인트를 바로 켜고 끌 수 있어요.</span>
              </div>

              <div className="collab-room-task-list">
                {projectTasks.length ? (
                  projectTasks.map((task) => (
                    <label key={task.id} className={`collab-task-card${task.completed ? ' is-done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => {
                          void toggleTask(project.id, task.id).catch((error) => {
                            console.error(error);
                            setRoomError(
                              error instanceof Error
                                ? error.message
                                : '작업 상태를 바꾸지 못했습니다.'
                            );
                          });
                        }}
                        disabled={!isMember}
                      />
                      <div>
                        <strong>{task.content}</strong>
                        <span>{task.assigneeName}</span>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="collab-room-empty">아직 등록된 작업이 없습니다.</div>
                )}
              </div>

              <div className="collab-room-form">
                <input
                  value={taskDraft}
                  onChange={(event) => setTaskDraft(event.target.value)}
                  placeholder={isMember ? '새 작업을 입력하세요.' : '참여 후 작업을 추가할 수 있어요.'}
                  disabled={!isMember}
                />
                <button
                  type="button"
                  className="collab-primary-button"
                  onClick={handleAddTask}
                  disabled={!isMember}
                >
                  작업 추가
                </button>
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head">
                <strong>팀 채팅 / 코멘트</strong>
                <span>마디 방향이나 수정 의견을 짧게 남길 수 있습니다.</span>
              </div>

              <div className="collab-room-message-list">
                {projectMessages.length ? (
                  projectMessages.map((message) => (
                    <article key={message.id} className="collab-message-card">
                      <div className="collab-message-meta">
                        <strong>{message.authorName}</strong>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p>{message.content}</p>
                    </article>
                  ))
                ) : (
                  <div className="collab-room-empty">아직 남겨진 코멘트가 없습니다.</div>
                )}
              </div>

              <div className="collab-room-form">
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder={isMember ? '수정 방향이나 피드백을 적어보세요.' : '참여 후 코멘트를 남길 수 있어요.'}
                  rows={4}
                  disabled={!isMember}
                />
                <button
                  type="button"
                  className="collab-primary-button"
                  onClick={handleSendMessage}
                  disabled={!isMember}
                >
                  코멘트 남기기
                </button>
              </div>
            </article>
          </div>

          <aside className="collab-room-side">
            <article className="collab-room-panel">
              <div className="collab-room-panel-head">
                <strong>참여 멤버</strong>
                <span>현재 작업실에 참여 중인 팀원입니다.</span>
              </div>

              <div className="collab-member-list">
                {project.members.map((member) => (
                  <div key={`${project.id}-${member.email}`} className="collab-member-card">
                    <strong>{member.name}</strong>
                    <span>{member.role}</span>
                    {activePresenceMembers.some((activeMember) => activeMember.email === member.email) ? (
                      <em className="collab-member-live">실시간 참여 중</em>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head">
                <strong>빠른 액션</strong>
                <span>작곡 화면과 바로 이어서 작업할 수 있어요.</span>
              </div>

              <div className="collab-room-side-actions">
                {!isMember ? (
                  <button type="button" className="collab-primary-button" onClick={handleJoin}>
                    협업 참여하기
                  </button>
                ) : null}

                <button
                  type="button"
                  className="collab-secondary-button"
                  onClick={handleOpenComposer}
                  disabled={!linkedProject && !project.snapshot}
                >
                  작곡 화면 열기
                </button>

                <button
                  type="button"
                  className="collab-secondary-button"
                  onClick={() => navigate('/collab')}
                >
                  협업 목록으로
                </button>

                {isOwner ? (
                  <button
                    type="button"
                    className="collab-secondary-button is-danger"
                    style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} // 빨간색으로 위험(Danger) 표시
                    onClick={handleDelete}
                  >
                    프로젝트 삭제
                  </button>
                ) : null}
              </div>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}
