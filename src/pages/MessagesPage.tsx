import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  SUGGESTED_FRIENDS,
  type FriendProfile,
  useFriendStore,
} from '../store/friendStore';
import { useMessageStore } from '../store/messageStore';
import './MessagesPage.css';

type MessagesSection = 'messages' | 'friends';

function formatMessageTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const hour = 1000 * 60 * 60;
  const day = hour * 24;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / (1000 * 60)))}분 전`;
  }

  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))}시간 전`;
  }

  return `${Math.max(1, Math.floor(diff / day))}일 전`;
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const threads = useMessageStore((state) => state.threads);
  const messagesByThread = useMessageStore((state) => state.messagesByThread);
  const inboxStatus = useMessageStore((state) => state.inboxStatus);
  const inboxError = useMessageStore((state) => state.inboxError);
  const seedInbox = useMessageStore((state) => state.seedInbox);
  const addFriend = useMessageStore((state) => state.addFriend);
  const removeFriend = useMessageStore((state) => state.removeFriend);
  const createThread = useMessageStore((state) => state.createThread);
  const createGroupThread = useMessageStore((state) => state.createGroupThread);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const markThreadRead = useMessageStore((state) => state.markThreadRead);
  const friendsByEmail = useFriendStore((state) => state.friendsByEmail);

  const [activeSection, setActiveSection] = useState<MessagesSection>('messages');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [friendNameDraft, setFriendNameDraft] = useState('');
  const [friendEmailDraft, setFriendEmailDraft] = useState('');
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [selectedGroupMemberEmails, setSelectedGroupMemberEmails] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    void seedInbox({
      ownerEmail: user.email,
      ownerName: user.name,
    });
  }, [seedInbox, user]);

  const myFriends = useMemo(() => {
    if (!user) {
      return [];
    }

    return friendsByEmail[user.email] ?? [];
  }, [friendsByEmail, user]);

  const suggestedFriends = useMemo(() => {
    if (!user) {
      return [];
    }

    return SUGGESTED_FRIENDS.filter(
      (friend) =>
        friend.email !== user.email &&
        !myFriends.some((savedFriend) => savedFriend.email === friend.email)
    );
  }, [myFriends, user]);

  const myThreads = useMemo(() => {
    if (!user) {
      return [];
    }

    return [...threads]
      .filter((thread) => thread.ownerEmail === user.email)
      .sort((left, right) => right.lastMessageAt - left.lastMessageAt);
  }, [threads, user]);

  const filteredThreads = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return myThreads;
    }

    return myThreads.filter((thread) => {
      const memberNames = thread.members.map((member) => member.name).join(' ');
      const target = `${thread.title} ${thread.lastPreview} ${memberNames}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [myThreads, searchQuery]);

  const activeThreadId =
    selectedThreadId && filteredThreads.some((thread) => thread.id === selectedThreadId)
      ? selectedThreadId
      : filteredThreads[0]?.id ?? null;
  const activeThread =
    filteredThreads.find((thread) => thread.id === activeThreadId) ?? filteredThreads[0] ?? null;
  const activeMessages = activeThread ? messagesByThread[activeThread.id] ?? [] : [];

  const unreadCountByThread = useMemo(() => {
    if (!user) {
      return {};
    }

    return Object.fromEntries(
      myThreads.map((thread) => [
        thread.id,
        (messagesByThread[thread.id] ?? []).filter(
          (message) => message.authorEmail !== user.email && !message.isRead
        ).length,
      ])
    );
  }, [messagesByThread, myThreads, user]);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadCountByThread).reduce((sum, count) => sum + count, 0),
    [unreadCountByThread]
  );

  useEffect(() => {
    if (!user || !activeThread) {
      return;
    }

    const hasUnreadMessages = (messagesByThread[activeThread.id] ?? []).some(
      (message) => message.authorEmail !== user.email && !message.isRead
    );

    if (!hasUnreadMessages) {
      return;
    }

    void markThreadRead({
      threadId: activeThread.id,
      readerEmail: user.email,
    });
  }, [activeThread, markThreadRead, messagesByThread, user]);

  const handleStartDirectMessage = async (friend: FriendProfile) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const existingThread = myThreads.find(
      (thread) => thread.type === 'direct' && thread.participantEmail === friend.email
    );

    setActiveSection('messages');

    if (existingThread) {
      setSelectedThreadId(existingThread.id);
      return;
    }

    try {
      const threadId = await createThread({
        ownerEmail: user.email,
        ownerName: user.name,
        participantName: friend.name,
        participantEmail: friend.email,
      });
      setSelectedThreadId(threadId);
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '대화를 시작하지 못했습니다.');
    }
  };

  const handleAddFriend = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextName = friendNameDraft.trim();
    const nextEmail = friendEmailDraft.trim().toLowerCase();

    if (!nextName || !nextEmail) {
      setFormError('친구 이름과 이메일을 모두 입력해주세요.');
      return;
    }

    try {
      await addFriend({
        ownerEmail: user.email,
        ownerName: user.name,
        friendName: nextName,
        friendEmail: nextEmail,
      });
      setFriendNameDraft('');
      setFriendEmailDraft('');
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '친구를 추가하지 못했습니다.');
    }
  };

  const handleQuickAddFriend = async (friend: FriendProfile) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await addFriend({
        ownerEmail: user.email,
        ownerName: user.name,
        friendName: friend.name,
        friendEmail: friend.email,
      });
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '친구를 추가하지 못했습니다.');
    }
  };

  const handleRemoveFriend = async (friendEmail: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await removeFriend({
        ownerEmail: user.email,
        ownerName: user.name,
        friendEmail,
      });
      setSelectedGroupMemberEmails((current) => current.filter((email) => email !== friendEmail));
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '친구를 삭제하지 못했습니다.');
    }
  };

  const handleToggleGroupMember = (email: string) => {
    setSelectedGroupMemberEmails((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email]
    );
  };

  const handleCreateGroupChat = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const title = groupNameDraft.trim();
    if (!title) {
      setFormError('그룹 채팅 이름을 입력해주세요.');
      return;
    }

    const groupMembers = myFriends.filter((friend) => selectedGroupMemberEmails.includes(friend.email));
    if (!groupMembers.length) {
      setFormError('그룹 채팅에 초대할 친구를 1명 이상 선택해주세요.');
      return;
    }

    try {
      const threadId = await createGroupThread({
        ownerEmail: user.email,
        ownerName: user.name,
        title,
        members: groupMembers,
        openingMessage: `${title} 그룹 채팅이 시작되었습니다.`,
      });

      setSelectedThreadId(threadId);
      setGroupNameDraft('');
      setSelectedGroupMemberEmails([]);
      setFormError('');
      setActiveSection('messages');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '그룹 채팅을 만들지 못했습니다.');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !activeThread) {
      return;
    }

    const content = messageDraft.trim();
    if (!content) {
      return;
    }

    try {
      await sendMessage({
        threadId: activeThread.id,
        authorName: user.name,
        authorEmail: user.email,
        content,
      });
      setMessageDraft('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '메시지를 보내지 못했습니다.');
    }
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  if (!user) {
    return (
      <div className="messages-page">
        <SiteHeader />
        <main className="messages-shell">
          <section className="messages-empty-card">
            <strong>메시지는 로그인 후 사용할 수 있습니다.</strong>
            <button type="button" onClick={() => navigate('/login')}>
              로그인하러 가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <SiteHeader />

      <main className="messages-shell">
        <section className="messages-hero">
          <div>
            <span className="messages-kicker">MESSAGES</span>
            <h1>메시지와 친구 관리를 따로 보세요</h1>
            <p>메시지 탭에서는 대화만 보고, 친구 탭에서는 친구 추가와 그룹 채팅 준비를 할 수 있어요.</p>
          </div>
        </section>

        <section className="messages-tabs" aria-label="메시지 화면 구분">
          <button
            type="button"
            className={`messages-tab-button${activeSection === 'messages' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('messages')}
          >
            메시지
            <span>{myThreads.length}</span>
          </button>
          <button
            type="button"
            className={`messages-tab-button${activeSection === 'friends' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('friends')}
          >
            친구
            <span>{myFriends.length}</span>
          </button>
        </section>

        <section className="messages-layout">
          <aside className="messages-sidebar">
            <div className="messages-sidebar-head">
              <strong>{activeSection === 'messages' ? '메시지 보관함' : '친구 관리'}</strong>
              <span>
                {activeSection === 'messages'
                  ? `읽지 않은 메시지 ${totalUnreadCount}개`
                  : `추천 친구 ${suggestedFriends.length}명`}
              </span>
            </div>

            {activeSection === 'messages' ? (
              <>
                <input
                  type="text"
                  className="messages-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="이름이나 대화 내용으로 검색해보세요."
                />

                <section className="messages-section">
                  <div className="messages-section-head">
                    <strong>대화 목록</strong>
                    <span>{filteredThreads.length}개 대화</span>
                  </div>

                  <div className="messages-thread-list">
                    {filteredThreads.map((thread) => {
                      const unreadCount = unreadCountByThread[thread.id] ?? 0;

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          className={`messages-thread-card${
                            activeThread?.id === thread.id ? ' is-active' : ''
                          }`}
                          onClick={() => setSelectedThreadId(thread.id)}
                        >
                          <div className="messages-thread-top">
                            <div className="messages-thread-copy">
                              <strong>{thread.title}</strong>
                            </div>
                            <span>{formatRelativeTime(thread.lastMessageAt)}</span>
                          </div>
                          <p>{thread.lastPreview}</p>
                          {unreadCount ? <em>{unreadCount}</em> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="messages-section">
                  <div className="messages-section-head">
                    <strong>친구 추가</strong>
                    <span>이름과 이메일을 입력해서 친구를 바로 등록할 수 있어요.</span>
                  </div>

                  <div className="messages-form-grid">
                    <input
                      type="text"
                      className="messages-input"
                      value={friendNameDraft}
                      onChange={(event) => setFriendNameDraft(event.target.value)}
                      placeholder="친구 이름"
                    />
                    <input
                      type="email"
                      className="messages-input"
                      value={friendEmailDraft}
                      onChange={(event) => setFriendEmailDraft(event.target.value)}
                      placeholder="friend@songmaker.dev"
                    />
                    <button
                      type="button"
                      className="messages-action-button"
                      onClick={() => void handleAddFriend()}
                    >
                      친구 추가
                    </button>
                  </div>

                  <div className="messages-suggested-row">
                    {suggestedFriends.map((friend) => (
                      <button
                        key={friend.email}
                        type="button"
                        className="messages-pill-button"
                        onClick={() => void handleQuickAddFriend(friend)}
                      >
                        + {friend.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="messages-section">
                  <div className="messages-section-head">
                    <strong>그룹 채팅 만들기</strong>
                    <span>친구를 선택한 뒤 그룹 채팅방을 만들 수 있어요.</span>
                  </div>

                  <input
                    type="text"
                    className="messages-input"
                    value={groupNameDraft}
                    onChange={(event) => setGroupNameDraft(event.target.value)}
                    placeholder="예: Weekend Jam Crew"
                  />

                  <div className="messages-selected-row">
                    {selectedGroupMemberEmails.length ? (
                      selectedGroupMemberEmails.map((email) => {
                        const friend = myFriends.find((item) => item.email === email);
                        return (
                          <span key={email} className="messages-selected-chip">
                            {friend?.name ?? email}
                          </span>
                        );
                      })
                    ) : (
                      <span className="messages-helper-text">
                        오른쪽 친구 목록에서 그룹에 넣을 친구를 선택해주세요.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="messages-action-button is-primary"
                    onClick={() => void handleCreateGroupChat()}
                  >
                    그룹 채팅 만들기
                  </button>
                </section>
              </>
            )}

            {inboxStatus === 'loading' ? (
              <p className="messages-feedback">메시지를 불러오는 중입니다..</p>
            ) : null}
            {inboxError ? <p className="messages-feedback is-error">{inboxError}</p> : null}
            {formError ? <p className="messages-feedback is-error">{formError}</p> : null}
          </aside>

          <section className="messages-panel">
            {activeSection === 'messages' ? (
              activeThread ? (
                <>
                  <div className="messages-panel-head">
                    <div className="messages-panel-title">
                      <strong>{activeThread.title}</strong>
                      <span>
                        {activeThread.type === 'group'
                          ? `${activeThread.members.length}명 참여 중`
                          : activeThread.participantEmail}
                      </span>
                      {activeThread.type === 'group' ? (
                        <div className="messages-member-row">
                          {activeThread.members.map((member) => (
                            <span
                              key={`${activeThread.id}-${member.email}`}
                              className="messages-member-chip"
                            >
                              {member.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="messages-head-link"
                      onClick={() => navigate('/collab')}
                    >
                      협업 페이지로 이동
                    </button>
                  </div>

                  <div className="messages-bubble-list">
                    {activeMessages.map((message) => {
                      const isMine = message.authorEmail === user.email;

                      return (
                        <article
                          key={message.id}
                          className={`messages-bubble${isMine ? ' is-mine' : ''}`}
                        >
                          <strong>{message.authorName}</strong>
                          <p>{message.content}</p>
                          <span>{formatMessageTime(message.createdAt)}</span>
                        </article>
                      );
                    })}
                  </div>

                  <div className="messages-composer">
                    <textarea
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="메시지를 입력해주세요. Enter로 바로 보낼 수 있어요."
                    />
                    <button
                      type="button"
                      className="messages-send-button"
                      onClick={() => void handleSendMessage()}
                    >
                      보내기
                    </button>
                  </div>
                </>
              ) : (
                <div className="messages-panel-empty">
                  <strong>대화를 선택하면 메시지가 여기에 표시됩니다.</strong>
                  <span>왼쪽에서 대화 목록을 고르거나 친구 탭에서 새 대화를 시작해보세요.</span>
                </div>
              )
            ) : (
              <>
                <div className="messages-panel-head">
                  <div className="messages-panel-title">
                    <strong>친구 목록</strong>
                    <span>친구를 정리하고, 1:1 대화나 그룹 채팅에 바로 연결할 수 있어요.</span>
                  </div>
                </div>

                <div className="messages-friends-overview">
                  <article className="messages-overview-card">
                    <strong>{myFriends.length}</strong>
                    <span>내 친구</span>
                  </article>
                  <article className="messages-overview-card">
                    <strong>{selectedGroupMemberEmails.length}</strong>
                    <span>그룹 선택</span>
                  </article>
                  <article className="messages-overview-card">
                    <strong>{suggestedFriends.length}</strong>
                    <span>추천 친구</span>
                  </article>
                </div>

                <div className="messages-friends-board">
                  {myFriends.length ? (
                    myFriends.map((friend) => {
                      const isSelected = selectedGroupMemberEmails.includes(friend.email);

                      return (
                        <article key={friend.email} className="messages-friend-card">
                          <div className="messages-friend-copy">
                            <strong>{friend.name}</strong>
                            <span>{friend.email}</span>
                          </div>

                          <div className="messages-friend-actions">
                            <button
                              type="button"
                              className="messages-inline-button"
                              onClick={() => void handleStartDirectMessage(friend)}
                            >
                              1:1 채팅
                            </button>
                            <button
                              type="button"
                              className={`messages-inline-button${isSelected ? ' is-selected' : ''}`}
                              onClick={() => handleToggleGroupMember(friend.email)}
                            >
                              {isSelected ? '그룹 해제' : '그룹 선택'}
                            </button>
                            <button
                              type="button"
                              className="messages-inline-button is-danger"
                              onClick={() => void handleRemoveFriend(friend.email)}
                            >
                              친구 삭제
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="messages-panel-empty">
                      <strong>아직 등록된 친구가 없습니다.</strong>
                      <span>왼쪽에서 친구를 추가하면 여기에서 바로 관리할 수 있어요.</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
