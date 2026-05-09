import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunitySpaceNav from '../../components/community/CommunitySpaceNav';
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
  const filteredPosts = sortPosts(
    posts.filter((post) => {
      const matchesCategory =
        selectedCategory === 'all' || post.category === selectedCategory;

      return matchesCategory && matchesSearch(post, normalizedKeyword);
    }),
    sortKey
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

  return (
    <div className="community-page">
      <SiteHeader activeSection="community" />

      <main className="community-shell">
        <CommunitySpaceNav active="board" />

        <section className="community-board-column">
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
                <button
                  type="button"
                  className="community-reset-button community-reset-button--inline"
                  onClick={handleResetFilters}
                >
                  필터 초기화
                </button>
              </div>
            </div>

            <div className="community-board-summary">
              <div className="community-summary-copy">
                <strong>{filteredPosts.length}개의 게시물</strong>
                <span>
                  {selectedCategoryLabel} 기준으로 보고 있고, 현재 정렬은 {selectedSortLabel}입니다.
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
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage === totalPages}
                  aria-label="다음 페이지"
                >
                  ›
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>

      <div className="community-floating-actions">
        <button
          type="button"
          className="community-floating-music-button"
          onClick={() => navigate('/community/music')}
        >
          음악 공유
        </button>
        <button
          type="button"
          className="community-floating-write-button"
          onClick={() => navigate('/community/write')}
        >
          + 글쓰기
        </button>
      </div>
    </div>
  );
}
