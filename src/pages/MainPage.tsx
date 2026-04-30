import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { LATEST_TRACKS, TRENDING_TRACKS } from '../dummy/mockData';
import { useCommunityStore } from '../store/communityStore';
import type { CommunityTrack, Post } from '../types/community';
import './MainPage.css';

const TRACK_DISPLAY: Record<string, { title: string; mood: string }> = {
  'trend-1': { title: '야경 루프', mood: '오늘의 추천' },
  'trend-2': { title: '시티팝 리프', mood: '인기 리메이크' },
  'trend-3': { title: '감성 브리지', mood: '반복하기 좋은 구조' },
  'trend-4': { title: '미드나잇 훅', mood: '후렴 강조' },
  'trend-5': { title: '딥 하우스 라인', mood: '밤 작업용' },
  'trend-6': { title: '필름 OST 테마', mood: '서정적인 진행' },
  'trend-7': { title: '몽환 신스 팝', mood: '공간감 있는 사운드' },
  'trend-8': { title: '그루브 스케치', mood: '가볍게 듣기 좋은 곡' },
  'latest-1': { title: '펑크 스케치', mood: '새로 올라온 곡' },
  'latest-2': { title: '청량 밴드 루프', mood: '밴드 작곡용 루프' },
  'latest-3': { title: '발라드 베이스 아이디어', mood: '입문자용 진행' },
  'latest-4': { title: '모던 재즈 훅', mood: '리듬 변주형 진행' },
};

const POST_DISPLAY: Record<string, { title: string; category: string }> = {
  '1': { title: '코드 진행 질문: 후렴이 자연스럽게 안 이어져요', category: '질문' },
  '2': { title: '작곡 피드백 받을 사람 같이 들어봐요', category: '피드백' },
  '3': { title: '멜로디를 먼저 만들까요, 코드를 먼저 만들까요?', category: '작곡' },
  '4': { title: '음악 이론 정리: 다이아토닉 코드 활용', category: '정보' },
  '5': { title: '베이스 라인 만들 때 리듬부터 잡는 법', category: '작곡' },
  '6': { title: 'MIDI 컨트롤러 입문 추천 부탁해요', category: '장비' },
  '7': { title: '기타 코드 톤을 얇게 만드는 방법이 궁금해요', category: '장비' },
  '8': { title: 'DAW 처음 시작할 때 뭐가 좋을까요?', category: '질문' },
};

const STUDIO_KITS = [
  {
    label: 'LOOP STARTER',
    title: '첫 8마디 스케치',
    body: '코드와 리듬을 먼저 잡고 바로 피아노롤로 이어가기',
    route: '/composer',
  },
  {
    label: 'TOPLINE',
    title: '후렴 멜로디 찾기',
    body: '마음에 드는 진행 위에 훅 아이디어를 얹어보기',
    route: '/community/music',
  },
  {
    label: 'SESSION',
    title: '같이 완성할 파트 찾기',
    body: '보컬, 기타, 믹싱 파트를 연결해서 곡을 끝까지 밀기',
    route: '/collab',
  },
] as const;

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function getTrackDisplay(track: CommunityTrack) {
  return TRACK_DISPLAY[track.id] ?? { title: track.title, mood: track.mood };
}

function getPostDisplay(post: Post) {
  return POST_DISPLAY[post.id] ?? { title: post.title, category: post.category ?? '자유' };
}

function getCoverflowStyle(index: number, activeIndex: number, total: number): CSSProperties {
  const rawOffset = index - activeIndex;
  const offset =
    rawOffset > total / 2
      ? rawOffset - total
      : rawOffset < -total / 2
        ? rawOffset + total
        : rawOffset;
  const distance = Math.abs(offset);
  const clampedOffset = Math.max(-2, Math.min(2, offset));

  return {
    opacity: distance > 2 ? 0 : Math.max(0.38, 1 - distance * 0.28),
    zIndex: 20 - distance,
    pointerEvents: distance > 2 ? 'none' : 'auto',
    transform: `translateX(calc(-50% + ${clampedOffset * 170}px)) translateY(${distance * 18}px) rotateY(${clampedOffset * -7}deg) scale(${offset === 0 ? 1 : 0.8 - distance * 0.04})`,
  };
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

export default function MainPage() {
  const navigate = useNavigate();
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);
  const posts = useCommunityStore((state) => state.posts);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);

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
    .slice(0, 6);

  const coverflowTracks = TRENDING_TRACKS.slice(0, 5);
  const featuredTrack = coverflowTracks[activeCoverIndex];
  const spotlightTracks = TRENDING_TRACKS.slice(5, 8);
  const latestTracks = LATEST_TRACKS.slice(0, 4);
  const quickLinks = [
    { title: '새 곡 만들기', body: '피아노롤과 코드 가이드로 바로 시작', route: '/composer' },
    { title: '협업 찾기', body: '세션과 팀원을 모아 프로젝트 진행', route: '/collab' },
    { title: '음악 공유', body: '커뮤니티의 루프와 진행을 탐색', route: '/community/music' },
  ];
  const featuredTrackDisplay = getTrackDisplay(featuredTrack);

  return (
    <div className="main-page">
      <SiteHeader />

      <main className="main-shell">
        <section className="main-hero-head">
          <span className="main-label">SONG MAKER RADIO</span>
          <div>
            <h1>오늘 만들고 싶은 사운드를 먼저 들어보세요.</h1>
            <p>커버를 넘기며 레퍼런스를 찾고, 마음에 드는 흐름에서 바로 작곡을 시작합니다.</p>
          </div>
          <div className="main-hero-actions">
            <button type="button" className="main-button is-primary" onClick={() => navigate('/composer')}>
              스튜디오 열기
            </button>
            <button type="button" className="main-button" onClick={() => navigate('/community')}>
              차트 둘러보기
            </button>
          </div>
        </section>

        <section className="main-hero">
          <div className="main-coverflow-panel">
            <div className="main-now-playing">
              <span>NOW PLAYING</span>
              <strong>{featuredTrackDisplay.title}</strong>
              <small>{featuredTrack.progression}</small>
              <div className="main-eq" aria-hidden="true">
                {Array.from({ length: 18 }, (_, index) => (
                  <i key={index} style={{ '--delay': `${index * 0.07}s` } as CSSProperties} />
                ))}
              </div>
            </div>

            <div className="main-coverflow" role="list" aria-label="추천 음악 커버 플로우">
              <button
                type="button"
                className="main-coverflow-arrow is-left"
                onClick={() =>
                  setActiveCoverIndex((current) =>
                    (current - 1 + coverflowTracks.length) % coverflowTracks.length
                  )
                }
                aria-label="이전 음악"
              >
                ‹
              </button>

              {coverflowTracks.map((track, index) => {
                const displayTrack = getTrackDisplay(track);
                const isActive = index === activeCoverIndex;

                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`main-cover-card${isActive ? ' is-active' : ''}`}
                    style={{
                      ...getCoverflowStyle(index, activeCoverIndex, coverflowTracks.length),
                      backgroundImage: track.palette,
                    }}
                    onClick={() => {
                      if (!isActive) {
                        setActiveCoverIndex(index);
                        return;
                      }

                      navigate('/community/music');
                    }}
                    aria-label={`${displayTrack.title} ${track.progression}`}
                  >
                    <span>{displayTrack.mood}</span>
                    <strong>{displayTrack.title}</strong>
                    <small>{track.progression}</small>
                  </button>
                );
              })}

              <button
                type="button"
                className="main-coverflow-arrow is-right"
                onClick={() =>
                  setActiveCoverIndex((current) => (current + 1) % coverflowTracks.length)
                }
                aria-label="다음 음악"
              >
                ›
              </button>
            </div>
          </div>
        </section>

        <section className="main-quick-grid" aria-label="음악 작업 바로가기">
          {quickLinks.map((link, index) => (
            <button key={link.title} type="button" onClick={() => navigate(link.route)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{link.title}</strong>
              <small>{link.body}</small>
            </button>
          ))}
        </section>

        <section className="main-layout">
          <div className="main-left">
            <section className="main-panel main-panel--music">
              <div className="main-panel-head">
                <div>
                  <span className="main-label">MIX ROOM</span>
                  <h2>무드별 추천 사운드</h2>
                </div>
                <button type="button" onClick={() => navigate('/community/music')}>
                  더보기
                </button>
              </div>

              <div className="main-spotlight-grid">
                {spotlightTracks.map((track) => {
                  const displayTrack = getTrackDisplay(track);

                  return (
                    <button
                      key={track.id}
                      type="button"
                      className="main-spotlight-card"
                      style={{ backgroundImage: track.palette } as CSSProperties}
                      onClick={() => navigate('/community/music')}
                      aria-label={`${displayTrack.title} ${track.progression}`}
                    >
                      <span>{displayTrack.mood}</span>
                      <strong>{displayTrack.title}</strong>
                      <small>{track.progression}</small>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="main-panel">
              <div className="main-panel-head">
                <div>
                  <span className="main-label">COMMUNITY</span>
                  <h2>인기 게시물</h2>
                </div>
                <button type="button" onClick={() => navigate('/community')}>
                  더보기
                </button>
              </div>

              <div className="main-post-list">
                {popularPosts.map((post, index) => {
                  const displayPost = getPostDisplay(post);
                  const tone = getCategoryTone(displayPost.category);

                  return (
                    <button
                      key={post.id}
                      type="button"
                      className="main-post-row"
                      onClick={() => navigate(`/community/${post.id}`)}
                    >
                      <span className={`main-post-rank${index < 3 ? ' is-top' : ''}`}>
                        {index + 1}
                      </span>
                      <span className={`main-post-chip main-post-chip--${tone}`}>
                        {displayPost.category}
                      </span>
                      <span className="main-post-title">
                        <strong>{displayPost.title}</strong>
                        {post.isHot ? <small>HOT</small> : null}
                      </span>
                      <span className="main-post-meta">{formatCount(post.viewCount)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="main-right">
            <section className="main-panel">
              <div className="main-panel-head">
                <div>
                  <span className="main-label">NEW DROPS</span>
                  <h2>새로 올라온 트랙</h2>
                </div>
              </div>

              <div className="main-track-list">
                {latestTracks.map((track, index) => {
                  const displayTrack = getTrackDisplay(track);

                  return (
                    <button
                      key={track.id}
                      type="button"
                      className="main-track-row"
                      onClick={() => navigate('/community/music')}
                    >
                      <span className="main-track-index">{String(index + 1).padStart(2, '0')}</span>
                      <span
                        className="main-track-thumb"
                        style={{ backgroundImage: track.palette } as CSSProperties}
                        aria-hidden="true"
                      />
                      <span className="main-track-copy">
                        <strong>{displayTrack.title}</strong>
                        <small>{track.progression}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="main-panel main-cta-panel">
              <span className="main-label">GUIDE</span>
              <h2>막히면 추천 작곡부터</h2>
              <p>코드 진행과 예시 루프를 참고해서 바로 곡을 이어갈 수 있습니다.</p>
              <button type="button" onClick={() => navigate('/composer')}>
                작곡 가이드 열기
              </button>
            </section>
          </aside>
        </section>

        <section className="main-panel main-studio-panel">
          <div className="main-panel-head">
            <div>
              <span className="main-label">STUDIO KIT</span>
              <h2>오늘 바로 써먹는 작업 아이디어</h2>
            </div>
          </div>

          <div className="main-studio-grid">
            {STUDIO_KITS.map((kit) => (
              <button key={kit.label} type="button" onClick={() => navigate(kit.route)}>
                <span>{kit.label}</span>
                <strong>{kit.title}</strong>
                <small>{kit.body}</small>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
