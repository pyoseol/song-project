import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CollabHubTabs from '../../components/collab/CollabHubTabs';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useCollabStore } from '../../store/collabStore';
import { useComposerLibraryStore } from '../../store/composerLibraryStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useSessionRecruitStore } from '../../store/sessionRecruitStore';
import type { SessionRole, SessionStatus } from '../../types/sessionRecruit';
import './SessionRecruitDetailPage.css';

const ROLE_LABELS: Record<SessionRole, string> = {
  vocal: '보컬',
  guitar: '기타',
  bass: '베이스',
  drums: '드럼',
  keys: '건반',
  producer: '프로듀서',
  mix: '믹스/레코딩',
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  open: '모집중',
  closing: '마감 임박',
  closed: '모집 완료',
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SessionRecruitDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const posts = useSessionRecruitStore((state) => state.posts);
  const bootstrapStatus = useSessionRecruitStore((state) => state.bootstrapStatus);
  const bootstrapError = useSessionRecruitStore((state) => state.bootstrapError);
  const seedSessionRecruit = useSessionRecruitStore((state) => state.seedSessionRecruit);
  const applyPost = useSessionRecruitStore((state) => state.applyPost);
  const reviewApplication = useSessionRecruitStore((state) => state.reviewApplication);
  const linkCollabProject = useSessionRecruitStore((state) => state.linkCollabProject);
  const setRecruitStatus = useSessionRecruitStore((state) => state.setRecruitStatus);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const collabProjects = useCollabStore((state) => state.projects);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const createFromComposerProject = useCollabStore((state) => state.createFromComposerProject);
  const joinProject = useCollabStore((state) => state.joinProject);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [applicationRole, setApplicationRole] = useState<SessionRole>('vocal');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [reviewingApplicantId, setReviewingApplicantId] = useState<string | null>(null);
  const [selectedSourceProjectId, setSelectedSourceProjectId] = useState('');
  const [isCreatingCollab, setIsCreatingCollab] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  useEffect(() => {
    void seedSessionRecruit().catch((error) => {
      console.error(error);
    });
  }, [seedSessionRecruit]);

  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [initializeRealtime, seedLibrary]);

  const post = posts.find((item) => item.id === postId) ?? null;
  const applicants = post?.applicants ?? [];
  const isOwner = Boolean(user && post?.hostEmail === user.email);
  const linkedCollabProject = post?.collabProjectId
    ? collabProjects.find((project) => project.id === post.collabProjectId) ?? null
    : null;
  const ownerComposerProjects = user
    ? composerProjects.filter((project) => project.creatorEmail === user.email)
    : [];
  const myApplication = user
    ? applicants.find((applicant) => applicant.email === user.email && applicant.status !== 'rejected')
    : null;
  const pendingApplicants = useMemo(
    () => applicants.filter((applicant) => applicant.status === 'pending'),
    [applicants]
  );
  const reviewedApplicants = useMemo(
    () => applicants.filter((applicant) => applicant.status !== 'pending'),
    [applicants]
  );

  useEffect(() => {
    if (post?.wantedRoles.length && !post.wantedRoles.includes(applicationRole)) {
      setApplicationRole(post.wantedRoles[0]);
    }
  }, [applicationRole, post]);

  useEffect(() => {
    if (!selectedSourceProjectId && ownerComposerProjects.length) {
      setSelectedSourceProjectId(ownerComposerProjects[0].id);
    }
  }, [ownerComposerProjects, selectedSourceProjectId]);

  const handleMoveWithAuth = (route: string) => {
    navigate(user ? route : '/login');
  };

  const handleApply = async () => {
    if (!post) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setIsApplying(true);
      setApplicationError('');
      await applyPost({
        postId: post.id,
        email: user.email,
        name: user.name,
        role: applicationRole,
        message: applicationMessage.trim(),
      });
      pushNotification({
        kind: 'collab',
        title: '모집글 지원 완료',
        body: `${post.title}에 ${ROLE_LABELS[applicationRole]} 파트로 지원했습니다.`,
        route: `/community/sessions/${post.id}`,
        actorName: user.name,
      });
      setApplicationMessage('');
    } catch (error) {
      console.error(error);
      setApplicationError(error instanceof Error ? error.message : '지원하지 못했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleReview = async (applicantId: string, status: 'approved' | 'rejected') => {
    if (!post || !user) {
      return;
    }

    try {
      setReviewingApplicantId(applicantId);
      setApplicationError('');
      await reviewApplication({
        postId: post.id,
        applicantId,
        userEmail: user.email,
        status,
      });

      const applicant = applicants.find((item) => item.id === applicantId);

      if (status === 'approved' && applicant && post.collabProjectId) {
        await joinProject(post.collabProjectId, {
          email: applicant.email,
          name: applicant.name,
        });
      }

      pushNotification({
        kind: 'collab',
        title: status === 'approved' ? '지원자를 승인했습니다' : '지원자를 거절했습니다',
        body: applicant
          ? `${applicant.name}님의 ${ROLE_LABELS[applicant.role]} 지원을 ${
              status === 'approved' ? '승인' : '거절'
            }했습니다.`
          : '지원자 상태를 변경했습니다.',
        route: `/community/sessions/${post.id}`,
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      setApplicationError(
        error instanceof Error ? error.message : '지원자 상태를 바꾸지 못했습니다.'
      );
    } finally {
      setReviewingApplicantId(null);
    }
  };

  const handleCreateCollabProject = async () => {
    if (!post || !user) {
      navigate('/login');
      return;
    }

    if (!selectedSourceProjectId) {
      setApplicationError('연결할 저장곡을 먼저 선택해주세요.');
      return;
    }

    const sourceProject = ownerComposerProjects.find((project) => project.id === selectedSourceProjectId);

    if (!sourceProject) {
      setApplicationError('선택한 저장곡을 찾을 수 없습니다.');
      return;
    }

    try {
      setIsCreatingCollab(true);
      setApplicationError('');
      const collabProjectId = await createFromComposerProject({
        sourceProjectId: sourceProject.id,
        title: post.title,
        summary: post.summary,
        genre: post.genre || sourceProject.genre,
        bpm: sourceProject.bpm,
        steps: sourceProject.steps,
        ownerEmail: user.email,
        ownerName: user.name,
        snapshot: sourceProject.project,
      });
      await linkCollabProject({
        postId: post.id,
        userEmail: user.email,
        collabProjectId,
      });
      pushNotification({
        kind: 'collab',
        title: '모집글에 협업 작업실을 연결했습니다',
        body: `${post.title}에서 바로 작업실로 이동할 수 있습니다.`,
        route: `/collab/${collabProjectId}`,
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      setApplicationError(
        error instanceof Error ? error.message : '협업 작업실을 만들지 못했습니다.'
      );
    } finally {
      setIsCreatingCollab(false);
    }
  };

  const handleSetRecruitStatus = async (status: SessionStatus) => {
    if (!post || !user) {
      return;
    }

    try {
      setIsChangingStatus(true);
      setApplicationError('');
      await setRecruitStatus({
        postId: post.id,
        userEmail: user.email,
        status,
      });
      pushNotification({
        kind: 'collab',
        title: status === 'closed' ? '모집을 마감했습니다' : '모집을 다시 열었습니다',
        body: `${post.title} 상태가 ${STATUS_LABELS[status]}으로 변경되었습니다.`,
        route: `/community/sessions/${post.id}`,
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      setApplicationError(
        error instanceof Error ? error.message : '모집 상태를 바꾸지 못했습니다.'
      );
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (bootstrapStatus === 'loading') {
    return (
      <div className="session-detail-page">
        <SiteHeader activeSection="collab" />
        <main className="session-detail-shell">
          <CollabHubTabs activeTab="sessions" />
          <section className="session-detail-empty">
            <strong>모집글을 불러오는 중입니다.</strong>
            <span>잠시만 기다려주세요.</span>
          </section>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="session-detail-page">
        <SiteHeader activeSection="collab" />
        <main className="session-detail-shell">
          <CollabHubTabs activeTab="sessions" />
          <section className="session-detail-empty">
            <strong>모집글을 찾을 수 없습니다.</strong>
            <span>
              {bootstrapStatus === 'error'
                ? bootstrapError ?? '데이터를 불러오지 못했습니다.'
                : '삭제되었거나 잘못된 주소일 수 있습니다.'}
            </span>
            <button type="button" onClick={() => navigate('/community/sessions')}>
              목록으로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="session-detail-page">
      <SiteHeader activeSection="collab" />

      <main className="session-detail-shell">
        <CollabHubTabs activeTab="sessions" />

        <button
          type="button"
          className="session-detail-back"
          onClick={() => navigate('/community/sessions')}
        >
          목록으로
        </button>

        <section className="session-detail-hero">
          <div className="session-detail-title">
            <div className="session-detail-badges">
              <span className={`session-detail-status is-${post.status}`}>
                {STATUS_LABELS[post.status]}
              </span>
              <span>{post.meetingType}</span>
              {post.urgent ? <span className="is-urgent">급구</span> : null}
            </div>

            <h1>{post.title}</h1>
            <p>{post.summary}</p>
          </div>

          <aside className="session-detail-contact">
            <span>작성자</span>
            <strong>{post.hostName}</strong>
            <small>{formatDate(post.createdAt)} 작성</small>

            <div className="session-detail-actions">
              <button type="button" onClick={() => handleMoveWithAuth('/messages')}>
                메시지 보내기
              </button>
              <button
                type="button"
                onClick={() => handleMoveWithAuth(post.collabProjectId ? `/collab/${post.collabProjectId}` : '/collab')}
              >
                {post.collabProjectId ? '작업실 열기' : '협업 보기'}
              </button>
            </div>
          </aside>
        </section>

        <section className="session-detail-grid">
          <article className="session-detail-card">
            <span>모집 조건</span>
            <dl>
              <div>
                <dt>장르</dt>
                <dd>{post.genre}</dd>
              </div>
              <div>
                <dt>지역</dt>
                <dd>{post.location}</dd>
              </div>
              <div>
                <dt>일정</dt>
                <dd>{post.schedule}</dd>
              </div>
              <div>
                <dt>인원</dt>
                <dd>
                  {post.currentMembers}/{post.maxMembers}
                </dd>
              </div>
            </dl>
          </article>

          <article className="session-detail-card">
            <span>필요한 파트</span>
            <div className="session-detail-chip-list">
              {post.wantedRoles.map((role) => (
                <strong key={role}>{ROLE_LABELS[role]}</strong>
              ))}
            </div>

            {isOwner ? (
              <div className="session-status-control">
                <strong>모집 상태 관리</strong>
                <div>
                  {post.status === 'closed' ? (
                    <button
                      type="button"
                      onClick={() => handleSetRecruitStatus('open')}
                      disabled={isChangingStatus}
                    >
                      다시 모집하기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetRecruitStatus('closed')}
                      disabled={isChangingStatus}
                    >
                      모집 마감
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </article>

          <article className="session-detail-card session-detail-card--wide">
            <span>태그</span>
            <div className="session-detail-tag-list">
              {post.tags.length ? (
                post.tags.map((tag) => <strong key={tag}>#{tag}</strong>)
              ) : (
                <em>등록된 태그가 없습니다.</em>
              )}
            </div>
          </article>

          <article className="session-detail-card session-detail-card--wide">
            <span>지원 / 승인</span>

            <div className="session-collab-link-panel">
              <div>
                <strong>연결된 협업 작업실</strong>
                <p>
                  {post.collabProjectId
                    ? linkedCollabProject?.title ?? '협업 작업실이 연결되어 있습니다.'
                    : '모집글과 연결된 작업실이 아직 없습니다.'}
                </p>
              </div>

              {post.collabProjectId ? (
                <button type="button" onClick={() => navigate(`/collab/${post.collabProjectId}`)}>
                  작업실 열기
                </button>
              ) : isOwner ? (
                <div className="session-collab-create">
                  <select
                    value={selectedSourceProjectId}
                    onChange={(event) => setSelectedSourceProjectId(event.target.value)}
                    disabled={!ownerComposerProjects.length}
                  >
                    {ownerComposerProjects.length ? (
                      ownerComposerProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))
                    ) : (
                      <option value="">저장곡 없음</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateCollabProject}
                    disabled={!ownerComposerProjects.length || isCreatingCollab}
                  >
                    {isCreatingCollab ? '연결 중...' : '작업실 만들기'}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => handleMoveWithAuth('/collab')}>
                  협업 목록 보기
                </button>
              )}
            </div>

            {isOwner ? (
              <div className="session-application-owner">
                <div className="session-application-summary">
                  <strong>지원자 {applicants.length}명</strong>
                  <small>대기 {pendingApplicants.length}명 · 승인 {applicants.filter((applicant) => applicant.status === 'approved').length}명</small>
                </div>

                {pendingApplicants.length ? (
                  <div className="session-applicant-list">
                    {pendingApplicants.map((applicant) => (
                      <article key={applicant.id} className="session-applicant-card">
                        <div>
                          <strong>{applicant.name}</strong>
                          <span>{ROLE_LABELS[applicant.role]} 지원</span>
                          <p>{applicant.message || '남긴 메시지가 없습니다.'}</p>
                        </div>
                        <div className="session-applicant-actions">
                          <button
                            type="button"
                            onClick={() => handleReview(applicant.id, 'approved')}
                            disabled={reviewingApplicantId === applicant.id}
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(applicant.id, 'rejected')}
                            disabled={reviewingApplicantId === applicant.id}
                          >
                            거절
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="session-detail-note">아직 대기 중인 지원자가 없습니다.</div>
                )}

                {reviewedApplicants.length ? (
                  <div className="session-reviewed-list">
                    {reviewedApplicants.map((applicant) => (
                      <span key={applicant.id}>
                        {applicant.name} · {ROLE_LABELS[applicant.role]} ·{' '}
                        {applicant.status === 'approved' ? '승인됨' : '거절됨'}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="session-application-form">
                {myApplication ? (
                  <div className={`session-application-state is-${myApplication.status}`}>
                    <strong>
                      {myApplication.status === 'approved'
                        ? '지원이 승인되었습니다.'
                        : '지원이 접수되었습니다.'}
                    </strong>
                    <span>{ROLE_LABELS[myApplication.role]} 파트로 지원했어요.</span>
                  </div>
                ) : (
                  <>
                    <label>
                      <span>지원 파트</span>
                      <select
                        value={applicationRole}
                        onChange={(event) => setApplicationRole(event.target.value as SessionRole)}
                      >
                        {post.wantedRoles.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>메시지</span>
                      <textarea
                        value={applicationMessage}
                        onChange={(event) => setApplicationMessage(event.target.value)}
                        placeholder="가능한 일정, 맡고 싶은 파트, 간단한 소개를 적어주세요."
                        rows={4}
                        maxLength={240}
                      />
                    </label>

                    <button type="button" onClick={handleApply} disabled={isApplying}>
                      {isApplying ? '지원 중...' : '지원하기'}
                    </button>
                  </>
                )}
              </div>
            )}

            {applicationError ? <div className="session-application-error">{applicationError}</div> : null}
          </article>
        </section>
      </main>
    </div>
  );
}
