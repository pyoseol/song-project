import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; 
import { db, auth } from '../firebase';
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
export async function updateUserAvatarOnServer(payload: { 
  email: string; 
  file?: File; 
  avatarUrl?: string | null 
}) {
  const storage = getStorage();
  const userDocRef = doc(db, 'users', payload.email);
  
  // --- [1단계] 기존 이미지 정보 가져오기 ---
  const userSnap = await getDoc(userDocRef);
  const currentData = userSnap.data() as ServerProfile | undefined;
  const oldAvatarUrl = currentData?.avatarUrl;

  let finalAvatarUrl: string | null = payload.avatarUrl ?? null;

  // --- [2단계] 새로운 파일이 있거나, 아예 삭제(null)하는 경우 기존 파일 삭제 ---
  // 조건: 기존 URL이 존재하고, 그 URL이 Firebase Storage 주소인 경우에만 삭제 시도
  if (oldAvatarUrl && (payload.file || payload.avatarUrl === null)) {
    if (oldAvatarUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const oldStorageRef = ref(storage, oldAvatarUrl);
        await deleteObject(oldStorageRef);
        console.log("기존 프로필 사진 삭제 완료");
      } catch (error) {
        // 이미 파일이 없거나 에러가 나도 다음 단계(업로드)를 위해 무시하고 진행
        console.warn("기존 사진 삭제 실패 또는 이미 없음:", error);
      }
    }
  }

  // --- [3단계] 새로운 파일 업로드 ---
  if (payload.file) {
    const ext = payload.file.name.split('.').pop();
    const storageRef = ref(storage, `avatars/${payload.email}/profile_${Date.now()}.${ext}`);
    
    const snapshot = await uploadBytes(storageRef, payload.file);
    finalAvatarUrl = await getDownloadURL(snapshot.ref);
  }

  // --- [4단계] Firestore & Auth 업데이트 ---
  await setDoc(userDocRef, { avatarUrl: finalAvatarUrl ?? null }, { merge: true });

  if (auth.currentUser && auth.currentUser.email === payload.email) {
    await updateProfile(auth.currentUser, { photoURL: finalAvatarUrl ?? '' });
  }

  const snap = await getDoc(userDocRef);
  return { user: snap.data() as ServerProfile };
}