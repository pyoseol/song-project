import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // 인증(로그인) 도구
import { getFirestore } from "firebase/firestore"; // 데이터베이스 도구
import { getStorage } from "firebase/storage"; // ★ 추가됨: 파일 저장소(스토리지) 도구

// .env에 숨겨둔 열쇠 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 파이어베이스 시동 걸기
const app = initializeApp(firebaseConfig);

// 다른 파일에서 쓸 수 있게 도구들 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
