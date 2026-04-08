import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore } from '../../store/communityStore';
import { useNotificationStore } from '../../store/notificationStore';
import type { Comment, Post } from '../../types/community';
import './PostDetail.css';

type CommentNode = {
  comment: Comment;
  children: CommentNode[];
};

const categoryToneMap: Record<string, string> = {
  질문: 'indigo',
  정보: 'mint',
  장비: 'amber',
  작곡: 'violet',
  피드백: 'rose',
};

const categoryGuideMap: Record<string, string> = {
  질문: '질문 글에는 현재 막히는 지점과 시도한 방법을 같이 적어주면 더 빠르게 도움을 받을 수 있습니다.',
  정보: '직접 경험한 팁이나 정리한 내용을 남기면 다른 사용자에게도 큰 도움이 됩니다.',
  장비: '예산과 작업 환경을 함께 적어주면 더 현실적인 추천을 받을 수 있습니다.',
  작곡: '코드 진행, 멜로디, 참고 곡을 같이 적어주면 더 구체적인 피드백이 가능합니다.',
  피드백: '어떤 부분이 궁금한지 먼저 적어주면 필요한 코멘트가 더 정확해집니다.',
};

function isCommunityManagerEmail(email?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('admin@') ||
    normalized.startsWith('mod@') ||
    normalized.startsWith('manager@') ||
    normalized.includes('moderator') ||
    normalized.includes('manager')
  );
}

function buildCommentTree(comments: Comment[]) {
  const nodeMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    nodeMap.set(comment.id, {
      comment,
      children: [],
    });
  });

  comments.forEach((comment) => {
    const node = nodeMap.get(comment.id);

    if (!node) {
      return;
    }

    if (comment.parentId && nodeMap.has(comment.parentId)) {
      nodeMap.get(comment.parentId)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
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

  return new Date(timestamp).toLocaleDateString('ko-KR');
}

function formatFullDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function getAvatarSeed(name: string) {
  return name.slice(0, 1).toUpperCase();
}

function getSummary(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= 170 ? normalized : `${normalized.slice(0, 170)}...`;
}

function getParagraphs(content: string) {
  return content
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const posts = useCommunityStore((state) => state.posts);
  const commentsStore = useCommunityStore((state) => state.comments);
  const bootstrapStatus = useCommunityStore((state) => state.bootstrapStatus);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const likedPostIdsByUser = useCommunityStore((state) => state.likedPostIdsByUser);
  const bookmarkedPostIdsByUser = useCommunityStore((state) => state.bookmarkedPostIdsByUser);
  const reportedPostIdsByUser = useCommunityStore((state) => state.reportedPostIdsByUser);
  const recordView = useCommunityStore((state) => state.recordView);
  const toggleLike = useCommunityStore((state) => state.toggleLike);
  const toggleBookmark = useCommunityStore((state) => state.toggleBookmark);
  const reportPost = useCommunityStore((state) => state.reportPost);
  const deletePost = useCommunityStore((state) => state.deletePost);
  const moderatePost = useCommunityStore((state) => state.moderatePost);
  const addComment = useCommunityStore((state) => state.addComment);
  const replyComment = useCommunityStore((state) => state.replyComment);
  const updateComment = useCommunityStore((state) => state.updateComment);
  const deleteComment = useCommunityStore((state) => state.deleteComment);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [commentInput, setCommentInput] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentInput, setEditingCommentInput] = useState('');
  const [commentToastMessage, setCommentToastMessage] = useState('');

  const post: Post | null = posts.find((item) => item.id === id) ?? null;
  const comments: Comment[] = useMemo(
    () => commentsStore.filter((item) => item.postId === id),
    [commentsStore, id]
  );
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  useEffect(() => {
    if (!id || bootstrapStatus !== 'ready') {
      return;
    }

    void recordView(id).catch((error) => {
      console.error(error);
    });
  }, [bootstrapStatus, id, recordView]);

  useEffect(() => {
    if (!commentToastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCommentToastMessage('');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [commentToastMessage]);

  if (!post && (bootstrapStatus === 'idle' || bootstrapStatus === 'loading')) {
    return (
      <div className="community-detail-page">
        <SiteHeader activeSection="community" />

        <main className="community-detail-shell">
          <section className="community-detail-empty-card">
            <span className="community-detail-empty-kicker">LOADING</span>
            <strong>게시글을 불러오는 중입니다.</strong>
            <p>서버에서 최신 커뮤니티 내용을 가져오고 있습니다.</p>
          </section>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="community-detail-page">
        <SiteHeader activeSection="community" />

        <main className="community-detail-shell">
          <section className="community-detail-empty-card">
            <span className="community-detail-empty-kicker">NOT FOUND</span>
            <strong>존재하지 않는 게시글입니다.</strong>
            <p>삭제되었거나 잘못된 주소일 수 있습니다. 게시판으로 돌아가 다시 확인해보세요.</p>
            <div className="community-detail-empty-actions">
              <button type="button" onClick={() => navigate('/community')}>
                게시판으로 돌아가기
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const liked = !!user && (likedPostIdsByUser[user.email] ?? []).includes(post.id);
  const bookmarked = !!user && (bookmarkedPostIdsByUser[user.email] ?? []).includes(post.id);
  const reported = !!user && (reportedPostIdsByUser[user.email] ?? []).includes(post.id);
  const isMine = !!user && post.authorId === user.email;
  const isManager = !!user && isCommunityManagerEmail(user.email);
  const tone = categoryToneMap[post.category ?? '질문'] ?? 'slate';
  const paragraphs = getParagraphs(post.content);
  const summary = getSummary(post.content);

  const handleCommentSubmit = async () => {
    const nextValue = commentInput.trim();
    if (!nextValue) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    await addComment({
      postId: post.id,
      authorName: user.name,
      authorEmail: user.email,
      content: nextValue,
    });
    pushNotification({
      kind: 'community',
      title: '커뮤니티 댓글 등록',
      body: `"${post.title}" 글에 댓글을 남겼습니다.`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
    setCommentInput('');
    setCommentToastMessage('댓글을 달았습니다.');
  };

  const handleReplySubmit = async (comment: Comment) => {
    const nextValue = replyInput.trim();
    if (!nextValue) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    await replyComment({
      commentId: comment.id,
      postId: post.id,
      authorName: user.name,
      authorEmail: user.email,
      content: nextValue,
    });
    pushNotification({
      kind: 'community',
      title: '답글 등록',
      body: `${comment.authorName}님의 댓글에 답글을 남겼습니다.`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
    setReplyTargetId(null);
    setReplyInput('');
    setCommentToastMessage('답글을 달았습니다.');
  };

  const handleCommentUpdate = async (comment: Comment) => {
    const nextValue = editingCommentInput.trim();
    if (!nextValue || !user) {
      return;
    }

    await updateComment({
      commentId: comment.id,
      userEmail: user.email,
      content: nextValue,
    });
    setEditingCommentId(null);
    setEditingCommentInput('');
  };

  const handleCommentDelete = async (comment: Comment) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const confirmed = window.confirm('이 댓글을 삭제할까요? 답글이 있으면 함께 삭제됩니다.');
    if (!confirmed) {
      return;
    }

    await deleteComment(comment.id, user.email);
    if (replyTargetId === comment.id) {
      setReplyTargetId(null);
      setReplyInput('');
    }
    if (editingCommentId === comment.id) {
      setEditingCommentId(null);
      setEditingCommentInput('');
    }
  };

  const handleToggleLike = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    await toggleLike(post.id, user.email);
    pushNotification({
      kind: 'community',
      title: liked ? '좋아요 취소' : '커뮤니티 좋아요',
      body: `"${post.title}" 글을 ${liked ? '좋아요 목록에서 뺐습니다.' : '좋아요했습니다.'}`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
  };

  const handleToggleBookmark = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextBookmarked = await toggleBookmark(post.id, user.email);
    pushNotification({
      kind: 'community',
      title: nextBookmarked ? '북마크 추가' : '북마크 해제',
      body: `"${post.title}" 글을 ${nextBookmarked ? '저장했습니다.' : '저장 목록에서 뺐습니다.'}`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
  };

  const handleReport = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    await reportPost(post.id, user.email);
    pushNotification({
      kind: 'community',
      title: '게시글 신고 접수',
      body: `"${post.title}" 글 신고가 접수되었습니다.`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
  };

  const handleDelete = async () => {
    if (!user || !isMine) {
      return;
    }

    const confirmed = window.confirm('이 게시글을 삭제할까요?');
    if (!confirmed) {
      return;
    }

    await deletePost(post.id, user.email);
    navigate('/community');
  };

  const handleModerate = async (action: 'delete-post' | 'block-user') => {
    if (!user || !isManager) {
      return;
    }

    const message =
      action === 'delete-post'
        ? '관리자 권한으로 이 게시글을 삭제할까요?'
        : '이 작성자를 차단하면 작성자의 게시글과 댓글이 커뮤니티에서 숨겨집니다. 계속할까요?';

    if (!window.confirm(message)) {
      return;
    }

    await moderatePost(post.id, user.email, action);
    navigate('/community');
  };

  const renderCommentNode = (node: CommentNode, depth = 0) => {
    const comment = node.comment;
    const canManageComment = !!user && (comment.authorEmail === user.email || isManager);
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyTargetId === comment.id;

    return (
      <div key={comment.id} className="community-detail-comment-thread">
        <article
          className={`community-detail-comment-item${depth > 0 ? ' is-reply' : ''}`}
          style={{ marginLeft: depth ? `${Math.min(depth, 3) * 22}px` : undefined }}
        >
          <span className="community-detail-comment-avatar" aria-hidden="true">
            {getAvatarSeed(comment.authorName)}
          </span>
          <div className="community-detail-comment-copy">
            <div className="community-detail-comment-head">
              <strong>{comment.authorName}</strong>
              <span>{formatRelativeTime(comment.createdAt)}</span>
            </div>

            {isEditing ? (
              <div className="community-detail-comment-editor">
                <textarea
                  value={editingCommentInput}
                  onChange={(event) => setEditingCommentInput(event.target.value)}
                  placeholder="수정할 댓글을 입력하세요"
                />
                <div className="community-detail-comment-editor-actions">
                  <button type="button" onClick={() => handleCommentUpdate(comment)}>
                    저장
                  </button>
                  <button
                    type="button"
                    className="community-detail-secondary-button"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentInput('');
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <p>{comment.content}</p>
            )}

            <div className="community-detail-comment-actions">
              <span>좋아요 {formatCount(comment.likeCount)}</span>
              <button
                type="button"
                className="community-detail-comment-action-button"
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }

                  setEditingCommentId(null);
                  setEditingCommentInput('');
                  setReplyTargetId((current) => (current === comment.id ? null : comment.id));
                  setReplyInput('');
                }}
              >
                답글
              </button>
              {canManageComment ? (
                <>
                  <button
                    type="button"
                    className="community-detail-comment-action-button"
                    onClick={() => {
                      setReplyTargetId(null);
                      setReplyInput('');
                      setEditingCommentId(comment.id);
                      setEditingCommentInput(comment.content);
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="community-detail-comment-action-button is-danger"
                    onClick={() => handleCommentDelete(comment)}
                  >
                    삭제
                  </button>
                </>
              ) : null}
            </div>

            {isReplying ? (
              <div className="community-detail-comment-editor community-detail-comment-editor--reply">
                <textarea
                  value={replyInput}
                  onChange={(event) => setReplyInput(event.target.value)}
                  placeholder={`${comment.authorName}님에게 답글 남기기`}
                />
                <div className="community-detail-comment-editor-actions">
                  <button type="button" onClick={() => handleReplySubmit(comment)}>
                    답글 등록
                  </button>
                  <button
                    type="button"
                    className="community-detail-secondary-button"
                    onClick={() => {
                      setReplyTargetId(null);
                      setReplyInput('');
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        {node.children.length ? (
          <div className="community-detail-comment-replies">
            {node.children.map((child) => renderCommentNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="community-detail-page">
      <SiteHeader activeSection="community" />

      <main className="community-detail-shell">
        <section className="community-detail-hero-card">
          <div className="community-detail-hero-copy">
            <div className="community-detail-badges">
              <span className={`community-detail-category community-detail-category--${tone}`}>
                {post.category ?? '질문'}
              </span>
              {post.isHot ? <span className="community-detail-hot">HOT</span> : null}
            </div>

            <h1 className="community-detail-title">{post.title}</h1>
            <p className="community-detail-summary">{summary}</p>

            <div className="community-detail-meta">
              <span className="community-detail-meta-avatar" aria-hidden="true">
                {getAvatarSeed(post.authorName)}
              </span>
              <span className="community-detail-meta-author">{post.authorName}</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span>{formatFullDate(post.createdAt)}</span>
            </div>

            <div className="community-detail-hero-actions">
              <button
                type="button"
                className="community-detail-secondary-button"
                onClick={() => navigate('/community')}
              >
                게시판으로
              </button>
              <button
                type="button"
                className="community-detail-primary-button"
                onClick={() =>
                  navigate(isMine ? `/community/write?edit=${post.id}` : '/community/write')
                }
              >
                {isMine ? '글 수정' : '글 쓰기'}
              </button>
            </div>
          </div>

          <div className="community-detail-stat-grid">
            <article className="community-detail-stat-card">
              <span>조회수</span>
              <strong>{formatCount(post.viewCount)}</strong>
              <small>지금까지 읽은 사용자 수</small>
            </article>
            <article className="community-detail-stat-card">
              <span>댓글</span>
              <strong>{formatCount(comments.length)}</strong>
              <small>이 글에 이어진 반응</small>
            </article>
            <article className="community-detail-stat-card">
              <span>좋아요</span>
              <strong>{formatCount(post.likeCount)}</strong>
              <small>공감과 저장의 지표</small>
            </article>
          </div>
        </section>

        <div className="community-detail-layout">
          <div className="community-detail-main-column">
            <article className="community-detail-article-card">
              <div className="community-detail-panel-head">
                <span className="community-detail-panel-kicker">ARTICLE</span>
                <strong>본문</strong>
              </div>

              <div className="community-detail-content">
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {post.tags?.length ? (
                <div className="community-detail-tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="community-detail-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>

            <section className="community-detail-comments-card">
              <div className="community-detail-panel-head">
                <span className="community-detail-panel-kicker">COMMENTS</span>
                <strong>댓글 {comments.length}</strong>
              </div>

              <div className="community-detail-comment-form">
                <span className="community-detail-comment-avatar" aria-hidden="true">
                  {user ? getAvatarSeed(user.name) : 'G'}
                </span>
                <div className="community-detail-comment-form-body">
                  <textarea
                    value={commentInput}
                    onChange={(event) => setCommentInput(event.target.value)}
                    placeholder="댓글을 입력해보세요"
                  />
                  <div className="community-detail-comment-submit-row">
                    <button type="button" onClick={handleCommentSubmit}>
                      등록
                    </button>
                  </div>
                </div>
              </div>

              <div className="community-detail-comment-list">
                {commentTree.length ? (
                  commentTree.map((node) => renderCommentNode(node))
                ) : (
                  <div className="community-detail-comment-empty">
                    아직 댓글이 없습니다. 첫 반응을 남겨보세요.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="community-detail-side-column">
            <section className="community-detail-side-card">
              <span className="community-detail-panel-kicker">POST INFO</span>
              <div className="community-detail-side-author">
                <span className="community-detail-side-avatar" aria-hidden="true">
                  {getAvatarSeed(post.authorName)}
                </span>
                <div>
                  <strong>{post.authorName}</strong>
                  <span>{formatFullDate(post.createdAt)}</span>
                </div>
              </div>

              <div className="community-detail-info-list">
                <div className="community-detail-info-item">
                  <span>카테고리</span>
                  <strong>{post.category ?? '질문'}</strong>
                </div>
                <div className="community-detail-info-item">
                  <span>조회수</span>
                  <strong>{formatCount(post.viewCount)}</strong>
                </div>
                <div className="community-detail-info-item">
                  <span>댓글</span>
                  <strong>{formatCount(comments.length)}</strong>
                </div>
              </div>
            </section>

            <section className="community-detail-side-card community-detail-side-card--accent">
              <span className="community-detail-panel-kicker">CATEGORY NOTE</span>
              <strong>{post.category ?? '질문'} 글을 잘 쓰는 방법</strong>
              <p>{categoryGuideMap[post.category ?? '질문']}</p>
            </section>

            <section className="community-detail-side-card">
              <span className="community-detail-panel-kicker">ACTIONS</span>
              <div className="community-detail-side-actions">
                <button
                  type="button"
                  className={`community-detail-like-button${liked ? ' is-active' : ''}`}
                  onClick={handleToggleLike}
                >
                  {liked ? '좋아요 취소' : '좋아요'} / {formatCount(post.likeCount)}
                </button>
                <button
                  type="button"
                  className={`community-detail-secondary-button${
                    bookmarked ? ' is-active' : ''
                  }`}
                  onClick={handleToggleBookmark}
                >
                  {bookmarked ? '북마크 해제' : '북마크'}
                </button>
                <button
                  type="button"
                  className="community-detail-secondary-button"
                  onClick={handleReport}
                  disabled={reported}
                >
                  {reported ? '신고 완료' : '신고하기'}
                </button>
                {isMine ? (
                  <>
                    <button
                      type="button"
                      className="community-detail-secondary-button"
                      onClick={() => navigate(`/community/write?edit=${post.id}`)}
                    >
                      글 수정
                    </button>
                    <button
                      type="button"
                      className="community-detail-secondary-button is-danger"
                      onClick={handleDelete}
                    >
                      글 삭제
                    </button>
                  </>
                ) : null}
                {isManager ? (
                  <>
                    <button
                      type="button"
                      className="community-detail-secondary-button is-danger"
                      onClick={() => handleModerate('delete-post')}
                    >
                      관리자 삭제
                    </button>
                    <button
                      type="button"
                      className="community-detail-secondary-button is-danger"
                      onClick={() => handleModerate('block-user')}
                    >
                      작성자 차단
                    </button>
                  </>
                ) : null}
              </div>

              {post.tags?.length ? (
                <div className="community-detail-side-tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="community-detail-side-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </main>
      {commentToastMessage ? (
        <div className="community-detail-toast" role="status" aria-live="polite">
          {commentToastMessage}
        </div>
      ) : null}
    </div>
  );
}
