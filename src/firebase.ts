import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { readEnv, warnMissingEnv } from "./env";

const FIREBASE_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

warnMissingEnv(FIREBASE_ENV_KEYS, "Firebase");

const projectId = readEnv("VITE_FIREBASE_PROJECT_ID") || "music-web-final";

const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY") || "demo-api-key",
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN") || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET") || `${projectId}.firebasestorage.app`,
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID") || "000000000000",
  appId: readEnv("VITE_FIREBASE_APP_ID") || "1:000000000000:web:demo",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
