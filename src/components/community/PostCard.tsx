import type { Post } from '../../types/community';

type PostCardProps = {
  post: Post;
  rank: number;
  onClick: () => void;
};

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

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minute = 1000 * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))}분 전`;
  }

  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))}시간 전`;
  }

  if (diff < day * 7) {
    return `${Math.max(1, Math.floor(diff / day))}일 전`;
  }

  return new Date(timestamp).toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  });
}

export default function PostCard({ post, rank, onClick }: PostCardProps) {
  const tone = getCategoryTone(post.category);

  return (
    <button
      type="button"
      className="community-post-row"
      onClick={onClick}
      aria-label={`${post.category ?? '게시글'} ${post.title}`}
    >
      <span className={`community-post-rank${rank <= 3 ? ' is-top' : ''}`}>
        {String(rank).padStart(2, '0')}
      </span>

      <span className="community-post-main">
        <span className="community-post-main-head">
          <span className={`community-post-tag community-post-tag--${tone}`}>
            {post.category ?? '자유'}
          </span>
          <span className="community-post-title">{post.title}</span>
          {post.isHot ? <span className="community-post-hot">HOT</span> : null}
        </span>

        <span className="community-post-meta">
          <span>{post.authorName}</span>
          <span>{formatRelativeTime(post.createdAt)}</span>
          {post.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="community-post-meta-tag">
              #{tag}
            </span>
          ))}
        </span>
      </span>

      <span className="community-post-stats">
        <span className="community-post-stat">
          <span className="community-post-stat-icon" aria-hidden="true">
            ◔
          </span>
          <strong>{formatCount(post.viewCount)}</strong>
        </span>
        <span className="community-post-stat">
          <span className="community-post-stat-icon" aria-hidden="true">
            ⌁
          </span>
          <strong>{formatCount(post.commentCount)}</strong>
        </span>
        <span className="community-post-stat is-like">
          <span className="community-post-stat-icon" aria-hidden="true">
            ♡
          </span>
          <strong>{formatCount(post.likeCount)}</strong>
        </span>
      </span>
    </button>
  );
}
