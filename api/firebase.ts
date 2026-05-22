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
import { initializeApp, getApps, getApp } from 'firebase/app';
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
        const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
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
  
  if (!clientDb) {
    console.warn("[Firebase] clientDb está nulo em getDb(), tentando inicialização forçada de recuperação...");
    try {
      const firebaseConfig = await getFirebaseConfig();
      const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');
      console.log("[Firebase] Recuperação do clientDb por inicialização forçada realizada com sucesso!");
    } catch (e) {
      console.error("[Firebase] Inicialização forçada de recuperação do clientDb falhou:", e);
    }
  }

  if (!clientDb) {
    throw new Error("Erro de conexão com o Banco de Dados: O SDK do Firebase não pôde ser inicializado no servidor.");
  }

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

const FIRESTORE_TIMEOUT_MS = 6500;

/**
 * Garante que uma Promise seja rejeitada se demorar mais que o tempo limite.
 * Evita travamento por tempo indefinido em ambientes serverless (Vercel).
 */
const withTimeout = <T>(promise: Promise<T>, operationName: string, path: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutError = new Error(`TIMEOUT_ERROR: A operação Firestore '${operationName}' no caminho '${path}' excedeu o limite seguro de ${FIRESTORE_TIMEOUT_MS}ms no servidor.`);
      (timeoutError as any).code = 'TIMEOUT';
      reject(timeoutError);
    }, FIRESTORE_TIMEOUT_MS);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

/**
 * Wrapper de operações comuns do Firestore
 */
export const fsOps = {
  collection: async (coll: string): Promise<any> => {
    const db: any = await getDb();
    return db.collection ? db.collection(coll) : collection(db, coll);
  },
  getDocs: async (collOrQuery: any, path: string = 'unknown'): Promise<any> => {
    try {
      const db: any = await getDb();
      let promise;
      if (db.collection) {
        if (typeof collOrQuery === 'string') {
          promise = db.collection(collOrQuery).get();
        } else if (collOrQuery.get) {
          promise = collOrQuery.get();
        }
      }
      if (!promise) {
        if (typeof collOrQuery === 'string') {
          promise = getDocs(collection(db, collOrQuery));
        } else {
          promise = getDocs(collOrQuery);
        }
      }
      return await withTimeout(promise, 'getDocs', path);
    } catch (err: any) {
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] List operation failed (Not Found) at ${path}`);
        return { docs: [] };
      }
      handleFirestoreError(err, OperationType.LIST, path);
      throw err;
    }
  },
  doc: async (coll: string, id: string): Promise<any> => {
    const db: any = await getDb();
    return db.collection ? db.collection(coll).doc(id) : doc(db, coll, id);
  },
  getDoc: async (refPromise: any, path: string = 'unknown'): Promise<any> => {
    try {
      const ref = await withTimeout(Promise.resolve(refPromise), 'resolveDocRef', path);
      const promise = ref.get ? ref.get() : getDoc(ref);
      return await withTimeout(promise, 'getDoc', path);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, path);
      throw err;
    }
  },
  update: async (refPromise: any, data: any, path: string = 'unknown'): Promise<any> => {
    try {
      const ref = await withTimeout(Promise.resolve(refPromise), 'resolveDocRef', path);
      const promise = ref.update ? ref.update(data) : updateDoc(ref, data);
      return await withTimeout(promise, 'update', path);
    } catch (err: any) {
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] Update operation failed (Not Found) at ${path}`);
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  },
  set: async (refPromise: any, data: any, path: string = 'unknown'): Promise<any> => {
    try {
      const ref = await withTimeout(Promise.resolve(refPromise), 'resolveDocRef', path);
      const promise = ref.set ? ref.set(data) : setDoc(ref, data);
      return await withTimeout(promise, 'set', path);
    } catch (err: any) {
      if (typeof err.message === 'string' && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        console.warn(`[FirestoreWarn] Set operation failed (Not Found) at ${path}`);
        return;
      }
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },
  delete: async (refPromise: any, path: string = 'unknown'): Promise<any> => {
    try {
      const ref = await withTimeout(Promise.resolve(refPromise), 'resolveDocRef', path);
      console.log(`[Firestore] Deleting doc at path: ${path}`);
      const promise = ref.delete ? ref.delete() : deleteDoc(ref);
      const result = await withTimeout(promise, 'delete', path);
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
