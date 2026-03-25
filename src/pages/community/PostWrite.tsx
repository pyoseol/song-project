import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore } from '../../store/communityStore';
import './PostWrite.css';

const TITLE_LIMIT = 120;
const CONTENT_LIMIT = 2000;

const CATEGORY_OPTIONS = ['질문', '정보', '장비', '작곡', '피드백'];
const TOOLBAR_ITEMS = ['B', 'I', 'U', '•', '1.', '#'];

const categoryGuideMap: Record<string, string> = {
  질문: '막힌 지점을 구체적으로 적으면 더 빠르게 답을 받을 수 있습니다.',
  정보: '직접 경험한 팁이나 자료를 정리해서 공유해보세요.',
  장비: '예산과 작업 환경을 같이 적으면 추천이 쉬워집니다.',
  작곡: '코드 진행이나 멜로디 고민을 예시와 함께 적어보세요.',
  피드백: '어디를 봐주면 좋은지 원하는 방향을 먼저 적어보세요.',
};

function getPreviewTags(tagInput: string) {
  return tagInput
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getPreviewText(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '아직 본문이 비어 있습니다. 지금 떠오르는 코드 진행, 질문, 작업 맥락을 편하게 적어보세요.';
  }

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 180)}...`;
}

export default function PostWrite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const posts = useCommunityStore((state) => state.posts);
  const bootstrapStatus = useCommunityStore((state) => state.bootstrapStatus);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const createPost = useCommunityStore((state) => state.createPost);
  const updatePost = useCommunityStore((state) => state.updatePost);
  const editPostId = searchParams.get('edit');
  const editingPost = editPostId ? posts.find((post) => post.id === editPostId) ?? null : null;
  const [category, setCategory] = useState(() => editingPost?.category ?? '질문');
  const [title, setTitle] = useState(() => editingPost?.title ?? '');
  const [content, setContent] = useState(() => editingPost?.content ?? '');
  const [tagInput, setTagInput] = useState(() => (editingPost?.tags ?? []).join(', '));

  const previewTags = getPreviewTags(tagInput);
  const paragraphCount = content.trim()
    ? content
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean).length
    : 0;
  const estimatedReadTime = Math.max(1, Math.ceil(content.trim().length / 260));
  const isReadyToSubmit = Boolean(title.trim() && content.trim());

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      navigate('/login');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const tags = getPreviewTags(tagInput);

    if (!trimmedTitle || !trimmedContent) {
      return;
    }

    if (editingPost) {
      await updatePost({
        postId: editingPost.id,
        title: trimmedTitle,
        content: trimmedContent,
        category,
        tags,
        userEmail: user.email,
      });
      navigate(`/community/${editingPost.id}`);
      return;
    }

    const createdPostId = await createPost({
      title: trimmedTitle,
      content: trimmedContent,
      category,
      tags,
      authorName: user.name,
      authorEmail: user.email,
    });

    navigate(`/community/${createdPostId}`);
  };

  if (
    editPostId &&
    (bootstrapStatus === 'idle' || bootstrapStatus === 'loading') &&
    !editingPost
  ) {
    return (
      <div className="community-write-page">
        <SiteHeader activeSection="community" />
        <main className="community-write-shell">
          <section className="community-write-hero-card">
            <div className="community-write-hero-copy">
              <div className="community-write-hero-badges">
                <span className="community-write-eyebrow">LOADING</span>
              </div>
              <h1 className="community-write-title">게시글을 불러오는 중입니다</h1>
              <p className="community-write-description">
                수정할 게시글 정보를 서버에서 가져오고 있습니다.
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="community-write-page">
      <SiteHeader activeSection="community" />

      <main className="community-write-shell">
        <section className="community-write-hero-card">
          <div className="community-write-hero-copy">
            <div className="community-write-hero-badges">
              <span className="community-write-eyebrow">
                {editingPost ? 'EDIT POST' : 'WRITE A POST'}
              </span>
              <span className="community-write-hero-chip">COMMUNITY EDITOR</span>
            </div>

            <h1 className="community-write-title">
              작업 맥락과 고민을
              <br />
              읽기 쉬운 글로 정리해보세요
            </h1>

            <p className="community-write-description">
              질문, 장비 추천, 작곡 아이디어처럼 맥락이 중요한 글일수록 제목과 본문 구조가
              또렷할수록 반응이 좋아집니다. 지금 선택한 카테고리에 맞게 글을 정리해보세요.
            </p>

            <div className="community-write-hero-actions">
              <button
                type="button"
                className="community-write-primary-button"
                onClick={() => navigate('/community')}
              >
                게시판으로 돌아가기
              </button>
              <button
                type="button"
                className="community-write-secondary-button"
                onClick={() => navigate('/composer?tutorial=1')}
              >
                작곡 가이드 보기
              </button>
            </div>
          </div>

          <div className="community-write-stat-grid">
            <article className="community-write-stat-card">
              <span>현재 상태</span>
              <strong>{editingPost ? '글 수정' : category}</strong>
              <small>{categoryGuideMap[category]}</small>
            </article>
            <article className="community-write-stat-card">
              <span>문단 수</span>
              <strong>{paragraphCount}</strong>
              <small>줄바꿈 기준으로 읽기 흐름을 계산합니다.</small>
            </article>
            <article className="community-write-stat-card">
              <span>예상 읽기 시간</span>
              <strong>{estimatedReadTime}분</strong>
              <small>본문 길이를 기준으로 간단히 추정합니다.</small>
            </article>
          </div>
        </section>

        <form className="community-write-layout" onSubmit={handleSubmit}>
          <section className="community-write-editor-panel">
            <div className="community-write-head">
              <label className="community-write-field">
                <span className="community-write-label">카테고리</span>
                <select
                  className="community-write-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label="카테고리 선택"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="community-write-field community-write-field--title">
                <span className="community-write-label">제목</span>
                <div className="community-write-title-wrap">
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value.slice(0, TITLE_LIMIT))}
                    placeholder="제목을 입력하세요"
                  />
                  <span className="community-write-counter">
                    {title.length}/{TITLE_LIMIT}
                  </span>
                </div>
              </label>
            </div>

            <section className="community-write-editor">
              <div className="community-write-toolbar" aria-hidden="true">
                {TOOLBAR_ITEMS.map((item) => (
                  <button key={item} type="button">
                    {item}
                  </button>
                ))}
                <span className="community-write-toolbar-spacer" />
                <span className="community-write-toolbar-note">에디터 미리보기 준비 중</span>
              </div>

              <label className="community-write-editor-body" aria-label="게시글 내용 입력">
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value.slice(0, CONTENT_LIMIT))}
                  placeholder={
                    '내용을 입력하세요.\n\n1. 어떤 상황인지\n2. 무엇이 막혔는지\n3. 어떤 답변을 원하는지\n\n이 순서로 적으면 읽는 사람이 빠르게 이해할 수 있습니다.'
                  }
                />
                <span className="community-write-editor-count">
                  {content.length}/{CONTENT_LIMIT}
                </span>
              </label>
            </section>

            <div className="community-write-meta-grid">
              <div className="community-write-help-card">
                <span className="community-write-help-label">WRITING TIP</span>
                <p>
                  Shift + Enter로 줄바꿈, Enter로 문단 구분이 들어갑니다. 코드 진행이나 장비명은
                  줄을 분리해 적으면 훨씬 읽기 좋아집니다.
                </p>
              </div>

              <label className="community-write-tag-field" aria-label="태그 입력">
                <span className="community-write-label">태그</span>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="#코드진행, 보이싱, DAW"
                />
              </label>
            </div>

            <div className="community-write-actions">
              <button
                type="button"
                className="community-write-cancel-button"
                onClick={() => navigate('/community')}
              >
                취소
              </button>
              <button
                type="submit"
                className="community-write-submit-button"
                disabled={!isReadyToSubmit}
              >
                {editingPost ? '게시글 수정' : '게시글 등록'}
              </button>
            </div>
          </section>

          <aside className="community-write-side-column">
            <section className="community-write-side-card">
              <span className="community-write-side-kicker">LIVE PREVIEW</span>
              <div className="community-write-preview-head">
                <span className="community-write-preview-category">{category}</span>
                <strong>{title.trim() || '아직 제목이 비어 있습니다'}</strong>
              </div>
              <p>{getPreviewText(content)}</p>
              <div className="community-write-preview-tags">
                {previewTags.length > 0 ? (
                  previewTags.map((tag) => (
                    <span key={tag} className="community-write-preview-tag">
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="community-write-preview-empty">
                    태그를 입력하면 여기에서 미리 보입니다
                  </span>
                )}
              </div>
            </section>

            <section className="community-write-side-card">
              <span className="community-write-side-kicker">CHECKLIST</span>
              <div className="community-write-checklist">
                <div className={`community-write-check-item${title.trim() ? ' is-complete' : ''}`}>
                  <span />
                  <p>제목이 읽히는 형태로 들어가면 클릭률이 좋아집니다.</p>
                </div>
                <div
                  className={`community-write-check-item${
                    content.trim().length >= 80 ? ' is-complete' : ''
                  }`}
                >
                  <span />
                  <p>본문에는 상황 설명과 원하는 답변이 같이 들어가면 좋습니다.</p>
                </div>
                <div
                  className={`community-write-check-item${
                    previewTags.length > 0 ? ' is-complete' : ''
                  }`}
                >
                  <span />
                  <p>태그를 넣으면 비슷한 관심사의 사용자가 글을 찾기 쉬워집니다.</p>
                </div>
              </div>
            </section>

            <section className="community-write-side-card community-write-side-card--accent">
              <span className="community-write-side-kicker">CATEGORY GUIDE</span>
              <strong>{category} 글을 잘 쓰는 방법</strong>
              <p>{categoryGuideMap[category]}</p>
            </section>
          </aside>
        </form>
      </main>
    </div>
  );
}
