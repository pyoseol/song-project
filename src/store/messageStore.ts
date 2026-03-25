import { create } from 'zustand';
import { useFriendStore } from './friendStore';
import {
  addFriendOnServer,
  createMessagesEventSource,
  createDirectThreadOnServer,
  createGroupThreadOnServer,
  fetchMessagesBootstrap,
  markThreadReadOnServer,
  removeFriendOnServer,
  sendThreadMessageOnServer,
  type MessageSnapshot,
} from '../utils/messagesApi';

export type MessageMember = {
  name: string;
  email: string;
};

export type MessageThreadType = 'direct' | 'group';

export type MessageThread = {
  id: string;
  ownerEmail: string;
  type: MessageThreadType;
  title: string;
  participantName?: string;
  participantEmail?: string;
  members: MessageMember[];
  lastMessageAt: number;
  lastPreview: string;
};

export type DirectMessage = {
  id: string;
  threadId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: number;
  isRead: boolean;
};

type MessageStoreState = {
  threads: MessageThread[];
  messagesByThread: Record<string, DirectMessage[]>;
  inboxStatus: 'idle' | 'loading' | 'ready' | 'error';
  inboxError: string | null;
  seedInbox: (payload: { ownerEmail: string; ownerName: string }) => Promise<void>;
  addFriend: (payload: {
    ownerEmail: string;
    ownerName: string;
    friendName: string;
    friendEmail: string;
  }) => Promise<void>;
  removeFriend: (payload: {
    ownerEmail: string;
    ownerName: string;
    friendEmail: string;
  }) => Promise<void>;
  createThread: (payload: {
    ownerEmail: string;
    participantName: string;
    participantEmail: string;
    openingMessage?: string;
    ownerName: string;
  }) => Promise<string>;
  createGroupThread: (payload: {
    ownerEmail: string;
    ownerName: string;
    title: string;
    members: MessageMember[];
    openingMessage?: string;
  }) => Promise<string>;
  sendMessage: (payload: {
    threadId: string;
    authorName: string;
    authorEmail: string;
    content: string;
  }) => Promise<void>;
  markThreadRead: (payload: { threadId: string; readerEmail: string }) => Promise<void>;
};

function applySnapshot(ownerEmail: string, snapshot: MessageSnapshot) {
  useFriendStore.getState().replaceFriends(ownerEmail, snapshot.friends);

  useMessageStore.setState((state) => ({
    ...state,
    threads: snapshot.threads,
    messagesByThread: snapshot.messagesByThread,
    inboxStatus: 'ready',
    inboxError: null,
  }));
}

function setStoreError(message: string) {
  useMessageStore.setState((state) => ({
    ...state,
    inboxStatus: 'error',
    inboxError: message,
  }));
}

let messagesEventSource: EventSource | null = null;
let subscribedOwnerEmail = '';

export const useMessageStore = create<MessageStoreState>((set) => ({
  threads: [],
  messagesByThread: {},
  inboxStatus: 'idle',
  inboxError: null,
  seedInbox: async ({ ownerEmail, ownerName }) => {
    const normalizedEmail = ownerEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    set((state) => ({
      ...state,
      inboxStatus: 'loading',
      inboxError: null,
    }));

    try {
      const snapshot = await fetchMessagesBootstrap({
        ownerEmail: normalizedEmail,
        ownerName,
      });
      applySnapshot(normalizedEmail, snapshot);

      if (subscribedOwnerEmail !== normalizedEmail) {
        messagesEventSource?.close();
        messagesEventSource = createMessagesEventSource(normalizedEmail);
        subscribedOwnerEmail = normalizedEmail;

        messagesEventSource.addEventListener('snapshot', (event) => {
          const message = event as MessageEvent<string>;
          const nextSnapshot = JSON.parse(message.data) as MessageSnapshot;
          applySnapshot(normalizedEmail, nextSnapshot);
        });

        messagesEventSource.onerror = () => {
          setStoreError('메시지 실시간 연결이 잠시 끊겼습니다.');
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
  addFriend: async ({ ownerEmail, ownerName, friendName, friendEmail }) => {
    const normalizedEmail = ownerEmail.trim().toLowerCase();

    try {
      const response = await addFriendOnServer({
        ownerEmail: normalizedEmail,
        ownerName,
        friendName,
        friendEmail,
      });
      applySnapshot(normalizedEmail, response.snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : '친구를 추가하지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
  removeFriend: async ({ ownerEmail, ownerName, friendEmail }) => {
    const normalizedEmail = ownerEmail.trim().toLowerCase();

    try {
      const response = await removeFriendOnServer({
        ownerEmail: normalizedEmail,
        ownerName,
        friendEmail,
      });
      applySnapshot(normalizedEmail, response.snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : '친구를 삭제하지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
  createThread: async ({
    ownerEmail,
    ownerName,
    participantName,
    participantEmail,
    openingMessage,
  }) => {
    const normalizedEmail = ownerEmail.trim().toLowerCase();

    try {
      const response = await createDirectThreadOnServer({
        ownerEmail: normalizedEmail,
        ownerName,
        participantName,
        participantEmail,
        openingMessage,
      });
      applySnapshot(normalizedEmail, response.snapshot);
      return response.threadId;
    } catch (error) {
      const message = error instanceof Error ? error.message : '대화방을 만들지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
  createGroupThread: async ({ ownerEmail, ownerName, title, members, openingMessage }) => {
    const normalizedEmail = ownerEmail.trim().toLowerCase();

    try {
      const response = await createGroupThreadOnServer({
        ownerEmail: normalizedEmail,
        ownerName,
        title,
        members,
        openingMessage,
      });
      applySnapshot(normalizedEmail, response.snapshot);
      return response.threadId;
    } catch (error) {
      const message = error instanceof Error ? error.message : '그룹 채팅을 만들지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
  sendMessage: async ({ threadId, authorName, authorEmail, content }) => {
    const normalizedEmail = authorEmail.trim().toLowerCase();

    try {
      const response = await sendThreadMessageOnServer({
        ownerEmail: normalizedEmail,
        threadId,
        authorName,
        content,
      });
      applySnapshot(normalizedEmail, response.snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : '메시지를 보내지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
  markThreadRead: async ({ threadId, readerEmail }) => {
    const normalizedEmail = readerEmail.trim().toLowerCase();

    try {
      const response = await markThreadReadOnServer({
        threadId,
        readerEmail: normalizedEmail,
      });
      applySnapshot(normalizedEmail, response.snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : '읽음 상태를 저장하지 못했습니다.';
      setStoreError(message);
      throw error;
    }
  },
}));
