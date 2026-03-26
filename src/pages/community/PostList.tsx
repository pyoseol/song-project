import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PostCard from '../../components/community/PostCard';
import SiteHeader from '../../components/layout/SiteHeader';
import { useCommunityStore } from '../../store/communityStore';
import type { Post } from '../../types/community';
import './PostList.css';

type CategoryKey = 'all' | '질문' | '팁&정보' | '장비' | '작곡' | '피드백';
type SortKey = 'popular' | 'latest' | 'comments';

type CategoryItem = {
  key: CategoryKey;
  label: string;
};

const CATEGORY_ITEMS: CategoryItem[] = [
  { key: 'all', label: '전체' },
  { key: '질문', label: '질문' },
  { key: '팁&정보', label: '팁&정보' },
  { key: '장비', label: '장비' },
  { key: '작곡', label: '작곡' },
  { key: '피드백', label: '피드백' },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'popular', label: '인기순' },
  { key: 'latest', label: '최신순' },
  { key: 'comments', label: '댓글순' },
];

const PAGE_SIZE = 8;

function sortPosts(posts: Post[], sortKey: SortKey) {
  const cloned = [...posts];

  switch (sortKey) {
    case 'latest':
      return cloned.sort((a, b) => b.createdAt - a.createdAt);
    case 'comments':
      return cloned.sort(
        (a, b) =>
          (b.commentCount ?? 0) - (a.commentCount ?? 0) ||
          (b.likeCount ?? 0) - (a.likeCount ?? 0)
      );
    case 'popular':
    default:
      return cloned.sort(
        (a, b) =>
          (b.viewCount ?? 0) - (a.viewCount ?? 0) ||
          (b.likeCount ?? 0) - (a.likeCount ?? 0)
      );
  }
}

function matchesSearch(post: Post, searchTerm: string) {
  if (!searchTerm) {
    return true;
  }

  return [post.title, post.content, post.authorName, post.category, ...(post.tags ?? [])]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(searchTerm));
}

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function formatShortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

function getExcerpt(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 116) {
    return normalized;
  }

  return `${normalized.slice(0, 116)}...`;
}

function getTopTags(posts: Post[]) {
  const tagMap = new Map<string, number>();

  posts.forEach((post) => {
    post.tags?.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    });
  });

  return [...tagMap.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ko-KR'))
    .slice(0, 8);
}

export default function PostList() {
  const navigate = useNavigate();
  const posts = useCommunityStore((state) => state.posts);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('popular');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const allPopularPosts = sortPosts(posts, 'popular');
  const filteredPosts = sortPosts(
    posts.filter((post) => {
      const matchesCategory =
        selectedCategory === 'all' || post.category === selectedCategory;

      return matchesCategory && matchesSearch(post, normalizedKeyword);
    }),
    sortKey
  );

  const categoryCounts = CATEGORY_ITEMS.reduce<Record<CategoryKey, number>>(
    (counts, item) => {
      counts[item.key] =
        item.key === 'all'
          ? posts.length
          : posts.filter((post) => post.category === item.key).length;
      return counts;
    },
    {
      all: 0,
      질문: 0,
      '팁&정보': 0,
      장비: 0,
      작곡: 0,
      피드백: 0,
    }
  );

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const selectedCategoryLabel =
    CATEGORY_ITEMS.find((item) => item.key === selectedCategory)?.label ?? '전체';
  const selectedSortLabel =
    SORT_OPTIONS.find((item) => item.key === sortKey)?.label ?? '인기순';
  const totalViews = posts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0);
  const totalComments = posts.reduce(
    (sum, post) => sum + (post.commentCount ?? 0),
    0
  );
  const hotPostCount = posts.filter((post) => post.isHot).length;
  const topTags = getTopTags(posts);
  const hottestCategory =
    CATEGORY_ITEMS.filter((item) => item.key !== 'all').sort(
      (left, right) => categoryCounts[right.key] - categoryCounts[left.key]
    )[0] ?? null;
  const featuredPost =
    sortPosts(
      posts.filter(
        (post) => selectedCategory === 'all' || post.category === selectedCategory
      ),
      'popular'
    )[0] ??
    allPopularPosts[0] ??
    null;

  const handleCategoryChange = (category: CategoryKey) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleSortChange = (nextSortKey: SortKey) => {
    setSortKey(nextSortKey);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSortKey('popular');
    setSearchKeyword('');
    setCurrentPage(1);
  };

  const boardMetrics = [
    {
      label: '전체 글',
      value: formatCount(posts.length),
      note: '지금 커뮤니티에 쌓인 대화',
    },
    {
      label: '누적 조회',
      value: formatCount(totalViews),
      note: '많이 읽히는 질문과 팁',
    },
    {
      label: '핫 게시글',
      value: formatCount(hotPostCount),
      note: '빠르게 반응이 붙는 글',
    },
    {
      label: '전체 댓글',
      value: formatCount(totalComments),
      note: '피드백이 이어진 흔적',
    },
  ];

  return (
    <div className="community-page">
      <SiteHeader activeSection="community" />

      <main className="community-shell">
        <section className="community-hero-card">
          <div className="community-hero-copy">
            <div className="community-hero-badges">
              <span className="community-eyebrow">COMMUNITY BOARD</span>
              <span className="community-hero-chip">QUESTION · FEEDBACK · IDEA</span>
            </div>

            <h1 className="community-hero-title">
              질문부터 피드백까지,
              <br />
              곡이 완성되는 대화
            </h1>

            <p className="community-hero-description">
              코드 진행 고민, 장비 추천, 편곡 아이디어를 한곳에서 읽고 바로
              다음 작업으로 연결할 수 있도록 커뮤니티를 다시 정리했습니다.
            </p>

            <div className="community-hero-actions">
              <button
                type="button"
                className="community-primary-button"
                onClick={() => navigate('/community/write')}
              >
                게시글 작성하기
              </button>
              <button
                type="button"
                className="community-secondary-button"
                onClick={() => navigate('/composer?tutorial=1')}
              >
                작곡 가이드 보기
              </button>
            </div>
          </div>

          {featuredPost ? (
            <article className="community-hero-feature">
              <span className="community-hero-feature-label">오늘의 토론</span>
              <strong>{featuredPost.title}</strong>
              <p>{getExcerpt(featuredPost.content)}</p>
              <div className="community-hero-feature-meta">
                <span>{featuredPost.category ?? '자유'}</span>
                <span>{featuredPost.authorName}</span>
                <span>{formatShortDate(featuredPost.createdAt)}</span>
              </div>
              <div className="community-hero-feature-stats">
                <span>조회 {formatCount(featuredPost.viewCount)}</span>
                <span>댓글 {formatCount(featuredPost.commentCount)}</span>
                <span>좋아요 {formatCount(featuredPost.likeCount)}</span>
              </div>
            </article>
          ) : null}
        </section>

        <div className="community-layout">
          <aside className="community-sidebar">
            <section className="community-side-card">
              <div className="community-side-head">
                <span className="community-side-kicker">CATEGORIES</span>
                <strong>필터로 바로 탐색</strong>
              </div>

              <div className="community-sidebar-list">
                {CATEGORY_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`community-sidebar-button${
                      selectedCategory === item.key ? ' is-active' : ''
                    }`}
                    onClick={() => handleCategoryChange(item.key)}
                  >
                    <span>{item.label}</span>
                    <strong>{categoryCounts[item.key]}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="community-side-card">
              <div className="community-side-head">
                <span className="community-side-kicker">TREND TAGS</span>
                <strong>자주 함께 보는 키워드</strong>
              </div>

              <div className="community-tag-cloud">
                {topTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    className="community-tag-button"
                    onClick={() => handleSearchChange(tag)}
                  >
                    <span>#{tag}</span>
                    <strong>{count}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="community-side-card">
              <div className="community-side-head">
                <span className="community-side-kicker">COMMUNITY SPACES</span>
                <strong>다른 커뮤니티 공간</strong>
              </div>

              <div className="community-shortcut-list">
                <button
                  type="button"
                  className="community-shortcut-button"
                  onClick={() => navigate('/community/music')}
                >
                  <span>음악 공유</span>
                  <strong>보러가기</strong>
                </button>
                <button
                  type="button"
                  className="community-shortcut-button"
                  onClick={() => navigate('/community/market')}
                >
                  <span>중고 거래</span>
                  <strong>보러가기</strong>
                </button>
              </div>
            </section>

            <section className="community-side-card community-side-card--accent">
              <span className="community-side-kicker">NOW HOT</span>
              <strong>
                {hottestCategory?.label ?? '질문'} 카테고리에서 가장 활발하게
                대화가 이어지고 있어요
              </strong>
              <p>
                지금 가장 반응이 많은 주제는 {hottestCategory?.label ?? '질문'}이고,
                빠르게 참고할 만한 글이 {categoryCounts[hottestCategory?.key ?? 'all']}개
                쌓여 있습니다.
              </p>
              {hottestCategory ? (
                <button
                  type="button"
                  className="community-side-link"
                  onClick={() => handleCategoryChange(hottestCategory.key)}
                >
                  {hottestCategory.label} 글만 보기
                </button>
              ) : null}
            </section>
          </aside>

          <section className="community-board-column">
            <div className="community-metric-grid">
              {boardMetrics.map((metric) => (
                <article key={metric.label} className="community-metric-card">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </article>
              ))}
            </div>

            <section className="community-board-panel">
              <div className="community-board-head">
                <div>
                  <span className="community-board-kicker">
                    {selectedCategory === 'all'
                      ? 'ALL DISCUSSIONS'
                      : `${selectedCategoryLabel.toUpperCase()} BOARD`}
                  </span>
                  <h2 className="community-board-title">커뮤니티 게시판</h2>
                </div>
                <button
                  type="button"
                  className="community-reset-button"
                  onClick={handleResetFilters}
                >
                  필터 초기화
                </button>
              </div>

              <div className="community-board-toolbar">
                <label className="community-search" aria-label="게시물 검색">
                  <input
                    type="search"
                    value={searchKeyword}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="제목, 내용, 태그, 작성자로 검색..."
                  />
                </label>

                <div className="community-filter-row" role="tablist" aria-label="게시판 필터">
                  {CATEGORY_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`community-filter-chip${
                        selectedCategory === item.key ? ' is-active' : ''
                      }`}
                      onClick={() => handleCategoryChange(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="community-board-summary">
                <div className="community-summary-copy">
                  <strong>{filteredPosts.length}개의 게시물</strong>
                  <span>
                    {selectedCategoryLabel} 기준으로 보고 있고, 현재 정렬은{' '}
                    {selectedSortLabel}입니다.
                  </span>
                </div>

                <div className="community-sort-tabs">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`community-sort-button${
                        sortKey === option.key ? ' is-active' : ''
                      }`}
                      onClick={() => handleSortChange(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="community-post-board">
                <div className="community-post-header" aria-hidden="true">
                  <span>순위</span>
                  <span>주제</span>
                  <span>반응</span>
                </div>

                {visiblePosts.length > 0 ? (
                  visiblePosts.map((post, index) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      rank={startIndex + index + 1}
                      onClick={() => navigate(`/community/${post.id}`)}
                    />
                  ))
                ) : (
                  <div className="community-empty-state">
                    <strong>조건에 맞는 게시물이 아직 없습니다.</strong>
                    <span>검색어를 바꾸거나 다른 카테고리를 선택해 보세요.</span>
                  </div>
                )}
              </div>

              <div className="community-board-footer">
                <div className="community-pagination">
                  <button
                    type="button"
                    className="community-page-button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage === 1}
                    aria-label="이전 페이지"
                  >
                    ‹
                  </button>

                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`community-page-button${
                        safePage === pageNumber ? ' is-active' : ''
                      }`}
                      onClick={() => setCurrentPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="community-page-button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={safePage === totalPages}
                    aria-label="다음 페이지"
                  >
                    ›
                  </button>
                </div>

                <button
                  type="button"
                  className="community-write-button"
                  onClick={() => navigate('/community/write')}
                >
                  + 글 쓰기
                </button>
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
