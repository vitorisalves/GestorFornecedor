import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, memoryLocalCache, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Global singleton for Firestore to prevent multiple initializations in HMR environments
let firestoreDb;

if (getApps().length === 0) {
  const app = initializeApp(firebaseConfig);
  // Default initialization is more stable in current AI Studio environment.
  // Standard streaming (WebSockets) should be tried first.
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache()
  }, firebaseConfig.firestoreDatabaseId || '(default)');
} else {
  const app = getApp();
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(getApp());

export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously };
