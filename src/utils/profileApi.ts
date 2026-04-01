import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase'; // ★ 주의: 실제 firebase.ts 경로에 맞게 수정하세요!

export type ServerProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: number;
};

// ============================================================================
// 🔥 1. 유저 프로필 가져오기
// ============================================================================
export async function fetchUserProfile(email: string) {
  const userDocRef = doc(db, 'users', email); // 이메일을 문서 ID로 사용합니다.
  const userSnap = await getDoc(userDocRef);

  if (userSnap.exists()) {
    return { user: userSnap.data() as ServerProfile };
  } else {
    // 만약 DB에 아직 프로필 문서가 없다면 (방금 가입한 유저 등)
    // 현재 로그인된 파이어베이스 Auth 정보를 바탕으로 기본 문서를 생성해 줍니다.
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email === email) {
      const newProfile: ServerProfile = {
        id: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || 'Guest',
        avatarUrl: currentUser.photoURL || undefined,
        createdAt: Date.now()
      };
      await setDoc(userDocRef, newProfile);
      return { user: newProfile };
    }
    throw new Error('유저 프로필을 찾을 수 없습니다.');
  }
}

// ============================================================================
// 🔥 2. 유저 닉네임 변경하기
// ============================================================================
export async function updateUserProfileOnServer(payload: { email: string; name: string }) {
  const userDocRef = doc(db, 'users', payload.email);
  
  // 1) Firestore 데이터베이스 업데이트 (merge: true로 기존 데이터 유지)
  await setDoc(userDocRef, { name: payload.name }, { merge: true });

  // 2) Firebase Auth (인증 시스템) 내부 프로필도 동기화
  if (auth.currentUser && auth.currentUser.email === payload.email) {
    await updateProfile(auth.currentUser, { displayName: payload.name });
  }

  const snap = await getDoc(userDocRef);
  return { user: snap.data() as ServerProfile };
}

// ============================================================================
// 🔥 3. 유저 프로필 이미지 변경하기
// ============================================================================
export async function updateUserAvatarOnServer(payload: { email: string; avatarUrl: string | null }) {
  const userDocRef = doc(db, 'users', payload.email);
  const safeAvatarUrl = payload.avatarUrl || undefined;

  // 1) Firestore 데이터베이스 업데이트
  await setDoc(userDocRef, { avatarUrl: safeAvatarUrl }, { merge: true });

  // 2) Firebase Auth (인증 시스템) 내부 프로필도 동기화
  if (auth.currentUser && auth.currentUser.email === payload.email) {
    await updateProfile(auth.currentUser, { photoURL: safeAvatarUrl || '' });
  }

  const snap = await getDoc(userDocRef);
  return { user: snap.data() as ServerProfile };
}