import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { LATEST_TRACKS, TRENDING_TRACKS } from '../dummy/mockData';
import { useCommunityStore } from '../store/communityStore';
import type { CommunityTrack, Post } from '../types/community';
import './MainPage.css';

const TRACK_DISPLAY: Record<string, { title: string; mood: string }> = {
  'trend-1': { title: '야경 루프', mood: '오늘의 추천' },
  'trend-2': { title: '시티팝 리프', mood: '가볍게 듣기 좋은 진행' },
  'trend-3': { title: '감성 브리지', mood: '후렴 전에 쓰기 좋은 구조' },
  'trend-4': { title: '미드나잇 훅', mood: '밤 작업용 훅' },
  'trend-5': { title: '딥 하우스 라인', mood: '그루브 아이디어' },
  'trend-6': { title: '필름 OST 테마', mood: '서정적인 진행' },
  'trend-7': { title: '몽환 신스 팝', mood: '공간감 있는 사운드' },
  'trend-8': { title: '그루브 스케치', mood: '가볍게 시작하기' },
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
};

const TRACK_IMAGE_MAP: Record<string, string> = {
  'trend-1': '/seed-images/music/canon.svg',
  'trend-2': '/seed-images/music/citypop.svg',
  'trend-3': '/seed-images/music/stand-by-me.svg',
  'trend-4': '/seed-images/music/pop.svg',
  'trend-5': '/seed-images/music/screen.svg',
  'trend-6': '/seed-images/music/film-ost.svg',
  'trend-7': '/seed-images/music/anime-ending.svg',
  'trend-8': '/seed-images/music/game-theme.svg',
  'latest-1': '/seed-images/music/pop.svg',
  'latest-2': '/seed-images/music/classic.svg',
  'latest-3': '/seed-images/music/jazz.svg',
  'latest-4': '/seed-images/music/jazz-standard.svg',
};

const GENRE_CHIPS = ['K-pop', 'Lo-fi', 'Ballad', 'City Pop', 'Jazz', 'OST'];

const GENERATOR_TABS = [
  { label: '작곡', route: '/composer', active: true },
  { label: '가사', route: '/composer?tab=lyrics', active: false },
  { label: '공유곡', route: '/community/music', active: false },
] as const;

const FEATURE_CARDS = [
  {
    label: 'COMPOSER',
    title: '피아노롤에서 바로 스케치',
    body: '멜로디, 코드, 드럼, 가사를 한 화면에서 이어 붙입니다.',
    route: '/composer',
  },
  {
    label: 'SHARE',
    title: '공유곡을 듣고 참고',
    body: '다른 사람이 만든 진행과 루프를 보며 아이디어를 얻습니다.',
    route: '/community/music',
  },
  {
    label: 'COLLAB',
    title: '같이 만들 파트너 찾기',
    body: '보컬, 악기, 믹싱 파트를 모집하고 프로젝트를 이어갑니다.',
    route: '/collab',
  },
] as const;

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function getTrackDisplay(track: CommunityTrack) {
  return TRACK_DISPLAY[track.id] ?? { title: track.title, mood: track.mood };
}

function getTrackCover(track: CommunityTrack) {
  return TRACK_IMAGE_MAP[track.id] ?? '/seed-images/music/pop.svg';
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
  const scale = offset === 0 ? 1.08 : Math.max(0.42, 0.62 - (distance - 1) * 0.12);

  return {
    opacity: distance > 2 ? 0 : Math.max(0.3, 1 - distance * 0.28),
    zIndex: 30 - distance,
    pointerEvents: distance > 2 ? 'none' : 'auto',
    transform: `translateX(calc(-50% + ${clampedOffset * 214}px)) translateY(${distance * 22}px) rotate(${clampedOffset * -3}deg) scale(${scale})`,
  };
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

  const coverflowTracks = TRENDING_TRACKS.slice(0, 5);
  const featuredTrack = coverflowTracks[activeCoverIndex];
  const featuredTrackDisplay = getTrackDisplay(featuredTrack);
  const latestTracks = LATEST_TRACKS.slice(0, 4);
  const popularPosts = [...posts]
    .sort(
      (left, right) =>
        (right.viewCount ?? 0) - (left.viewCount ?? 0) ||
        (right.likeCount ?? 0) - (left.likeCount ?? 0)
    )
    .slice(0, 5);

  return (
    <div className="main-page">
      <SiteHeader />

      <main className="main-shell">
        <section className="main-hero">
          <div className="main-hero-copy">
            <span className="main-label">SONG PROJECT</span>
            <h1>아이디어만 있으면 곡 스케치까지 바로.</h1>
            <p>
              멜로디를 찍고, 가사를 얹고, 공유곡을 참고하면서 나만의 곡을 빠르게 만들어보세요.
            </p>

            <div className="main-generator-card">
              <div className="main-generator-tabs">
                {GENERATOR_TABS.map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    className={tab.active ? 'is-active' : undefined}
                    onClick={() => navigate(tab.route)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="main-generator-prompt"
                onClick={() => navigate('/composer')}
              >
                밤 산책 느낌의 시티팝 코드 진행에 짧은 후렴 멜로디 만들기
              </button>
              <div className="main-chip-row">
                {GENRE_CHIPS.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
              <div className="main-generator-actions">
                <button type="button" className="main-button is-primary" onClick={() => navigate('/composer')}>
                  바로 작곡하기
                </button>
                <button type="button" className="main-button" onClick={() => navigate('/community/music')}>
                  레퍼런스 듣기
                </button>
              </div>
            </div>
          </div>

          <div className="main-showcase">
            <div className="main-now-playing">
              <span>NOW PLAYING</span>
              <strong>{featuredTrackDisplay.title}</strong>
              <small>{featuredTrack.progression}</small>
              <div className="main-eq" aria-hidden="true">
                {Array.from({ length: 16 }, (_, index) => (
                  <i key={index} style={{ '--delay': `${index * 0.06}s` } as CSSProperties} />
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
                      backgroundImage: `linear-gradient(180deg, rgba(8, 10, 14, 0.02), rgba(8, 10, 14, 0.24)), url(${getTrackCover(track)})`,
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

        <section className="main-feature-grid">
          {FEATURE_CARDS.map((item) => (
            <button key={item.label} type="button" onClick={() => navigate(item.route)}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <small>{item.body}</small>
            </button>
          ))}
        </section>

        <section className="main-content-grid">
          <article className="main-panel main-panel--wide">
            <div className="main-panel-head">
              <div>
                <span className="main-label">EXPLORE</span>
                <h2>요즘 올라온 공유곡</h2>
              </div>
              <button type="button" onClick={() => navigate('/community/music')}>
                전체 보기
              </button>
            </div>

            <div className="main-track-list">
              {latestTracks.map((track, index) => {
                const displayTrack = getTrackDisplay(track);

                return (
                  <button key={track.id} type="button" onClick={() => navigate('/community/music')}>
                    <span className="main-track-cover" style={{ backgroundImage: `url(${getTrackCover(track)})` }} />
                    <span className="main-track-copy">
                      <strong>{displayTrack.title}</strong>
                      <small>{track.progression}</small>
                    </span>
                    <em>{String(index + 1).padStart(2, '0')}</em>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="main-panel">
            <div className="main-panel-head">
              <div>
                <span className="main-label">COMMUNITY</span>
                <h2>작곡러들이 보는 글</h2>
              </div>
              <button type="button" onClick={() => navigate('/community')}>
                게시판
              </button>
            </div>

            <div className="main-post-list">
              {popularPosts.map((post) => {
                const displayPost = getPostDisplay(post);

                return (
                  <button key={post.id} type="button" onClick={() => navigate(`/community/${post.id}`)}>
                    <span>{displayPost.category}</span>
                    <strong>{displayPost.title}</strong>
                    <small>조회 {formatCount(post.viewCount)} · 좋아요 {formatCount(post.likeCount)}</small>
                  </button>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
