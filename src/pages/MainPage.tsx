import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { LESSON_LIBRARY } from '../dummy/learnData';
import { LATEST_TRACKS, TRENDING_TRACKS } from '../dummy/mockData';
import { useCommunityStore } from '../store/communityStore';
import './MainPage.css';

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function getCategoryTone(category?: string) {
  if (!category) {
    return 'slate';
  }

  if (category.includes('질문')) {
    return 'indigo';
  }

  if (category.includes('정보')) {
    return 'mint';
  }

  if (category.includes('장비')) {
    return 'amber';
  }

  if (category.includes('작곡')) {
    return 'violet';
  }

  if (category.includes('피드백')) {
    return 'rose';
  }

  return 'slate';
}

function getCoverflowCardStyle(index: number, activeIndex: number, total: number): CSSProperties {
  const rawOffset = index - activeIndex;
  const wrappedOffset =
    rawOffset > total / 2
      ? rawOffset - total
      : rawOffset < -total / 2
        ? rawOffset + total
        : rawOffset;
  const offset = wrappedOffset;
  const distance = Math.abs(offset);
  const scale = offset === 0 ? 1.16 : Math.max(0.62, 1 - distance * 0.22);

  return {
    left: '50%',
    zIndex: 100 - Math.round(distance * 10),
    opacity: Math.max(0.08, 1 - distance * 0.28),
    pointerEvents: distance > 2 ? 'none' : 'auto',
    transform: `translateX(calc(-50% + ${offset * 186}px)) translateY(${distance * 20}px) rotateY(${offset * -28}deg) scale(${scale})`,
  };
}

function renderTrackCoverflow(
  tracks: typeof TRENDING_TRACKS,
  navigate: ReturnType<typeof useNavigate>,
  activeIndex: number,
  setActiveIndex: (value: number | ((prev: number) => number)) => void
) {
  return (
    <div
      className="main-track-coverflow"
      role="list"
      onWheel={(event) => {
        if (Math.abs(event.deltaX) < 8 && Math.abs(event.deltaY) < 8) {
          return;
        }

        setActiveIndex((current) =>
          event.deltaY > 0 || event.deltaX > 0
            ? (current + 1) % tracks.length
            : (current - 1 + tracks.length) % tracks.length
        );
      }}
    >
      <button
        type="button"
        className="main-track-coverflow-arrow is-left"
        onClick={() => setActiveIndex((current) => (current - 1 + tracks.length) % tracks.length)}
        aria-label="이전 음악"
      >
        {'<'}
      </button>
      {tracks.map((track, index) => (
        <button
          key={track.id}
          type="button"
          className={`main-track-coverflow-card${index === activeIndex ? ' is-active' : ''}`}
          style={{
            ...getCoverflowCardStyle(index, activeIndex, tracks.length),
            backgroundImage: track.palette,
          }}
          onClick={() => {
            if (index !== activeIndex) {
              setActiveIndex(index);
              return;
            }

            navigate('/community/music');
          }}
          aria-label={`${track.title} ${track.progression}`}
        >
          <span className="main-track-mood">{track.mood}</span>
          <div className="main-track-coverflow-copy">
            <strong>{track.title}</strong>
            <span>{track.progression}</span>
          </div>
        </button>
      ))}
      <button
        type="button"
        className="main-track-coverflow-arrow is-right"
        onClick={() => setActiveIndex((current) => (current + 1) % tracks.length)}
        aria-label="다음 음악"
      >
        {'>'}
      </button>
    </div>
  );
}

export default function MainPage() {
  const navigate = useNavigate();
  const [activeTrendingIndex, setActiveTrendingIndex] = useState(0);
  const posts = useCommunityStore((state) => state.posts);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const recommendedLessonIds = ['money-code', 'major-progression', 'arrangement'] as const;

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  const popularPosts = [...posts]
    .sort(
      (left, right) =>
        (right.viewCount ?? 0) - (left.viewCount ?? 0) ||
        (right.likeCount ?? 0) - (left.likeCount ?? 0)
    )
    .slice(0, 8);

  const recommendedLessons = recommendedLessonIds.map((id) => LESSON_LIBRARY[id]);
  const totalComments = posts.reduce((sum, post) => sum + (post.commentCount ?? 0), 0);
  const totalViews = posts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0);
  const hotPostCount = posts.filter((post) => post.isHot).length;

  const communitySpaces = [
    {
      label: '커뮤니티 게시판',
      title: '질문과 피드백을 빠르게 주고받는 공간',
      description: '조회 수가 높은 글부터 둘러보고, 궁금한 주제로 바로 들어갈 수 있습니다.',
      action: '게시판 보기',
      route: '/community',
    },
    {
      label: '음악 공유',
      title: '코드 진행과 루프 아이디어를 모아보는 공간',
      description: '공유된 곡을 이어 들어보고, 마음에 드는 곡은 저장해 다시 참고할 수 있습니다.',
      action: '음악 공유 보기',
      route: '/community/music',
    },
    {
      label: '중고 거래',
      title: '필요한 장비만 모아서 볼 수 있는 거래 공간',
      description: '커뮤니티 흐름 안에서 장비 탐색까지 자연스럽게 이어집니다.',
      action: '중고 거래 보기',
      route: '/community/market',
    },
  ];

  const summaryMetrics = [
    { label: '전체 게시글', value: formatCount(posts.length) },
    { label: '전체 댓글', value: formatCount(totalComments) },
    { label: '전체 조회', value: formatCount(totalViews) },
    { label: 'HOT 게시글', value: formatCount(hotPostCount) },
  ];

  return (
    <div className="main-page">
      <SiteHeader />

      <main className="main-shell">
        <section className="main-hero-card">
          <div className="main-hero-copy">
            <span className="main-hero-eyebrow">SONG MAKER HUB</span>
            <h1 className="main-hero-title">
              작곡부터 커뮤니티까지,
              <br />
              한 번에 이어가기
            </h1>
            <p className="main-hero-description">
              지금 필요한 흐름만 골라서 바로 시작할 수 있도록 메인 화면을 정리했습니다.
              음악 탐색과 커뮤니티 탐색도 페이지 안에서 자연스럽게 이어집니다.
            </p>

            <div className="main-hero-actions">
              <button
                type="button"
                className="main-hero-button is-primary"
                onClick={() => navigate('/composer')}
              >
                바로 작곡하기
              </button>
              <button
                type="button"
                className="main-hero-button"
                onClick={() => navigate('/community')}
              >
                커뮤니티 둘러보기
              </button>
            </div>
          </div>

          <div className="main-hero-metrics">
            {summaryMetrics.map((metric) => (
              <article key={metric.label} className="main-hero-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="main-section-group">
          <div className="main-group-head">
            <span className="main-group-kicker">MUSIC FLOW</span>
            <h2>음악 탐색</h2>
            <p>지금 뜨는 음악은 커버플로우로 크게 보고, 최근 추가된 음악은 바로 훑어볼 수 있게 구성했습니다.</p>
          </div>

          <div className="main-section-stack">
            <section className="main-section">
              <div className="main-section-head">
                <h2 className="main-section-title">
                  <span className="main-section-icon" aria-hidden="true">
                    ♪
                  </span>
                  지금 뜨는 음악
                </h2>
              </div>

              {renderTrackCoverflow(
                TRENDING_TRACKS,
                navigate,
                activeTrendingIndex,
                setActiveTrendingIndex
              )}
            </section>

            <section className="main-section">
              <div className="main-section-head">
                <h2 className="main-section-title">
                  <span className="main-section-icon" aria-hidden="true">
                    +
                  </span>
                  최근 추가된 음악
                </h2>
              </div>

              <div className="main-track-grid">
                {LATEST_TRACKS.slice(0, 4).map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    className="main-track-card"
                    style={{ backgroundImage: track.palette } as CSSProperties}
                    onClick={() => navigate('/community/music')}
                    aria-label={`${track.title} ${track.progression}`}
                  >
                    <div className="main-track-footer">
                      <span className="main-track-progression">{track.progression}</span>
                      <span className="main-track-favorite" aria-hidden="true">
                        PLAY
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="main-section">
              <div className="main-section-head is-between">
                <h2 className="main-section-title">
                  <span className="main-section-icon" aria-hidden="true">
                    #
                  </span>
                  추천 작곡
                </h2>
              </div>

              <div className="main-lesson-grid">
                {recommendedLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    className="main-lesson-card"
                    onClick={() => navigate('/composer')}
                  >
                    <span className="main-lesson-section">{lesson.section}</span>
                    <strong>{lesson.title}</strong>
                    <p>{lesson.summary}</p>
                    <div className="main-lesson-footer">
                      <span>{lesson.tempo} BPM</span>
                      <span>{lesson.examples.length} examples</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="main-section-group">
          <div className="main-group-head">
            <span className="main-group-kicker">COMMUNITY FLOW</span>
            <h2>커뮤니티 탐색</h2>
            <p>게시판, 음악 공유, 중고 거래를 한 흐름 안에서 바로 이어볼 수 있게 정리했습니다.</p>
          </div>

          <div className="main-section-stack">
            <section className="main-section">
              <div className="main-section-head is-between">
                <h2 className="main-section-title">
                  <span className="main-section-icon" aria-hidden="true">
                    #
                  </span>
                  인기 있는 게시물
                </h2>

                <button
                  type="button"
                  className="main-section-link"
                  onClick={() => navigate('/community')}
                >
                  전체보기 {'>'}
                </button>
              </div>

              <div className="main-board">
                {popularPosts.map((post, index) => {
                  const tone = getCategoryTone(post.category);

                  return (
                    <button
                      key={post.id}
                      type="button"
                      className="main-board-row"
                      onClick={() => navigate(`/community/${post.id}`)}
                    >
                      <span className={`main-board-rank${index < 3 ? ' is-top' : ''}`}>
                        {index + 1}
                      </span>

                      <span className={`main-board-chip main-board-chip--${tone}`}>
                        {post.category ?? '자유'}
                      </span>

                      <span className="main-board-title-wrap">
                        <span className="main-board-title">{post.title}</span>
                        {post.isHot ? <span className="main-board-hot">HOT</span> : null}
                      </span>

                      <span className="main-board-stats">
                        <span className="main-board-stat">
                          <span className="main-board-stat-icon" aria-hidden="true">
                            VIEW
                          </span>
                          {formatCount(post.viewCount)}
                        </span>
                        <span className="main-board-stat">
                          <span className="main-board-stat-icon" aria-hidden="true">
                            RE
                          </span>
                          {formatCount(post.commentCount)}
                        </span>
                        <span className="main-board-stat is-like">
                          <span className="main-board-stat-icon" aria-hidden="true">
                            LIKE
                          </span>
                          {formatCount(post.likeCount)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="main-section">
              <div className="main-section-head is-between">
                <h2 className="main-section-title">
                  <span className="main-section-icon" aria-hidden="true">
                    +
                  </span>
                  커뮤니티 공간
                </h2>

                <button
                  type="button"
                  className="main-section-link"
                  onClick={() => navigate('/community')}
                >
                  전체 커뮤니티 보기 {'>'}
                </button>
              </div>

              <div className="main-space-grid">
                {communitySpaces.map((space) => (
                  <button
                    key={space.title}
                    type="button"
                    className="main-space-card"
                    onClick={() => navigate(space.route)}
                  >
                    <span className="main-space-label">{space.label}</span>
                    <strong>{space.title}</strong>
                    <p>{space.description}</p>
                    <span className="main-space-action">{space.action}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
