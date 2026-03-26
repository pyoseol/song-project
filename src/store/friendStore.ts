import { create } from 'zustand';

export type FriendProfile = {
  name: string;
  email: string;
};

type FriendStoreState = {
  friendsByEmail: Record<string, FriendProfile[]>;
  replaceFriends: (ownerEmail: string, friends: FriendProfile[]) => void;
  clearFriends: (ownerEmail: string) => void;
};

export const SUGGESTED_FRIENDS: FriendProfile[] = [
  { name: 'loopmaker', email: 'loopmaker@songmaker.dev' },
  { name: 'groovepark', email: 'groovepark@songmaker.dev' },
  { name: 'chordnote', email: 'chordnote@songmaker.dev' },
  { name: 'beatnova', email: 'beatnova@songmaker.dev' },
  { name: 'arranger', email: 'arranger@songmaker.dev' },
];

export const useFriendStore = create<FriendStoreState>((set) => ({
  friendsByEmail: {},
  replaceFriends: (ownerEmail, friends) =>
    set((state) => ({
      ...state,
      friendsByEmail: {
        ...state.friendsByEmail,
        [ownerEmail]: friends,
      },
    })),
  clearFriends: (ownerEmail) =>
    set((state) => {
      const nextFriendsByEmail = { ...state.friendsByEmail };
      delete nextFriendsByEmail[ownerEmail];

      return {
        ...state,
        friendsByEmail: nextFriendsByEmail,
      };
    }),
}));
