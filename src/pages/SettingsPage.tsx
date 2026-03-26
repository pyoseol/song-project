import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  DEFAULT_USER_SETTINGS,
  getUserSettings,
  type UserSettings,
  useSettingsStore,
} from '../store/settingsStore';
import { updateUserProfileOnServer } from '../utils/profileApi';
import './SettingsPage.css';

type SettingToggleKey = keyof Pick<
  UserSettings,
  | 'communityNotifications'
  | 'musicNotifications'
  | 'shortsNotifications'
  | 'collabNotifications'
  | 'profilePublic'
  | 'showActivity'
>;

const NOTIFICATION_SETTING_ITEMS: Array<{
  key: SettingToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: 'communityNotifications',
    title: '커뮤니티 알림',
    description: '댓글, 좋아요, 게시글 반응을 바로 확인할 수 있어요.',
  },
  {
    key: 'musicNotifications',
    title: '음악 공유 알림',
    description: '공유한 곡의 좋아요, 댓글, 다운로드 반응을 빠르게 받아볼 수 있어요.',
  },
  {
    key: 'shortsNotifications',
    title: '숏폼 알림',
    description: '좋아요, 댓글, 업로드 반응을 바로 확인할 수 있어요.',
  },
  {
    key: 'collabNotifications',
    title: '협업 알림',
    description: '협업방 메시지와 상태 변경을 실시간 흐름에 가깝게 확인할 수 있어요.',
  },
];

const PRIVACY_SETTING_ITEMS: Array<{
  key: SettingToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: 'profilePublic',
    title: '프로필 공개',
    description: '다른 사용자가 내 공개 프로필과 업로드한 작업을 볼 수 있어요.',
  },
  {
    key: 'showActivity',
    title: '활동 기록 공개',
    description: '좋아요, 최근 작업, 저장한 곡 같은 활동을 프로필에 노출할 수 있어요.',
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const settingsByEmail = useSettingsStore((state) => state.settingsByEmail);
  const ensureSettings = useSettingsStore((state) => state.ensureSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const [displayName, setDisplayName] = useState(() => user?.name ?? '');
  const [draftSettings, setDraftSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.name ?? '');
  }, [user?.name]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setIsLoading(true);

      try {
        const nextSettings = await ensureSettings(user.email);
        if (!cancelled) {
          setDraftSettings(nextSettings ?? getUserSettings(settingsByEmail, user.email));
          setFeedbackMessage('');
        }
      } catch (error) {
        if (!cancelled) {
          setFeedbackMessage(
            error instanceof Error ? error.message : '설정을 불러오지 못했습니다.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [ensureSettings, settingsByEmail, user]);

  const handleToggle = (key: SettingToggleKey) => {
    setDraftSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSave = async () => {
    if (!user || isSaving) {
      if (!user) {
        navigate('/login');
      }
      return;
    }

    const nextName = displayName.trim();
    if (!nextName) {
      setFeedbackMessage('닉네임을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setFeedbackMessage('');

    try {
      const [profileResponse, settingsResponse] = await Promise.all([
        updateUserProfileOnServer({
          email: user.email,
          name: nextName,
        }),
        updateSettings(user.email, draftSettings),
      ]);

      updateProfile({
        email: profileResponse.user.email,
        name: profileResponse.user.name,
      });
      setDraftSettings(settingsResponse);
      setFeedbackMessage('설정이 서버에 저장되었습니다.');
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="settings-page">
        <SiteHeader />
        <main className="settings-shell">
          <section className="settings-empty-card">
            <strong>설정 페이지는 로그인 후 사용할 수 있습니다.</strong>
            <button type="button" onClick={() => navigate('/login')}>
              로그인하러 가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <SiteHeader />

      <main className="settings-shell">
        <section className="settings-hero">
          <div>
            <span className="settings-kicker">SETTINGS</span>
            <h1>내 계정과 알림 설정</h1>
            <p>닉네임, 알림, 공개 범위를 서버에 저장하고 다음 로그인에도 그대로 이어집니다.</p>
          </div>

          <div className="settings-hero-actions">
            <button
              type="button"
              className="settings-outline-button"
              onClick={() => navigate('/profile')}
            >
              프로필 보기
            </button>
            <button
              type="button"
              className="settings-primary-button"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </section>

        <section className="settings-grid">
          <article className="settings-card">
            <div className="settings-section-head">
              <strong>계정 정보</strong>
              <span>프로필 기본 정보를 관리할 수 있어요.</span>
            </div>

            <div className="settings-account-row">
              <div className="settings-account-avatar" aria-hidden="true">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="settings-account-avatar-image" />
                ) : (
                  <span>{user.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="settings-account-copy">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <button
                  type="button"
                  className="settings-inline-link"
                  onClick={() => navigate('/profile')}
                >
                  프로필 이미지 변경
                </button>
              </div>
            </div>

            <label className="settings-field">
              <span>닉네임</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="닉네임을 입력해주세요"
              />
            </label>

            <label className="settings-field">
              <span>이메일</span>
              <input type="email" value={user.email} disabled />
            </label>
          </article>

          <article className="settings-card">
            <div className="settings-section-head">
              <strong>알림 설정</strong>
              <span>받고 싶은 반응만 골라서 켤 수 있어요.</span>
            </div>

            <div className="settings-toggle-list">
              {NOTIFICATION_SETTING_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="settings-toggle-card"
                  onClick={() => handleToggle(item.key)}
                >
                  <div className="settings-toggle-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <span className={`settings-switch${draftSettings[item.key] ? ' is-on' : ''}`}>
                    <span />
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="settings-card">
            <div className="settings-section-head">
              <strong>공개 범위</strong>
              <span>프로필과 활동 공개 범위를 정할 수 있어요.</span>
            </div>

            <div className="settings-toggle-list">
              {PRIVACY_SETTING_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="settings-toggle-card"
                  onClick={() => handleToggle(item.key)}
                >
                  <div className="settings-toggle-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <span className={`settings-switch${draftSettings[item.key] ? ' is-on' : ''}`}>
                    <span />
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="settings-card">
            <div className="settings-section-head">
              <strong>빠른 이동</strong>
              <span>자주 쓰는 페이지로 바로 이동할 수 있어요.</span>
            </div>

            <div className="settings-shortcut-grid">
              <button
                type="button"
                className="settings-shortcut-card"
                onClick={() => navigate('/messages')}
              >
                <strong>메시지함</strong>
                <span>친구와 그룹 채팅을 확인하고 새 대화를 시작할 수 있어요.</span>
              </button>
              <button
                type="button"
                className="settings-shortcut-card"
                onClick={() => navigate('/community/shorts')}
              >
                <strong>숏폼 관리</strong>
                <span>내가 올린 숏폼과 좋아요한 숏폼을 빠르게 확인할 수 있어요.</span>
              </button>
              <button
                type="button"
                className="settings-shortcut-card"
                onClick={() => navigate('/collab')}
              >
                <strong>협업 프로젝트</strong>
                <span>진행 중인 협업방과 최근 코멘트를 한 번에 확인할 수 있어요.</span>
              </button>
            </div>
          </article>
        </section>

        {isLoading ? <p className="settings-feedback">설정을 불러오는 중...</p> : null}
        {feedbackMessage ? <p className="settings-feedback">{feedbackMessage}</p> : null}
      </main>
    </div>
  );
}
