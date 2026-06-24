import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import TrackWaveform from '../../components/community/TrackWaveform';
import {
  BASE_SHARED_TRACK_LIBRARY,
  buildSharedTrackCard,
  type MusicShareTrackCard,
} from '../../dummy/musicShareLibrary';
import { useAuthStore } from '../../store/authStore';
import { useComposerLibraryStore } from '../../store/composerLibraryStore';
import { useMusicShareStore } from '../../store/musicShareStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useSongStore } from '../../store/songStore';
import { analyzeSongSketchDna, getProjectFromSharedTrack, getRecruitUrlFromSketch } from '../../utils/songSketchDna';
import './MusicShareDetail.css';

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}만`;
  }

  return value.toLocaleString('ko-KR');
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function sanitizeFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
  return normalized || `track-${Date.now()}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function MusicShareDetail() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useComposerLibraryStore((state) => state.projects);
  const deleteTrack = useMusicShareStore((state) => state.deleteTrack);
  const favoriteTrackIdsByUser = useComposerLibraryStore((state) => state.favoriteTrackIdsByUser);
  const toggleFavoriteTrack = useComposerLibraryStore((state) => state.toggleFavoriteTrack);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const likedTrackIdsByUser = useMusicShareStore((state) => state.likedTrackIdsByUser);
  const serverTracks = useMusicShareStore((state) => state.tracks);
  const trackMetricsById = useMusicShareStore((state) => state.trackMetricsById);
  const trackComments = useMusicShareStore((state) => state.comments);
  const toggleTrackLike = useMusicShareStore((state) => state.toggleTrackLike);
  const addTrackComment = useMusicShareStore((state) => state.addTrackComment);
  const recordTrackView = useMusicShareStore((state) => state.recordTrackView);
  const recordTrackDownload = useMusicShareStore((state) => state.recordTrackDownload);
  const recordTrackOpen = useMusicShareStore((state) => state.recordTrackOpen);
  const seedMusicShare = useMusicShareStore((state) => state.seedMusicShare);
  const loadProject = useSongStore((state) => state.loadProject);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [commentInput, setCommentInput] = useState('');
  const [feedbackBar, setFeedbackBar] = useState('1');

  // 여기서 seedLibrary와 seedMusicShare가 사용됩니다. (에러 방지)
  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
    void seedMusicShare().catch((error) => {
      console.error(error);
    });
  }, [seedLibrary, seedMusicShare]);

  const trackLibrary = useMemo(
    () => [
      ...BASE_SHARED_TRACK_LIBRARY,
      ...projects
        .filter((project) => project && typeof project === 'object')
        .map((project) => buildSharedTrackCard(project))
        .filter((track): track is MusicShareTrackCard => Boolean(track)),
      ...serverTracks,
    ],
    [projects, serverTracks]
  );

  const track = trackLibrary.find((item) => item.id === trackId) ?? null;
  const metrics = track ? trackMetricsById[track.id] ?? { likeCount: 0, viewCount: 0, downloadCount: 0 } : null;
  
  const comments = useMemo(
    () =>
      track
        ? trackComments
            .filter((comment) => comment.trackId === track.id)
            .sort((left, right) => right.createdAt - left.createdAt)
        : [],
    [track, trackComments]
  );
  
  const liked = !!user && !!track && (likedTrackIdsByUser[user.email] ?? []).includes(track.id);
  const saved = !!user && !!track && (favoriteTrackIdsByUser[user.email] ?? []).includes(track.id);
  const trackProject = useMemo(() => {
    if (!track) return null;
    return projects.find((item) => item.id === track.projectId)?.project ?? track.project ?? null;
  }, [projects, track]);
  const trackDna = useMemo(() => {
    if (!track) return null;
    return analyzeSongSketchDna(getProjectFromSharedTrack(track, trackProject ?? undefined), track.title);
  }, [track, trackProject]);

  // 🌟 무한 루프 방지용 코드 (순서가 중요합니다! 반드시 track이 정의된 아래에 있어야 합니다)
  const currentTrackId = track?.id;
  const currentUserEmail = user?.email;

  useEffect(() => {
    if (!currentTrackId) {
      return;
    }

    void recordTrackView(currentTrackId, currentUserEmail);
    if (currentUserEmail) {
      void recordTrackOpen(currentTrackId, currentUserEmail);
    }
  }, [recordTrackOpen, recordTrackView, currentTrackId, currentUserEmail]);

  if (!track || !metrics) {
    return (
      <div className="music-share-detail-page">
        <SiteHeader activeSection="community" />
        <main className="music-share-detail-shell">
          <section className="music-share-detail-empty">
            <strong>선택한 공유곡을 찾을 수 없습니다.</strong>
            <button type="button" onClick={() => navigate('/community/music')}>
              음악 공유로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  const handleRequireLogin = () => {
    navigate('/login');
  };

  const handleToggleLike = async () => {
    if (!user) {
      handleRequireLogin();
      return;
    }

    await toggleTrackLike(track.id, user.email);
    pushNotification({
      kind: 'music',
      title: liked ? '공유곡 좋아요 취소' : '공유곡 좋아요',
      body: `"${track.title}" 곡을 ${liked ? '좋아요에서 뺐습니다.' : '좋아요했습니다.'}`,
      route: `/community/music/${track.id}`,
      actorName: user.name,
    });
  };

  const handleToggleSave = async () => {
    if (!user) {
      handleRequireLogin();
      return;
    }

    await toggleFavoriteTrack(track.id, user.email);
  };

  const handleDownload = async () => {
    await recordTrackDownload(track.id, user?.email);

    if (track.projectId) {
      const project = projects.find((item) => item.id === track.projectId);
      if (project) {
        downloadBlob(
          new Blob([JSON.stringify(project.project, null, 2)], { type: 'application/json' }),
          `${sanitizeFileName(track.title)}.json`
        );
      }
    } else {
      downloadBlob(
        new Blob(
          [
            `Title: ${track.title}\n`,
            `Progression: ${track.progression}\n`,
            `Reference: ${track.reference}\n`,
            `Creator: ${track.creatorName}\n`,
          ],
          { type: 'text/plain;charset=utf-8' }
        ),
        `${sanitizeFileName(track.title)}.txt`
      );
    }
  };

  const handleOpenComposer = () => {
    loadProject(getProjectFromSharedTrack(track, trackProject ?? undefined));
    navigate('/composer?source=shared-track');
  };

  const handleRecruitFromTrack = () => {
    navigate(getRecruitUrlFromSketch(track.title, track.category, 'vocal,guitar,drums,bass'));
  };

const isOwner = user && track && user.name === track.creatorName;

const handleDeleteTrack = async () => {
  // 🌟 [에러 2 해결] user나 track 데이터가 없으면 아예 함수 실행을 막습니다.
  if (!user || !track) {
    return;
  }

  // 사용자에게 삭제 확인받기
  if (!window.confirm('정말로 이 공유곡을 삭제하시겠습니까? \n삭제된 곡은 복구할 수 없습니다.')) {
    return;
  }

  try {
    // 삭제 실행
    await deleteTrack(track.id);
    
    // 알림 띄우기
    pushNotification({
      kind: 'music',
      title: '삭제 완료',
      body: `"${track.title}" 곡이 목록에서 삭제되었습니다.`,
      route: '/community/music',
      // 위에서 if (!user) return; 으로 걸러냈기 때문에 여기서 에러가 나지 않습니다!
      actorName: user.name, 
    });
    
    // 삭제 후 목록으로 이동
    navigate('/community/music', { replace: true });
    
  } catch (error) {
    console.error('글 삭제 중 오류 발생:', error);
    alert('삭제에 실패했습니다. 다시 시도해 주세요.');
  }
};

  const handleCommentSubmit = async () => {
    if (!user) {
      handleRequireLogin();
      return;
    }

    const content = commentInput.trim();
    if (!content) {
      return;
    }

    const normalizedBar = Math.max(1, Number.parseInt(feedbackBar, 10) || 1);
    await addTrackComment({
      trackId: track.id,
      authorName: user.name,
      authorEmail: user.email,
      content: `[${normalizedBar}마디] ${content}`,
    });
    setCommentInput('');
  };

  
  return (
    <div className="music-share-detail-page">
      <SiteHeader activeSection="community" />

      <main className="music-share-detail-shell">
        <section className="music-share-detail-hero" style={{ backgroundImage: track.imageUrl ? `linear-gradient(180deg, rgba(10, 12, 16, 0.08), rgba(10, 12, 16, 0.4)), url(${track.imageUrl})` : track.palette }}>
          <div className="music-share-detail-overlay" />
          <div className="music-share-detail-copy">
            <span className="music-share-detail-kicker">{track.category ? track.category.toUpperCase() : 'ETC'}</span>
            <h1>{track.title}</h1>
            <p>{track.reference}</p>
            <div className="music-share-detail-meta">
              <span>{track.creatorName}</span>
              <span>{formatDate(track.createdAt)}</span>
              <span>{track.progression}</span>
            </div>
            <TrackWaveform
              className="music-share-detail-waveform"
              project={track.project}
              seed={track.id}
              bars={58}
            />
          </div>
        </section>

        <section className="music-share-detail-layout">
          <article className="music-share-detail-panel">
            <div className="music-share-detail-panel-head">
              <strong>곡 정보</strong>
              <span>진행과 레퍼런스를 기준으로 바로 열어볼 수 있습니다.</span>
            </div>

            <div className="music-share-detail-info-grid">
              <div className="music-share-detail-info-card">
                <span>조회수</span>
                <strong>{formatCount(metrics.viewCount)}</strong>
              </div>
              <div className="music-share-detail-info-card">
                <span>좋아요</span>
                <strong>{formatCount(metrics.likeCount)}</strong>
              </div>
              <div className="music-share-detail-info-card">
                <span>댓글</span>
                <strong>{formatCount(comments.length)}</strong>
              </div>
              <div className="music-share-detail-info-card">
                <span>다운로드</span>
                <strong>{formatCount(metrics.downloadCount)}</strong>
              </div>
            </div>

            <div className="music-share-detail-tags">
              {track.tags?.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>

            {trackDna ? (
              <div className="music-share-detail-dna">
                <div>
                  <span>SONG DNA</span>
                  <strong>{trackDna.summary}</strong>
                </div>
                <ul>
                  <li><b>Mood</b><em>{trackDna.mood}</em></li>
                  <li><b>Melody</b><em>{trackDna.melodyType}</em></li>
                  <li><b>Use</b><em>{trackDna.useCase}</em></li>
                </ul>
              </div>
            ) : null}

            <div className="music-share-detail-actions">
              <button
                type="button"
                className={`music-share-detail-button${liked ? ' is-active' : ''}`}
                onClick={handleToggleLike}
              >
                {liked ? '좋아요 취소' : '좋아요'}
              </button>
              <button
                type="button"
                className={`music-share-detail-button${saved ? ' is-active' : ''}`}
                onClick={handleToggleSave}
              >
                {saved ? '저장 해제' : '곡 저장'}
              </button>
              <button
                type="button"
                className="music-share-detail-button"
                onClick={handleDownload}
              >
                다운로드
              </button>
              <button
                type="button"
                className="music-share-detail-button is-primary"
                onClick={handleOpenComposer}
              >
                작곡 화면에서 열기
              </button>
              <button
                type="button"
                className="music-share-detail-button"
                onClick={handleRecruitFromTrack}
              >
                파트 모집 연결
              </button>
            </div>
          </article>

          <article className="music-share-detail-panel">
            <div className="music-share-detail-panel-head">
              <strong>댓글</strong>
              <span>{comments.length}개의 반응이 이어지고 있습니다.</span>
            </div>

            <div className="music-share-detail-comment-form">
              <label className="music-share-detail-bar-field">
                <span>피드백 마디</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={feedbackBar}
                  onChange={(event) => setFeedbackBar(event.target.value)}
                />
              </label>
              <textarea
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="선택한 마디에 대한 피드백을 남겨보세요"
              />
              <button type="button" onClick={handleCommentSubmit}>
                댓글 등록
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="music-share-detail-button"
                  onClick={handleDeleteTrack}
                  style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} // 빨간색으로 위험(삭제) 버튼임을 강조
                >
                  삭제하기
                </button>
                )}
            </div>

            <div className="music-share-detail-comment-list">
              {comments.length ? (
                comments.map((comment) => (
                  <article key={comment.id} className="music-share-detail-comment-card">
                    <div className="music-share-detail-comment-meta">
                      <strong>{comment.authorName}</strong>
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                    <p>{comment.content}</p>
                  </article>
                ))
              ) : (
                <div className="music-share-detail-comment-empty">
                  아직 댓글이 없습니다.
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
