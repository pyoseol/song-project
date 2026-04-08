import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import {
  BASE_SHARED_TRACK_LIBRARY,
  buildSharedTrackCard,
} from '../dummy/musicShareLibrary';
import { LESSON_LIBRARY } from '../dummy/learnData';
import { useAuthStore } from '../store/authStore';
import { useCommunityStore } from '../store/communityStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import { useLearnProgressStore } from '../store/learnProgressStore';
import { useMusicShareStore } from '../store/musicShareStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSongStore } from '../store/songStore';
import { useShortsStore } from '../store/shortsStore';
import { SHORT_TONE_BACKGROUNDS } from '../types/shorts';
import { fetchUserProfile, updateUserAvatarOnServer } from '../utils/profileApi';
import { readShortVideoFile } from '../utils/shortsVideoStorage';
import './ProfilePage.css';

type ProfileTab = 'music' | 'community' | 'shorts' | 'activity';

const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);


const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
  { key: 'music', label: '음악' },
  { key: 'community', label: '커뮤니티 글' },
  { key: 'shorts', label: '숏폼' },
  { key: 'activity', label: '활동' },
];

function formatCount(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR');
}

function getExcerpt(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 96) {
    return normalized;
  }

  return `${normalized.slice(0, 96)}...`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const clearAvatar = useAuthStore((state) => state.clearAvatar);
  const posts = useCommunityStore((state) => state.posts);
  const likedPostIdsByUser = useCommunityStore((state) => state.likedPostIdsByUser);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const projects = useComposerLibraryStore((state) => state.projects);
  const favoriteTrackIdsByUser = useComposerLibraryStore((state) => state.favoriteTrackIdsByUser);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const shorts = useShortsStore((state) => state.shorts);
  const seedShorts = useShortsStore((state) => state.seedShorts);
  const completedByUser = useLearnProgressStore((state) => state.completedByUser);
  const favoriteByUser = useLearnProgressStore((state) => state.favoriteByUser);
  const seedLearnProgress = useLearnProgressStore((state) => state.seedLearnProgress);
  const notifications = useNotificationStore((state) => state.notifications);
  const recentOpenedTrackIdsByUser = useMusicShareStore(
    (state) => state.recentOpenedTrackIdsByUser
  );
  const seedMusicShare = useMusicShareStore((state) => state.seedMusicShare);
  const loadProject = useSongStore((state) => state.loadProject);
  
  const [activeTab, setActiveTab] = useState<ProfileTab>('music');
  const [shortVideoUrlById, setShortVideoUrlById] = useState<Record<string, string>>({});
  const [avatarError, setAvatarError] = useState('');
  
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  
  
  // ✅ 새롭게 추가된 업로드 로딩 상태
  const [isUploading, setIsUploading] = useState(false); 
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
  if (!user?.email) return;

  let cancelled = false;

  const syncProfile = async () => {
    try {
      const response = await fetchUserProfile(user.email);

      // 🔥 추가 (핵심)
      setAvatarUrl(response.user.avatarUrl);

      updateProfile({
        email: response.user.email,
        name: response.user.name,
        avatarUrl: response.user.avatarUrl,
      });
      if (cancelled) return;

      const avatarUrl = response.user.avatarUrl ?? '';

      updateProfile({
        email: response.user.email,
        name: response.user.name,
        avatarUrl,
      });
    } catch (error) {
      console.error(error);
    }
  };

  void syncProfile();

  return () => {
    cancelled = true;
  };
}, [user?.email]); // 🔥 핵심

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
    void seedLibrary().catch((error) => {
      console.error(error);
    });
    void seedMusicShare().catch((error) => {
      console.error(error);
    });
    void seedShorts().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity, seedLibrary, seedMusicShare, seedShorts]);

  const profileKey = user?.email ?? 'guest';
  useEffect(() => {
    void seedLearnProgress(profileKey).catch((error) => {
      console.error(error);
    });
  }, [profileKey, seedLearnProgress]);
  
  const displayProfileName = user?.name ?? '게스트';
  const profileInitial = displayProfileName.slice(0, 1).toUpperCase();

  const myProjects = useMemo(
    () =>
      user
        ? projects
            .filter((project) => project.creatorEmail === user.email)
            .sort((left, right) => right.updatedAt - left.updatedAt)
        : [],
    [projects, user]
  );

  const sharedTracks = useMemo(
    () =>
      myProjects
        .map((project) => buildSharedTrackCard(project))
        .filter((track): track is NonNullable<typeof track> => Boolean(track)),
    [myProjects]
  );

  const likedPosts = useMemo(() => {
    if (!user) {
      return [];
    }

    const likedIds = likedPostIdsByUser[user.email] ?? [];
    return posts.filter((post) => likedIds.includes(post.id));
  }, [likedPostIdsByUser, posts, user]);

  const savedTracks = useMemo(() => {
    if (!user) {
      return [];
    }

    const favoriteIds = favoriteTrackIdsByUser[user.email] ?? [];
    const dynamicTracks = projects
      .map((project) => buildSharedTrackCard(project))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));

    return [...dynamicTracks, ...BASE_SHARED_TRACK_LIBRARY].filter((track) =>
      favoriteIds.includes(track.id)
    );
  }, [favoriteTrackIdsByUser, projects, user]);

  const myShorts = useMemo(
    () =>
      user
        ? shorts
            .filter((short) => short.creatorEmail === user.email)
            .sort((left, right) => right.createdAt - left.createdAt)
        : [],
    [shorts, user]
  );

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    const loadShortVideos = async () => {
      const entries = await Promise.all(
        myShorts.map(async (short) => {
          if (short.videoUrl) {
            return [short.id, short.videoUrl] as const;
          }

          if (short.videoStorageKey) {
            try {
              const blob = await readShortVideoFile(short.videoStorageKey);

              if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                objectUrls.push(objectUrl);
                return [short.id, objectUrl] as const;
              }
            } catch (error) {
              console.error(error);
            }
          }

          return null;
        })
      );

      if (cancelled) {
        objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
        return;
      }

      setShortVideoUrlById(
        Object.fromEntries(
          entries.filter(
            (entry): entry is readonly [string, string] => Boolean(entry?.[0] && entry[1])
          )
        )
      );
    };

    void loadShortVideos();

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [myShorts]);

  const completedLessons = completedByUser[profileKey] ?? [];
  const favoriteLessons = favoriteByUser[profileKey] ?? [];
  const favoriteLessonCards = favoriteLessons.map((lessonId) => LESSON_LIBRARY[lessonId]);
  const unreadNotifications = notifications.filter((notification) => !notification.isRead);

  const recentTrackLibrary = useMemo(() => {
    const dynamicTracks = projects
      .map((project) => buildSharedTrackCard(project))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));

    return [...dynamicTracks, ...BASE_SHARED_TRACK_LIBRARY];
  }, [projects]);

  const recentOpenedTracks = useMemo(() => {
    if (!user) {
      return [];
    }

    const ids = recentOpenedTrackIdsByUser[user.email] ?? [];
    return ids
      .map((trackId) => recentTrackLibrary.find((track) => track.id === trackId))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
  }, [recentOpenedTrackIdsByUser, recentTrackLibrary, user]);

  const tabCounts: Record<ProfileTab, number> = {
    music: myProjects.length,
    community: likedPosts.length || posts.slice(0, 3).length,
    shorts: myShorts.length,
    activity:
      savedTracks.length +
      likedPosts.length +
      Math.min(myProjects.length, 4) +
      favoriteLessonCards.length,
  };

  const handleOpenProject = (project: (typeof myProjects)[number]) => {
    loadProject(project.project);
    navigate('/composer');
  };

  const handlePickAvatar = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user) {
      return;
    }

    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setAvatarError('JPG, PNG, WEBP 이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarError('프로필 이미지는 2MB 이하 파일만 사용할 수 있습니다.');
      return;
    }

    try {
      setIsUploading(true); // ✅ 업로드 시작 (버튼 비활성화)
      
      
      
      
      
      setAvatarError('');
    } catch (error) {
      console.error(error);
      setAvatarError('프로필 이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsUploading(false); // ✅ 업로드 종료 (성공하든 실패하든 버튼 활성화)
    }
  };

  // ✅ 프로필 이미지 초기화 로직 (로딩 상태 복구)
  const handleClearAvatar = async () => {
    if (!user) {
      return;
    }

    try {
      setIsUploading(true); // ✅ 초기화 시작
      await updateUserAvatarOnServer({
        email: user.email,
        avatarUrl: null,
      });

      setAvatarUrl(undefined);
      clearAvatar(user.email);
      setAvatarError('');
    } catch (error) {
      console.error(error);
      setAvatarError('프로필 이미지를 초기화하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsUploading(false); // ✅ 초기화 종료
    }
  };

  return (
    <div className="profile-page">
      <SiteHeader />

      <main className="profile-shell">
        <section className="profile-hero">
          <div className="profile-summary">
            <div className="profile-avatar-shell">
              <div className="profile-avatar" aria-hidden="true">
                {avatarUrl ? (
                  <img
                    src={`${avatarUrl}?t=${Date.now()}`}
                    alt=""
                    className="profile-avatar-image"
                  />
                ) : (
                  <span className="profile-avatar-fallback">{profileInitial}</span>
                )}
              </div>

              {user ? (
                <div className="profile-avatar-actions">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="profile-avatar-input"
                    onChange={handleAvatarChange}
                    disabled={isUploading} // 인풋도 막아줌
                  />
                  <div className="profile-avatar-button-row">
                    <button 
                      type="button" 
                      className="profile-avatar-button" 
                      onClick={handlePickAvatar}
                      disabled={isUploading} // ✅ 로딩 상태 반영
                    >
                      {isUploading ? '업로드 중...' : '이미지 변경'}
                    </button>
                    {user.avatarUrl ? (
                      <button
                        type="button"
                        className="profile-avatar-button is-secondary"
                        onClick={handleClearAvatar}
                        disabled={isUploading} // ✅ 로딩 상태 반영
                      >
                        기본 이미지
                      </button>
                    ) : null}
                  </div>
                  <span className="profile-avatar-hint">PNG, JPG, WEBP · 최대 2MB</span>
                  {avatarError ? <p className="profile-avatar-error">{avatarError}</p> : null}
                </div>
              ) : null}
            </div>

            <div className="profile-meta">
              <h1>{displayProfileName}</h1>
              <div className="profile-meta-row">
                <span>프로젝트 {formatCount(myProjects.length)}개</span>
                <span>저장한 곡 {formatCount(savedTracks.length)}개</span>
                <span>숏폼 {formatCount(myShorts.length)}개</span>
              </div>
              <p>최근 작업과 저장한 음악을 한 번에 볼 수 있는 내 작업 공간입니다.</p>
            </div>
          </div>

          <button
            type="button"
            className="profile-message-button"
            aria-label="메시지함"
            onClick={() => navigate('/messages')}
          >
            작곡하러 가기
          </button>
        </section>

        <section className="profile-overview-grid">
          <article className="profile-overview-card">
            <span>공유한 곡</span>
            <strong>{formatCount(sharedTracks.length)}</strong>
            <small>음악공유에 올라간 내 프로젝트</small>
          </article>
          <article className="profile-overview-card">
            <span>완료한 레슨</span>
            <strong>{formatCount(completedLessons.length)}</strong>
            <small>작곡 가이드 진행도</small>
          </article>
          <article className="profile-overview-card">
            <span>안읽은 알림</span>
            <strong>{formatCount(unreadNotifications.length)}</strong>
            <small>커뮤니티, 숏폼, 공유곡 반응</small>
          </article>
          <article className="profile-overview-card">
            <span>최근 본 공유곡</span>
            <strong>{formatCount(recentOpenedTracks.length)}</strong>
            <small>다시 열어본 음악공유 기록</small>
          </article>
        </section>

        <section className="profile-content">
          <div className="profile-tab-row" role="tablist" aria-label="프로필 탭">
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === tab.key ? ' is-active' : ''}`}
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label} ({tabCounts[tab.key]})
              </button>
            ))}
          </div>

          {activeTab === 'music' ? (
            <div className="profile-project-section">
              <div className="profile-section-heading">
                <strong>내 프로젝트</strong>
                <button type="button" onClick={() => navigate('/composer')}>
                  새 프로젝트 만들기
                </button>
              </div>

              {myProjects.length ? (
                <div className="profile-music-grid">
                  {myProjects.slice(0, 6).map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className="profile-track-card"
                      onClick={() => handleOpenProject(project)}
                    >
                      <div
                        className="profile-track-cover"
                        style={{
                          background:
                            'radial-gradient(circle at 50% 24%, rgba(255,255,255,0.12), transparent 28%), linear-gradient(160deg, #55585f 0%, #27292d 100%)',
                        }}
                        aria-hidden="true"
                      >
                        <span />
                      </div>
                      <div className="profile-track-body">
                        <strong>
                          {project.steps} steps · {project.bpm} BPM
                        </strong>
                        <p>{project.title}</p>
                        <div className="profile-track-footer">
                          <span>{project.genre}</span>
                          <span>{project.isShared ? '공유됨' : '개인 보관'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="profile-short-empty">
                  <strong>아직 저장한 프로젝트가 없습니다.</strong>
                  <button type="button" onClick={() => navigate('/composer')}>
                    첫 프로젝트 만들기
                  </button>
                </div>
              )}

              {sharedTracks.length ? (
                <section className="profile-subsection">
                  <div className="profile-section-heading">
                    <strong>공유한 음악</strong>
                  </div>
                  <div className="profile-mini-grid">
                    {sharedTracks.slice(0, 4).map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        className="profile-mini-card"
                        onClick={() => navigate('/community/music')}
                      >
                        <strong>{track.title}</strong>
                        <span>{track.progression}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {recentOpenedTracks.length ? (
                <section className="profile-subsection">
                  <div className="profile-section-heading">
                    <strong>최근 본 공유곡</strong>
                  </div>
                  <div className="profile-mini-grid">
                    {recentOpenedTracks.slice(0, 4).map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        className="profile-mini-card"
                        onClick={() => navigate('/community/music')}
                      >
                        <strong>{track.title}</strong>
                        <span>{track.reference}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'community' ? (
            <div className="profile-post-list">
              {(likedPosts.length ? likedPosts : posts.slice(0, 3)).map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="profile-post-card"
                  onClick={() => navigate(`/community/${post.id}`)}
                >
                  <strong>{post.title}</strong>
                  <p>{getExcerpt(post.content)}</p>
                  <div className="profile-post-footer">
                    <span>{formatDate(post.createdAt)}</span>
                    <div className="profile-post-stats">
                      <span>좋아요 {formatCount(post.likeCount)}</span>
                      <span>댓글 {formatCount(post.commentCount ?? 0)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === 'shorts' ? (
            myShorts.length ? (
              <div className="profile-short-grid">
                {myShorts.map((short) => (
                  <button
                    key={short.id}
                    type="button"
                    className="profile-short-card"
                    onClick={() => navigate('/community/shorts')}
                  >
                    <div
                      className="profile-short-media"
                      style={{ backgroundImage: SHORT_TONE_BACKGROUNDS[short.tone] }}
                    >
                      {shortVideoUrlById[short.id] ?? short.videoUrl ? (
                        <video
                          className="profile-short-video"
                          src={shortVideoUrlById[short.id] ?? short.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <span>{short.durationLabel}</span>
                      )}
                    </div>
                    <div className="profile-short-body">
                      <strong>{short.title}</strong>
                      <p>{short.description}</p>
                      <div className="profile-short-footer">
                        <span>{short.durationLabel}</span>
                        <span>{short.visibility === 'public' ? '공개' : '비공개'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="profile-short-empty">
                <strong>아직 올린 숏폼이 없습니다.</strong>
                <button type="button" onClick={() => navigate('/community/shorts')}>
                  숏폼 보러 가기
                </button>
              </div>
            )
          ) : null}

          {activeTab === 'activity' ? (
            <div className="profile-activity-layout">
              <section className="profile-activity-card">
                <div className="profile-section-heading">
                  <strong>저장한 곡</strong>
                </div>
                {savedTracks.length ? (
                  <div className="profile-mini-grid">
                    {savedTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        className="profile-mini-card"
                        onClick={() => navigate('/community/music')}
                      >
                        <strong>{track.title}</strong>
                        <span>{track.reference}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="profile-mini-empty">아직 저장한 곡이 없습니다.</div>
                )}
              </section>

              <section className="profile-activity-card">
                <div className="profile-section-heading">
                  <strong>좋아요한 글</strong>
                </div>
                {likedPosts.length ? (
                  <div className="profile-mini-list">
                    {likedPosts.slice(0, 4).map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        className="profile-mini-list-item"
                        onClick={() => navigate(`/community/${post.id}`)}
                      >
                        <strong>{post.title}</strong>
                        <span>좋아요 {formatCount(post.likeCount)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="profile-mini-empty">아직 좋아요한 글이 없습니다.</div>
                )}
              </section>

              <section className="profile-activity-card">
                <div className="profile-section-heading">
                  <strong>최근 작업 프로젝트</strong>
                </div>
                {myProjects.length ? (
                  <div className="profile-mini-list">
                    {myProjects.slice(0, 4).map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className="profile-mini-list-item"
                        onClick={() => handleOpenProject(project)}
                      >
                        <strong>{project.title}</strong>
                        <span>{formatDate(project.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="profile-mini-empty">최근 작업 기록이 없습니다.</div>
                )}
              </section>

              <section className="profile-activity-card">
                <div className="profile-section-heading">
                  <strong>즐겨찾기 가이드</strong>
                </div>
                {favoriteLessonCards.length ? (
                  <div className="profile-mini-list">
                    {favoriteLessonCards.slice(0, 4).map((lesson) => (
                      <button
                        key={lesson.id}
                        type="button"
                        className="profile-mini-list-item"
                        onClick={() => navigate('/composer')}
                      >
                        <strong>{lesson.label}</strong>
                        <span>{lesson.section}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="profile-mini-empty">즐겨찾기한 레슨이 없습니다.</div>
                )}
              </section>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}