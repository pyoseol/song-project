import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CollabHubTabs from '../components/collab/CollabHubTabs';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import { useCollabStore, type CollabProject } from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import './CollabPage.css';

const STATUS_LABEL: Record<CollabProject['status'], string> = {
  planning: '준비 중',
  working: '작업 중',
  feedback: '피드백',
};

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR');
}

export default function CollabPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useCollabStore((state) => state.projects);
  const messages = useCollabStore((state) => state.messages);
  const tasks = useCollabStore((state) => state.tasks);
  const joinProject = useCollabStore((state) => state.joinProject);
  const createFromComposerProject = useCollabStore((state) => state.createFromComposerProject);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const [actionError, setActionError] = useState('');

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

  const sortedProjects = useMemo(
    () => [...projects].sort((left, right) => right.updatedAt - left.updatedAt),
    [projects]
  );

  const myComposerProjects = useMemo(
    () =>
      user
        ? composerProjects
            .filter((project) => project.creatorEmail === user.email)
            .sort((left, right) => right.updatedAt - left.updatedAt)
        : [],
    [composerProjects, user]
  );

  const linkedProjectIds = useMemo(
    () =>
      new Set(
        projects
          .map((project) => project.sourceProjectId)
          .filter((value): value is string => Boolean(value))
      ),
    [projects]
  );

  const readyProjects = myComposerProjects.filter((project) => !linkedProjectIds.has(project.id));

  const totalMembers = useMemo(() => {
    const uniqueEmails = new Set(projects.flatMap((project) => project.members.map((member) => member.email)));
    return uniqueEmails.size;
  }, [projects]);

  const openTaskCount = tasks.filter((task) => !task.completed).length;

  const handleCreateCollab = async (projectId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const sourceProject = myComposerProjects.find((project) => project.id === projectId);
    if (!sourceProject) {
      return;
    }

    try {
      setActionError('');
      const collabId = await createFromComposerProject({
        sourceProjectId: sourceProject.id,
        title: sourceProject.title,
        summary: sourceProject.description,
        genre: sourceProject.genre,
        bpm: sourceProject.bpm,
        steps: sourceProject.steps,
        ownerEmail: user.email,
        ownerName: user.name,
        snapshot: sourceProject.project,
      });

      navigate(`/collab/${collabId}`);
    } catch (error) {
      console.error(error);
      setActionError(
        error instanceof Error ? error.message : '협업 작업실을 만들지 못했습니다.'
      );
    }
  };

  const handleOpenProject = async (project: CollabProject) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const isMember = project.members.some((member) => member.email === user.email);
    if (!isMember) {
      try {
        setActionError('');
        await joinProject(project.id, {
          email: user.email,
          name: user.name,
        });
      } catch (error) {
        console.error(error);
        setActionError(
          error instanceof Error ? error.message : '협업 작업실에 참여하지 못했습니다.'
        );
        return;
      }
    }

    navigate(`/collab/${project.id}`);
  };

  return (
    <div className="collab-page">
      <SiteHeader activeSection="collab" />

      <main className="collab-shell">
        <CollabHubTabs activeTab="collab" />

        <section className="collab-hero">
          <div>
            <span className="collab-hero-kicker">Collab Studio</span>
            <h1>함께 곡을 다듬는 협업 작업실</h1>
            <p>
              저장한 프로젝트를 협업으로 전환하고, 팀원과 할 일과 피드백을 한 공간에서
              이어갈 수 있습니다. 이제 협업 서버를 통해 실제로 동기화됩니다.
            </p>
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
              {connectionError || actionError ? (
                <small>{actionError || connectionError}</small>
              ) : null}
            </div>
          </div>

          <div className="collab-hero-stats">
            <article className="collab-hero-stat">
              <strong>{formatCount(projects.length)}</strong>
              <span>협업 프로젝트</span>
            </article>
            <article className="collab-hero-stat">
              <strong>{formatCount(totalMembers)}</strong>
              <span>참여 중인 멤버</span>
            </article>
            <article className="collab-hero-stat">
              <strong>{formatCount(openTaskCount)}</strong>
              <span>남은 작업</span>
            </article>
          </div>
        </section>

        <section className="collab-grid">
          <aside className="collab-panel collab-panel--sticky">
            <div className="collab-panel-head">
              <strong>빠른 시작</strong>
              <span>내 저장곡으로 바로 협업을 열 수 있어요.</span>
            </div>

            {user ? (
              readyProjects.length ? (
                <div className="collab-source-list">
                  {readyProjects.slice(0, 4).map((project) => (
                    <article key={project.id} className="collab-source-card">
                      <div>
                        <strong>{project.title}</strong>
                        <span>
                          {project.genre || '미정'} · {project.bpm} BPM · {project.steps} steps
                        </span>
                      </div>
                      <button
                        type="button"
                        className="collab-primary-button"
                        onClick={() => handleCreateCollab(project.id)}
                      >
                        협업 시작
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="collab-empty-card">
                  저장된 작곡 프로젝트가 없거나 이미 협업으로 연결됐어요.
                </div>
              )
            ) : (
              <div className="collab-empty-card">
                로그인하면 내 프로젝트로 협업 작업실을 바로 만들 수 있어요.
              </div>
            )}

            <div className="collab-panel-note">
              <strong>이런 흐름으로 쓰면 좋아요</strong>
              <p>작곡 저장 → 협업 시작 → 팀원 참여 → 할 일/채팅 정리 → 작곡 화면 열기</p>
            </div>
          </aside>

          <section className="collab-panel">
            <div className="collab-panel-head">
              <strong>진행 중인 협업</strong>
              <span>최근 수정된 순서대로 정리했습니다.</span>
            </div>

            <div className="collab-project-list">
              {sortedProjects.map((project) => {
                const isMember = user
                  ? project.members.some((member) => member.email === user.email)
                  : false;
                const projectTaskCount = tasks.filter(
                  (task) => task.projectId === project.id && !task.completed
                ).length;
                const lastMessage = messages.find((message) => message.projectId === project.id);

                return (
                  <article key={project.id} className="collab-project-card">
                    <div className="collab-project-top">
                      <span className={`collab-status-chip is-${project.status}`}>
                        {STATUS_LABEL[project.status]}
                      </span>
                      <span className="collab-project-date">{formatDate(project.updatedAt)}</span>
                    </div>

                    <div className="collab-project-copy">
                      <h2>{project.title}</h2>
                      <p>{project.summary}</p>
                    </div>

                    <div className="collab-project-meta">
                      <span>{project.genre}</span>
                      <span>{project.bpm} BPM</span>
                      <span>{project.steps} steps</span>
                      <span>{project.members.length}명 참여</span>
                      <span>남은 작업 {projectTaskCount}</span>
                    </div>

                    <div className="collab-project-tags">
                      {project.tags.map((tag) => (
                        <span key={`${project.id}-${tag}`}>#{tag}</span>
                      ))}
                    </div>

                    <div className="collab-project-foot">
                      <div>
                        <strong>최근 코멘트</strong>
                        <span>{lastMessage?.content ?? '아직 남겨진 코멘트가 없어요.'}</span>
                      </div>

                      <button
                        type="button"
                        className="collab-secondary-button"
                        onClick={() => handleOpenProject(project)}
                      >
                        {isMember ? '작업실 열기' : '참여하고 열기'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
