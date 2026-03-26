import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotificationStore,
  type AppNotificationFilter,
} from '../../store/notificationStore';
import './NotificationBell.css';

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

  return `${Math.max(1, Math.floor(diff / day))}일 전`;
}

const FILTERS: Array<{ key: AppNotificationFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '안읽음' },
  { key: 'community', label: '커뮤니티' },
  { key: 'music', label: '음악' },
  { key: 'shorts', label: '숏폼' },
];

export default function NotificationBell() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const notifications = useNotificationStore((state) => state.notifications);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AppNotificationFilter>('all');

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') {
      return notifications;
    }

    if (activeFilter === 'unread') {
      return notifications.filter((notification) => !notification.isRead);
    }

    return notifications.filter((notification) => notification.kind === activeFilter);
  }, [activeFilter, notifications]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="notification-bell">
      <button
        type="button"
        className={`notification-bell-trigger${isOpen ? ' is-open' : ''}`}
        aria-label="알림"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="notification-bell-icon" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="notification-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="notification-bell-panel">
          <div className="notification-bell-head">
            <div>
              <strong>알림</strong>
              <small>최근 반응을 한 번에 확인하세요.</small>
            </div>
            <button type="button" onClick={markAllRead}>
              모두 읽음
            </button>
          </div>

          <div className="notification-bell-filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`notification-bell-filter${
                  activeFilter === filter.key ? ' is-active' : ''
                }`}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="notification-bell-list">
            {filteredNotifications.length ? (
              filteredNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-bell-item${
                    notification.isRead ? '' : ' is-unread'
                  }`}
                  onClick={() => {
                    markRead(notification.id);
                    setIsOpen(false);
                    navigate(notification.route);
                  }}
                >
                  <span className={`notification-bell-kind is-${notification.kind}`}>
                    {notification.kind === 'community'
                      ? '커뮤니티'
                      : notification.kind === 'music'
                      ? '음악공유'
                      : '숏폼'}
                  </span>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  {notification.actorName ? (
                    <span className="notification-bell-actor">{notification.actorName}</span>
                  ) : null}
                  <small>{formatRelativeTime(notification.createdAt)}</small>
                </button>
              ))
            ) : (
              <div className="notification-bell-empty">
                선택한 조건에 맞는 알림이 아직 없습니다.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
