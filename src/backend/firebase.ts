import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  getDoc
} from 'firebase/firestore/lite';
import { initializeApp } from 'firebase/app';
import { getFirebaseConfig, IS_VERCEL } from './config';

/**
 * Tipos de operação para logs
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

let adminDb: any = null;
let clientDb: any = null;
let adminDisabled = false;

/**
 * Inicializa os SDKs do Firebase (Admin e Client)
 */
let initPromise: Promise<void> | null = null;

export const initFirebase = async () => {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const firebaseConfig = await getFirebaseConfig();

    // Initialize Admin SDK
    try {
      if (IS_VERCEL) {
        console.log("[Firebase] Vercel environment detected. Skipper Admin SDK init completely to avoid metadata credential hangs.");
        adminDisabled = true;
      } else {
        const { initializeApp: initAdminApp, getApps: getAdminApps } = await import('firebase-admin/app');
        const { getFirestore: getAdminFirestore } = await import('firebase-admin/firestore');

        if (getAdminApps().length === 0) {
          initAdminApp({ projectId: firebaseConfig.projectId });
        }
        const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
        try {
          adminDb = getAdminFirestore(dbId);
        } catch (dbErr) {
          adminDb = getAdminFirestore();
        }
        
        // Quick health check for Admin SDK
        try {
          await adminDb.collection('_health_check').limit(1).get();
          console.log("[Firebase] Admin SDK verified successfully.");
        } catch (healthErr: any) {
          if (healthErr.message?.includes('PERMISSION_DENIED') || healthErr.code === 7) {
            console.warn("[Firebase] Admin SDK health check failed (PERMISSION_DENIED). Falling back to Client SDK.");
            adminDisabled = true;
          }
        }
      }
    } catch (e) {
      console.warn("[Firebase] Admin SDK init failed, using Client only.", e);
    }

    // Initialize Client SDK
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      try {
        const clientApp = initializeApp(firebaseConfig);
        clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');
        console.log("[Firebase] Client SDK initialized with Firestore Lite.");
      } catch (err) {
        console.error("[Firebase] Client SDK init failed:", err);
      }
    }
  })();
  
  return initPromise;
};

/**
 * Retorna a instância ativa do banco (prefere Admin)
 */
export const getDb = async () => {
  if (!adminDb && !clientDb) {
    await initFirebase();
  }
  if (adminDb && !adminDisabled) return adminDb;
  return clientDb;
};

/**
 * Serialização segura para logs
 */
const safeStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Serialization Error]';
  }
};

/**
 * Handler centralizado para erros de Firestore
 */
export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: "server-context", usingAdmin: !!adminDb },
    operationType,
    path
  };
  
  // Skip throwing for NOT_FOUND / 404
  if (errInfo.error.toLowerCase().includes('not found') || errInfo.error.includes('404')) {
    console.warn('[FirestoreWarn]', safeStringify(errInfo));
    return errInfo;
  }
  
  console.error('[FirestoreError]', safeStringify(errInfo));
  return errInfo;
};

/**
 * Wrapper de operações comuns do Firestore
 */
export const fsOps = {
  collection: async (coll: string) => {
    const db: any = await getDb();
    return db.collection ? db.collection(coll) : collection(db, coll);
  },
  getDocs: async (collOrQuery: any, path: string = 'unknown') => {
    try {
      const db: any = await getDb();
      if (db.collection) {
        if (typeof collOrQuery === 'string') return await db.collection(collOrQuery).get();
        if (collOrQuery.get) return await collOrQuery.get();
      }
      if (typeof collOrQuery === 'string') return await getDocs(collection(db, collOrQuery));
      return await getDocs(collOrQuery);
    } catch (err: any) {
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] List operation failed (Not Found) at ${path}`);
        return { docs: [] };
      }
      handleFirestoreError(err, OperationType.LIST, path);
      throw err;
    }
  },
  doc: async (coll: string, id: string) => {
    const db: any = await getDb();
    return db.collection ? db.collection(coll).doc(id) : doc(db, coll, id);
  },
  getDoc: async (refPromise: any, path: string = 'unknown') => {
    try {
      const ref = await refPromise;
      return ref.get ? await ref.get() : await getDoc(ref);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, path);
      throw err;
    }
  },
  update: async (refPromise: any, data: any, path: string = 'unknown') => {
    try {
      const ref = await refPromise;
      return ref.update ? await ref.update(data) : await updateDoc(ref, data);
    } catch (err: any) {
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] Update operation failed (Not Found) at ${path}`);
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  },
  set: async (refPromise: any, data: any, path: string = 'unknown') => {
    try {
      const ref = await refPromise;
      return ref.set ? await ref.set(data) : await setDoc(ref, data);
    } catch (err: any) {
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] Set operation failed (Not Found) at ${path}`);
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },
  delete: async (refPromise: any, path: string = 'unknown') => {
    try {
      const ref = await refPromise;
      console.log(`[Firestore] Deleting doc at path: ${path}`);
      const result =  ref.delete ? await ref.delete() : await deleteDoc(ref);
      console.log(`[Firestore] Delete successful for path: ${path}`);
      return result;
    } catch (err: any) {
      console.error(`[Firestore] Delete failed for path: ${path}`, err);
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] Delete operation failed (Not Found) at ${path}`);
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  }
};
