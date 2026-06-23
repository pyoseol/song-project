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

const MAIN_FALLBACK_POSTS: Post[] = [
  {
    id: 'main-fallback-1',
    title: '후렴 멜로디가 밋밋할 때 바로 써먹는 방법',
    content: '반복되는 음 사이에 한두 박자 쉼표를 넣고 마지막 음만 위로 열어보세요.',
    authorId: 'main',
    authorName: 'SongMaker',
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    likeCount: 18,
    viewCount: 142,
    category: '작곡팁',
    isHot: true,
  },
  {
    id: 'main-fallback-2',
    title: '시티팝 코드 진행에 어울리는 드럼 패턴 추천',
    content: '킥은 단순하게 두고 하이햇으로 움직임을 만드는 쪽이 깔끔합니다.',
    authorId: 'main',
    authorName: 'SongMaker',
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    likeCount: 12,
    viewCount: 98,
    category: '피드백',
  },
  {
    id: 'main-fallback-3',
    title: '공유곡 올릴 때 제목을 잘 짓는 작은 팁',
    content: '장르, 분위기, 용도를 같이 넣으면 사람들이 훨씬 빨리 눌러봅니다.',
    authorId: 'main',
    authorName: 'SongMaker',
    createdAt: Date.now() - 1000 * 60 * 60 * 16,
    likeCount: 9,
    viewCount: 76,
    category: '커뮤니티',
  },
];

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

const HOT_CHART_DETAILS: Record<
  string,
  {
    artist: string;
    plan: 'Basic' | 'Premium';
    duration: string;
    tags: [string, string];
    downloads: number;
  }
> = {
  'trend-1': {
    artist: 'MangMARU',
    plan: 'Basic',
    duration: '03:05',
    tags: ['차분한 힙합/알앤비', '일렉기타 빠름'],
    downloads: 1842,
  },
  'trend-2': {
    artist: '브금냥',
    plan: 'Basic',
    duration: '01:35',
    tags: ['따뜻한 팝', '신디사이저 빠름'],
    downloads: 1730,
  },
  'trend-3': {
    artist: 'Moopi',
    plan: 'Premium',
    duration: '02:57',
    tags: ['따뜻한 팝', '신디사이저 보통 빠름'],
    downloads: 1654,
  },
  'trend-4': {
    artist: 'slowslow',
    plan: 'Basic',
    duration: '01:16',
    tags: ['몽환적인 팝', '신디사이저 느림'],
    downloads: 1512,
  },
  'trend-5': {
    artist: '휘르리',
    plan: 'Basic',
    duration: '01:46',
    tags: ['몽환적인 팝', '신디사이저 느림'],
    downloads: 1468,
  },
  'trend-6': {
    artist: 'noonroom',
    plan: 'Premium',
    duration: '02:24',
    tags: ['시네마틱 OST', '피아노 보통'],
    downloads: 1395,
  },
  'trend-7': {
    artist: 'cyanlake',
    plan: 'Basic',
    duration: '02:12',
    tags: ['공간감 있는 앰비언트', '패드 느림'],
    downloads: 1328,
  },
  'trend-8': {
    artist: 'groovezip',
    plan: 'Basic',
    duration: '01:58',
    tags: ['경쾌한 그루브', '베이스 빠름'],
    downloads: 1284,
  },
  'latest-1': {
    artist: 'loopkey',
    plan: 'Basic',
    duration: '02:03',
    tags: ['펑키한 팝', '기타 보통'],
    downloads: 1197,
  },
  'latest-2': {
    artist: 'bandnote',
    plan: 'Premium',
    duration: '02:41',
    tags: ['청량한 밴드', '드럼 빠름'],
    downloads: 1139,
  },
};

type HotChartView = 'weekly' | 'genre' | 'monthly';

const HOT_CHART_TABS: Array<{ key: HotChartView; label: string }> = [
  { key: 'weekly', label: '6월 3주차' },
  { key: 'genre', label: '장르별' },
  { key: 'monthly', label: '월간 BGM' },
];

const HOT_CHART_DESCRIPTIONS: Record<HotChartView, string> = {
  weekly: '다운로드와 반응이 빠르게 쌓이는 이번 주 공유곡을 모았습니다.',
  genre: '서로 다른 장르에서 가장 반응이 좋은 대표 공유곡을 골랐습니다.',
  monthly: '한 달 동안 꾸준히 사랑받은 BGM과 루프를 모았습니다.',
};

const MONTHLY_BGM_ORDER = ['latest-2', 'trend-6', 'latest-1', 'trend-2', 'trend-8'];
const CHART_FAVORITES_STORAGE_KEY = 'song-project-chart-favorites';

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

function getWaveformBars(seed: string, count = 44) {
  let value = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return Array.from({ length: count }, (_, index) => {
    value = (value * 1664525 + 1013904223 + index) % 4294967296;
    const normalized = value / 4294967296;
    const swell = Math.sin((index / count) * Math.PI);
    return Math.round(18 + normalized * 42 + swell * 24);
  });
}

export default function MainPage() {
  const navigate = useNavigate();
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);
  const [hotChartView, setHotChartView] = useState<HotChartView>('weekly');
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(CHART_FAVORITES_STORAGE_KEY) ?? '[]');
      return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  });
  const posts = useCommunityStore((state) => state.posts);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  const showcaseTracks = TRENDING_TRACKS.slice(0, 5);
  const featuredTrack = showcaseTracks[activeCoverIndex];
  const featuredTrackDisplay = getTrackDisplay(featuredTrack);
  const latestTracks = LATEST_TRACKS.slice(0, 4);
  const chartCandidates = [...TRENDING_TRACKS, ...LATEST_TRACKS].filter(
    (track) => HOT_CHART_DETAILS[track.id]
  );
  const hotChartTracks = (() => {
    if (hotChartView === 'monthly') {
      return MONTHLY_BGM_ORDER.map((id) => chartCandidates.find((track) => track.id === id)).filter(
        (track): track is CommunityTrack => Boolean(track)
      );
    }

    const ranked = [...chartCandidates].sort(
      (left, right) => HOT_CHART_DETAILS[right.id].downloads - HOT_CHART_DETAILS[left.id].downloads
    );

    if (hotChartView === 'genre') {
      const selectedGenres = new Set<string>();
      const genreLeaders = ranked.filter((track) => {
        const genre = HOT_CHART_DETAILS[track.id].tags[0];
        if (selectedGenres.has(genre)) return false;
        selectedGenres.add(genre);
        return true;
      });
      return [...genreLeaders, ...ranked.filter((track) => !genreLeaders.includes(track))].slice(0, 5);
    }

    return ranked.slice(0, 5);
  })();
  const popularPosts = [...(posts.length ? posts : MAIN_FALLBACK_POSTS)]
    .sort(
      (left, right) =>
        (right.viewCount ?? 0) - (left.viewCount ?? 0) ||
        (right.likeCount ?? 0) - (left.likeCount ?? 0)
    )
    .slice(0, 5);

  const toggleChartFavorite = (trackId: string) => {
    setFavoriteTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      window.localStorage.setItem(CHART_FAVORITES_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const downloadChartTrack = (track: CommunityTrack) => {
    const display = getTrackDisplay(track);
    const detail = HOT_CHART_DETAILS[track.id];
    const content = [
      `제목: ${display.title}`,
      `작가: ${detail.artist}`,
      `코드 진행: ${track.progression}`,
      `분위기: ${display.mood}`,
      `태그: ${detail.tags.join(', ')}`,
      `재생 시간: ${detail.duration}`,
      '',
      'Song Project 공유곡 정보',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${display.title.replace(/[\\/:*?"<>|]+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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

            <div className="main-showcase-stage" aria-label="추천 공유곡 플레이어">
              <div className="main-featured-track">
                <span
                  className="main-featured-cover"
                  style={{ backgroundImage: `url(${getTrackCover(featuredTrack)})` }}
                />
                <div className="main-featured-copy">
                  <span>오늘의 추천</span>
                  <strong>{featuredTrackDisplay.title}</strong>
                  <small>{featuredTrackDisplay.mood}</small>
                  <em>{featuredTrack.progression}</em>
                </div>
              </div>

              <div className="main-featured-wave" aria-hidden="true">
                {getWaveformBars(featuredTrack.id, 56).map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>

              <div className="main-showcase-actions">
                <button
                  type="button"
                  onClick={() =>
                    setActiveCoverIndex((current) =>
                      (current - 1 + showcaseTracks.length) % showcaseTracks.length
                    )
                  }
                >
                  이전
                </button>
                <button type="button" onClick={() => navigate('/community/music')}>
                  공유곡 듣기
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveCoverIndex((current) => (current + 1) % showcaseTracks.length)
                  }
                >
                  다음
                </button>
              </div>

              <div className="main-featured-queue" role="list" aria-label="추천 공유곡 목록">
                {showcaseTracks.map((track, index) => {
                  const displayTrack = getTrackDisplay(track);
                  const isActive = index === activeCoverIndex;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      className={isActive ? 'is-active' : undefined}
                      onClick={() => setActiveCoverIndex(index)}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{displayTrack.title}</strong>
                      <small>{track.progression}</small>
                    </button>
                  );
                })}
              </div>
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

        <section className="main-hot-chart" aria-labelledby="main-hot-chart-title">
          <div className="main-hot-chart-head">
            <span className="main-label">COMMUNITY CHART</span>
            <h2 id="main-hot-chart-title">
              <i aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
              공유곡 <em>HOT 5</em>
            </h2>
            <p>{HOT_CHART_DESCRIPTIONS[hotChartView]}</p>
            <div className="main-hot-chart-filters" aria-label="HOT 5 차트 보기">
              {HOT_CHART_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={hotChartView === tab.key ? 'is-active' : undefined}
                  aria-pressed={hotChartView === tab.key}
                  onClick={() => setHotChartView(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="main-hot-chart-list" key={hotChartView}>
            {hotChartTracks.map((track, index) => {
              const displayTrack = getTrackDisplay(track);
              const detail = HOT_CHART_DETAILS[track.id];
              const isEditorsPick = index === 0;
              const isFavorite = favoriteTrackIds.has(track.id);

              return (
                <article
                  key={track.id}
                  className={`main-hot-chart-row${isEditorsPick ? ' is-editor-pick' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/community/music')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') navigate('/community/music');
                  }}
                >
                  <span className="main-hot-rank">
                    {isEditorsPick ? (
                      <>
                        <small>Editor&apos;s</small>
                        <strong>PICK</strong>
                      </>
                    ) : (
                      <strong>{index}</strong>
                    )}
                  </span>
                  <span
                    className="main-hot-cover"
                    style={{ backgroundImage: `url(${getTrackCover(track)})` }}
                  />
                  <span className="main-hot-title">
                    <strong>{displayTrack.title}</strong>
                    <small>{detail.artist}</small>
                  </span>
                  <span className={`main-hot-plan is-${detail.plan.toLowerCase()}`}>
                    {detail.plan}
                  </span>
                  <span className="main-hot-play" aria-hidden="true" />
                  <span className="main-hot-wave" aria-hidden="true">
                    {getWaveformBars(track.id).map((height, barIndex) => (
                      <i key={barIndex} style={{ height: `${height}%` }} />
                    ))}
                  </span>
                  <span className="main-hot-duration">{detail.duration}</span>
                  <span className="main-hot-tags">
                    <strong>{detail.tags[0]}</strong>
                    <small>{detail.tags[1]}</small>
                  </span>
                  <span className="main-hot-actions">
                    <i className="is-signal" aria-hidden="true" />
                    <button
                      type="button"
                      className={`main-hot-action-button is-heart${isFavorite ? ' is-active' : ''}`}
                      aria-label={isFavorite ? `${displayTrack.title} 좋아요 취소` : `${displayTrack.title} 좋아요`}
                      aria-pressed={isFavorite}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleChartFavorite(track.id);
                      }}
                    >
                      {isFavorite ? '♥' : '♡'}
                    </button>
                    <button
                      type="button"
                      className="main-hot-action-button"
                      aria-label={`${displayTrack.title} 다운로드`}
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadChartTrack(track);
                      }}
                    >
                      <i className="is-download" aria-hidden="true" />
                    </button>
                  </span>
                </article>
              );
            })}
          </div>
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
                const isFallbackPost = post.id.startsWith('main-fallback-');

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(isFallbackPost ? '/community' : `/community/${post.id}`)}
                  >
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
