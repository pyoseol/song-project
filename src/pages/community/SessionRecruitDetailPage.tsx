import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CollabHubTabs from '../../components/collab/CollabHubTabs';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
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

  useEffect(() => {
    void seedSessionRecruit().catch((error) => {
      console.error(error);
    });
  }, [seedSessionRecruit]);

  const post = posts.find((item) => item.id === postId) ?? null;

  const handleMoveWithAuth = (route: string) => {
    navigate(user ? route : '/login');
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
              <button type="button" onClick={() => handleMoveWithAuth('/collab')}>
                협업 보기
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
        </section>
      </main>
    </div>
  );
}
