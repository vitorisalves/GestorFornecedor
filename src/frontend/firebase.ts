import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with local persistent cache for near-instant loading on repeat visits
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

// Test connection silently in background
async function testConnection() {
  try {
    // Attempting a read to verify config and connectivity
    await getDocFromServer(doc(db, 'connection_test', 'status'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase connection error: The client is offline.");
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously };
