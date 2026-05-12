import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getFirebaseConfig } from './config';

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
export const initFirebase = async () => {
  const firebaseConfig = await getFirebaseConfig();

  // Initialize Admin SDK
  try {
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
  } catch (e) {
    console.warn("[Firebase] Admin SDK init failed, using Client only.");
  }

  // Initialize Client SDK
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      const clientApp = initializeApp(firebaseConfig);
      clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
      console.log("[Firebase] Client SDK initialized.");
    } catch (err) {
      console.error("[Firebase] Client SDK init failed:", err);
    }
  }
};

/**
 * Retorna a instância ativa do banco (prefere Admin)
 */
export const getDb = () => {
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
  console.error('[FirestoreError]', safeStringify(errInfo));
  return errInfo;
};

/**
 * Wrapper de operações comuns do Firestore
 */
export const fsOps = {
  collection: (coll: string) => {
    const db: any = getDb();
    return db.collection ? db.collection(coll) : collection(db, coll);
  },
  getDocs: async (collOrQuery: any, path: string = 'unknown') => {
    try {
      const db: any = getDb();
      if (db.collection) {
        if (typeof collOrQuery === 'string') return await db.collection(collOrQuery).get();
        if (collOrQuery.get) return await collOrQuery.get();
      }
      if (typeof collOrQuery === 'string') return await getDocs(collection(db, collOrQuery));
      return await getDocs(collOrQuery);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
      throw err;
    }
  },
  doc: (coll: string, id: string) => {
    const db: any = getDb();
    return db.collection ? db.collection(coll).doc(id) : doc(db, coll, id);
  },
  update: async (ref: any, data: any, path: string = 'unknown') => {
    try {
      return ref.update ? await ref.update(data) : await updateDoc(ref, data);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  },
  set: async (ref: any, data: any, path: string = 'unknown') => {
    try {
      return ref.set ? await ref.set(data) : await setDoc(ref, data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },
  delete: async (ref: any, path: string = 'unknown') => {
    try {
      return ref.delete ? await ref.delete() : await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  }
};
