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
import * as fs from 'fs';
import * as path from 'path';

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
let adminDisabled = true;

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
          adminDisabled = false;
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

// Memory Cache structures to prevent quota exhaustion and provide fallback
interface CachedDocs {
  timestamp: number;
  docs: Array<{ id: string; ref?: any; data: () => any }>;
}

interface CachedDoc {
  timestamp: number;
  exists: boolean;
  data: any;
}

const g_docsCache: Record<string, CachedDocs> = {};
const g_docCache: Record<string, CachedDoc> = {};

function getCacheFilePath(key: string): string {
  return path.join(process.cwd(), `firestore_cache_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

function saveCacheToDisk(key: string, docs: Array<{ id: string; data: any }>) {
  if (IS_VERCEL) {
    return; // Não grava cache em disco no ambiente do Vercel (sistema de arquivos read-only/efêmero)
  }
  try {
    const filePath = getCacheFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify({
      timestamp: Date.now(),
      docs
    }, null, 2), 'utf-8');
    console.log(`[FirestoreCache] Cache persistido em disco para: ${key}`);
  } catch (err) {
    console.warn(`[FirestoreCache] Erro ao persistir cache em disco para: ${key}`, err);
  }
}

function loadCacheFromDisk(key: string): CachedDocs | null {
  if (IS_VERCEL) {
    return null; // Não carrega cache do disco no Vercel para evitar ler dados estáticos pré-empacotados desatualizados
  }
  try {
    const filePath = getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.docs)) {
        return {
          timestamp: parsed.timestamp || Date.now(),
          docs: parsed.docs.map((doc: any) => ({
            id: doc.id,
            ref: null,
            data: () => doc.data
          }))
        };
      }
    }
  } catch (err) {
    console.warn(`[FirestoreCache] Erro ao carregar cache do disco para: ${key}`, err);
  }
  return null;
}

const invalidateCache = (pathStr: string) => {
  const cleanCollection = pathStr.split('/')[0];
  if (g_docsCache[cleanCollection]) {
    delete g_docsCache[cleanCollection];
    console.log(`[FirestoreCache] Invalidated collection cache for: ${cleanCollection}`);
  }
  if (g_docCache[pathStr]) {
    delete g_docCache[pathStr];
    console.log(`[FirestoreCache] Invalidated individual doc cache for: ${pathStr}`);
  }
  try {
    const filePath = getCacheFilePath(cleanCollection);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[FirestoreCache] Disk cache invalidated for: ${cleanCollection}`);
    }
  } catch (err) {}
};

/**
 * Wrapper de operações comuns do Firestore com Cache e Tolerância a Falha (Quota)
 */
export const fsOps = {
  collection: async (coll: string) => {
    const db: any = await getDb();
    return db.collection ? db.collection(coll) : collection(db, coll);
  },
  getDocs: async (collOrQuery: any, path: string = 'unknown', forceNoCache: boolean = false) => {
    const cacheKey = typeof collOrQuery === 'string' ? collOrQuery : (path.split('/')[0] || 'query');
    
    // Tenta carregar do cache em memória primeiro
    let cached = g_docsCache[cacheKey];
    if (!cached) {
      // Tenta carregar do cache persistido em disco
      const diskCached = loadCacheFromDisk(cacheKey);
      if (diskCached) {
        g_docsCache[cacheKey] = diskCached;
        cached = diskCached;
      }
    }

    const now = Date.now();
    const isCacheExpired = !cached || (now - cached.timestamp > 86400000); // 24 hours (86,400,000ms) TTL for extreme read optimization

    if (!forceNoCache && !isCacheExpired && cached) {
      return {
        docs: cached.docs,
        empty: cached.docs.length === 0
      };
    }

    try {
      const db: any = await getDb();
      let rawSnap: any;
      if (db.collection) {
        if (typeof collOrQuery === 'string') rawSnap = await db.collection(collOrQuery).get();
        else if (collOrQuery.get) rawSnap = await collOrQuery.get();
      } else {
        if (typeof collOrQuery === 'string') rawSnap = await getDocs(collection(db, collOrQuery));
        else rawSnap = await getDocs(collOrQuery);
      }

      if (rawSnap && rawSnap.docs) {
        const snapDocs = rawSnap.docs.map((doc: any) => {
          const dData = typeof doc.data === 'function' ? doc.data() : (doc.data || {});
          return {
            id: doc.id,
            ref: doc.ref,
            data: () => dData
          };
        });

        // Atualiza em memória
        g_docsCache[cacheKey] = {
          timestamp: now,
          docs: snapDocs
        };

        // Salva cópia serializável em disco
        const serializableDocs = snapDocs.map((doc: any) => ({
          id: doc.id,
          data: doc.data()
        }));
        saveCacheToDisk(cacheKey, serializableDocs);

        return {
          docs: snapDocs,
          empty: snapDocs.length === 0
        };
      }
      return rawSnap;
    } catch (err: any) {
      const errStr = String(err?.message || err).toLowerCase();
      const isQuota = errStr.includes('quota') || errStr.includes('resource-exhausted') || errStr.includes('limit');
      
      if (isQuota) {
        if (cached) {
          console.warn(`[FirestoreCache] [Quota Exceeded] Retornando cache offline para a coleção ${cacheKey}.`);
          return {
            docs: cached.docs,
            empty: cached.docs.length === 0
          };
        } else {
          console.warn(`[FirestoreCache] [Quota Exceeded] Sem cache para coleção ${cacheKey}. Retornando lista vazia fallback.`);
          return {
            docs: [],
            empty: true
          };
        }
      }

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
    const cacheKey = path;
    const cached = g_docCache[cacheKey];
    const now = Date.now();
    const isCacheExpired = !cached || (now - cached.timestamp > 86400000); // 24 hours (86,400,000ms) TTL for extreme read optimization

    if (!isCacheExpired && cached) {
      return {
        exists: () => cached.exists,
        data: () => cached.data,
        id: cacheKey.split('/').pop() || 'unknown'
      };
    }

    try {
      const ref = await refPromise;
      const rawDoc = ref.get ? await ref.get() : await getDoc(ref);
      const existsVal = typeof rawDoc.exists === 'function' ? rawDoc.exists() : !!rawDoc.exists;
      const dData = typeof rawDoc.data === 'function' ? rawDoc.data() : (rawDoc.data || {});

      g_docCache[cacheKey] = {
        timestamp: now,
        exists: existsVal,
        data: dData
      };

      return {
        exists: () => existsVal,
        data: () => dData,
        id: rawDoc.id
      };
    } catch (err: any) {
      const errStr = String(err?.message || err).toLowerCase();
      const isQuota = errStr.includes('quota') || errStr.includes('resource-exhausted') || errStr.includes('limit');

      if (isQuota) {
        if (cached) {
          console.warn(`[FirestoreCache] [Quota Exceeded] Retornando cache offline para o documento ${cacheKey}.`);
          return {
            exists: () => cached.exists,
            data: () => cached.data,
            id: cacheKey.split('/').pop() || 'unknown'
          };
        } else {
          console.warn(`[FirestoreCache] [Quota Exceeded] Sem cache para o documento ${cacheKey}. Retornando documento inexistente vazio fallback.`);
          return {
            exists: () => false,
            data: () => ({}),
            id: cacheKey.split('/').pop() || 'unknown'
          };
        }
      }

      handleFirestoreError(err, OperationType.GET, path);
      throw err;
    }
  },
  update: async (refPromise: any, data: any, path: string = 'unknown') => {
    invalidateCache(path);
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
    invalidateCache(path);
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
    invalidateCache(path);
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
  },
  invalidateCache: (pathStr: string) => {
    invalidateCache(pathStr);
  }
};
