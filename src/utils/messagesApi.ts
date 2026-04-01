import type { FriendProfile } from '../store/friendStore';
import type { DirectMessage, MessageMember, MessageThread } from '../store/messageStore';
import { getStoredSessionToken } from './authSession';
import { fetchServerJson } from './serverApi';

export type MessageSnapshot = {
  friends: FriendProfile[];
  threads: MessageThread[];
  messagesByThread: Record<string, DirectMessage[]>;
};

export function fetchMessagesBootstrap(payload: { ownerEmail: string; ownerName: string }) {
  const query = new URLSearchParams(payload);
  return fetchServerJson<MessageSnapshot>(`/api/messages/bootstrap?${query.toString()}`);
}

export function addFriendOnServer(payload: {
  ownerEmail: string;
  ownerName: string;
  friendName: string;
  friendEmail: string;
}) {
  return fetchServerJson<{ snapshot: MessageSnapshot }>('/api/messages/friends', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeFriendOnServer(payload: {
  ownerEmail: string;
  ownerName: string;
  friendEmail: string;
}) {
  return fetchServerJson<{ snapshot: MessageSnapshot }>('/api/messages/friends/remove', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createDirectThreadOnServer(payload: {
  ownerEmail: string;
  ownerName: string;
  participantName: string;
  participantEmail: string;
  openingMessage?: string;
}) {
  return fetchServerJson<{ threadId: string; snapshot: MessageSnapshot }>(
    '/api/messages/threads/direct',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function createGroupThreadOnServer(payload: {
  ownerEmail: string;
  ownerName: string;
  title: string;
  members: MessageMember[];
  openingMessage?: string;
}) {
  return fetchServerJson<{ threadId: string; snapshot: MessageSnapshot }>(
    '/api/messages/threads/group',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function sendThreadMessageOnServer(payload: {
  ownerEmail: string;
  threadId: string;
  authorName: string;
  content: string;
}) {
  return fetchServerJson<{ snapshot: MessageSnapshot }>(
    `/api/messages/threads/${payload.threadId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function markThreadReadOnServer(payload: { threadId: string; readerEmail: string }) {
  return fetchServerJson<{ snapshot: MessageSnapshot }>(
    `/api/messages/threads/${payload.threadId}/read`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function createMessagesEventSource(ownerEmail: string) {
  const token = getStoredSessionToken();
  const params = new URLSearchParams({
    ownerEmail,
    sessionToken: token ?? '',
  });

  return new EventSource(
    `${window.location.protocol}//${window.location.hostname}:8788/api/messages/stream?${params.toString()}`
  );
}
