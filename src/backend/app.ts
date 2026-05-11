import express, { Request, Response, NextFunction } from "express";
import axios, { AxiosInstance } from "axios";
import webPush from "web-push";
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  collectionGroup,
  getDocFromServer
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import Papa from 'papaparse';
import firebaseConfig from '../../firebase-applet-config.json';

// --- INITIALIZATION ---

// Try to initialize Admin SDK (works in AI Studio and environments with Service Account)
let adminDb: any = null;
try {
  if (getAdminApps().length === 0) {
    // Cloud Run (AI Studio) should provide environment variables automatically
    initAdminApp({
      projectId: firebaseConfig.projectId,
    });
  }
  
  // Tenta conectar ao banco específico do config
  try {
    adminDb = getAdminFirestore(firebaseConfig.firestoreDatabaseId);
    console.log(`[Firebase] Admin SDK initialized for database: ${firebaseConfig.firestoreDatabaseId}`);
  } catch (dbErr) {
    console.warn(`[Firebase] Falha ao conectar ao banco ${firebaseConfig.firestoreDatabaseId}, tentando (default)...`);
    adminDb = getAdminFirestore();
  }
} catch (e) {
  console.warn("[Firebase] Admin SDK initialization failed. Using Client SDK only.", e instanceof Error ? e.message : String(e));
}

// Initialize Client SDK (works everywhere, subject to security rules)
const clientApp = initializeApp(firebaseConfig);
const clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

/**
 * Returns a Firestore instance. Prefers Admin SDK on backend for bypassing rules.
 */
const getDb = () => {
  if (adminDb) return adminDb;
  return clientDb;
};

// --- ERROR HANDLING & MONITORING ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "server-context",
      usingAdmin: !!adminDb
    },
    operationType,
    path
  };
  console.error('[FirestoreError]', JSON.stringify(errInfo, null, 2));
  return errInfo;
}

/**
 * Test standard connection on boot
 */
async function testConnection() {
  try {
    const db = getDb();
    if (db.collection) {
      // Admin SDK
      await db.collection('reminders').limit(1).get();
      console.log("[Firestore] Admin connection check: SUCCESS");
    } else {
      // Client SDK
      const testPath = 'reminders/connection-test';
      await getDocFromServer(doc(clientDb, testPath));
      console.log("[Firestore] Client connection check: SUCCESS");
    }
  } catch (error) {
    console.warn("[Firestore] Boot connection check warning:", error instanceof Error ? error.message : String(error));
  }
}
testConnection();

/**
 * Helper to handle database operations
 */
const fsOps = {
  collection: (coll: string) => {
    const db: any = getDb();
    if (db.collection) return db.collection(coll);
    return collection(db, coll);
  },
  getDocs: async (collOrQuery: any, path: string = 'unknown') => {
    try {
      const db: any = getDb();
      if (db.collection) {
        // Se for string, é uma coleção Admin
        if (typeof collOrQuery === 'string') return await db.collection(collOrQuery).get();
        // Se tiver query Admin
        if (collOrQuery.get) return await collOrQuery.get();
      }
      // Client SDK fallback
      if (typeof collOrQuery === 'string') return await getDocs(collection(db, collOrQuery));
      return await getDocs(collOrQuery);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
      throw err;
    }
  },
  doc: (coll: string, id: string) => {
    const db: any = getDb();
    if (db.collection) return db.collection(coll).doc(id);
    return doc(db, coll, id);
  },
  update: async (ref: any, data: any, path: string = 'unknown') => {
    try {
      if (ref.update) return await ref.update(data);
      return await updateDoc(ref, data);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      throw err;
    }
  },
  set: async (ref: any, data: any, path: string = 'unknown') => {
    try {
      if (ref.set) return await ref.set(data);
      return await setDoc(ref, data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  },
  delete: async (ref: any, path: string = 'unknown') => {
    try {
      if (ref.delete) return await ref.delete();
      return await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      throw err;
    }
  }
};

// --- CONFIGURAÇÃO WEB PUSH ---
const VAPID_KEY_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BLzFX530XvDT4SYRB5rtIyrBEXIwdIBZ_PdBppRdlHPrOx-iwJtKy1uek7Ah6MmS4dvfilxpt109ILtA0X4N_Ek';
const VAPID_KEY_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'Xa8catoJrTvxLBpT5nmnS3l2tYh9RWL7-hHYV0M36WE';

// Utilizamos as chaves fixas para que o navegador se mantenha autenticado mesmo se o servidor reiniciar
const finalVapidKeys = { publicKey: VAPID_KEY_PUBLIC, privateKey: VAPID_KEY_PRIVATE };

webPush.setVapidDetails(
  'mailto:vitorisalves1@gmail.com',
  finalVapidKeys.publicKey,
  finalVapidKeys.privateKey
);

/**
 * Interface para configuração da API externa
 */
interface ApiConfig {
  baseUrl: string;
}

const app = express();
app.use(express.json());

/**
 * Wrapper para rotas assíncronas capturarem erros no Express 4 e encaminharem para o middleware de erro.
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- ROTAS DE NOTIFICAÇÃO PUSH ---

/**
 * Helper para envio de notificações Push
 */
const sendPushNotification = async (subscription: any, title: string, message: string, url: string = '/') => {
  const payload = JSON.stringify({
    title,
    body: message,
    url,
    tag: 'gestor-update-' + Date.now()
  });

  try {
    await webPush.sendNotification(subscription, payload);
    return true;
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      const docId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
      try {
        await fsOps.delete(fsOps.doc('push_subscriptions', docId), 'push_subscriptions/' + docId);
      } catch (deleteErr) {
        console.error("Erro ao remover inscrição expirada:", deleteErr);
      }
    }
    console.error("Erro ao enviar push:", err instanceof Error ? err.message : String(err));
    return false;
  }
};

/**
 * Worker em segundo plano para verificar lembretes
 */
const startBackgroundReminderWorker = () => {
  console.log("[ReminderWorker] Inicializando verificação de lembretes em segundo plano...");
  
  setInterval(async () => {
    try {
      const now = new Date();
      const nowStr = now.toISOString();
      
      const db = getDb();
      
      const q = query(
        collection(db, 'reminders'), 
        where('notified', '==', false),
        where('date', '<=', nowStr)
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'reminders');
        throw err;
      }

      if (snapshot.empty) return;

      console.log(`[ReminderWorker] Processando ${snapshot.docs.length} lembretes pendentes...`);

      // Busca todas as assinaturas de push
      const subsSnapshot = await fsOps.getDocs('push_subscriptions', 'push_subscriptions');
      const subscriptions = subsSnapshot.docs.map((doc: any) => doc.data());

      for (const reminderDoc of snapshot.docs) {
        const reminder = reminderDoc.data();
        const title = "Lembrete de Produto";
        const message = `Está na hora de comprar: ${reminder.productName}`;

        // Envia para todos os inscritos
        const promises = subscriptions.map((sub: any) => sendPushNotification(sub, title, message));
        await Promise.all(promises);

        // Marca como notificado
        try {
          await fsOps.update(reminderDoc.ref, { notified: true }, `reminders/${reminderDoc.id}`);
          console.log(`[ReminderWorker] Lembrete "${reminder.productName}" enviado e marcado como concluído.`);
        } catch (updateErr) {
          console.error(`[ReminderWorker] Erro ao atualizar lembrete ${reminderDoc.id}:`, updateErr);
        }
      }
    } catch (err) {
      console.error("[ReminderWorker] Erro no ciclo de verificação:", err);
    }
  }, 30000); 
};

// Inicia o worker
startBackgroundReminderWorker();

/**
 * Retorna a chave pública VAPID para o frontend se inscrever.
 */
app.get("/api/notifications/vapid-key", (req, res) => {
  res.json({ publicKey: finalVapidKeys.publicKey });
});

/**
 * Salva uma nova assinatura de Push no Firestore para persistência.
 */
app.post("/api/notifications/subscribe", asyncHandler(async (req: Request, res: Response) => {
  const subscription = req.body;
  
  // Sanitiza o endpoint para usar como ID (base64)
  const docId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
  
  const subData = {
    ...subscription,
    updatedAt: new Date().toISOString()
  };

  await fsOps.set(fsOps.doc('push_subscriptions', docId), subData, 'push_subscriptions/' + docId);
  
  console.log(`[PushSubscribe] Nova inscrição: ${docId.substring(0, 10)}...`);
  res.status(201).json({ status: "subscribed" });
}));

/**
 * Dispara notificações para todos os dispositivos inscritos salvos no Banco.
 */
app.post("/api/notifications/broadcast", asyncHandler(async (req: Request, res: Response) => {
  const { title, message, url } = req.body;
  
  const snapshot = await fsOps.getDocs('push_subscriptions', 'push_subscriptions');
  const subscriptions = snapshot.docs.map((doc: any) => doc.data());

  const promises = subscriptions.map((sub: any) => sendPushNotification(sub, title || "Gestor Fornecedores", message || "Nova atualização!", url));
  await Promise.all(promises);

  res.json({ sent_to: subscriptions.length });
}));

/**
 * Aumenta o tempo limite global do axios (30 segundos para suportar cold starts da Render.com)
 * validateStatus: () => true evita que o axios lance erro para status != 2xx,
 * permitindo tratamento manual de respostas de erro da API.
 */
const api: AxiosInstance = axios.create({
  timeout: 30000,
  validateStatus: () => true,
});

/**
 * Axios específico para health check/ping com tempo de espera curto.
 */
const pingApi: AxiosInstance = axios.create({
  timeout: 5000,
  validateStatus: () => true,
});

/**
 * Limpa variáveis de ambiente removendo aspas e espaços extras.
 */
const sanitizeEnv = (val: string | undefined, fallback: string): string => {
  if (!val) return fallback;
  return val.trim().replace(/^["']|["']$/g, '');
};

const EXTERNAL_API_CONFIG = {
  baseUrl: sanitizeEnv(process.env.OMIE_BASE_URL || process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, ""),
  appKey: sanitizeEnv(process.env.OMIE_APP_KEY, ""),
  appSecret: sanitizeEnv(process.env.OMIE_APP_SECRET, "")
};

/**
 * Configuração de headers para a API Omie / Proxy
 */
const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (EXTERNAL_API_CONFIG.appKey) {
    headers['x-omie-app-key'] = EXTERNAL_API_CONFIG.appKey;
  }
  if (EXTERNAL_API_CONFIG.appSecret) {
    headers['x-omie-app-secret'] = EXTERNAL_API_CONFIG.appSecret;
  }
  
  return headers;
};

// Sanitiza environment
const buildUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  // Garante que o endpoint comece com /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${EXTERNAL_API_CONFIG.baseUrl}${cleanEndpoint}`;
  if (!params) return url;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => searchParams.set(key, String(value)));
  
  const separator = cleanEndpoint.includes('?') ? '&' : '?';
  return `${url}${separator}${searchParams.toString()}`;
};

/**
 * Busca recursiva/paginada para coleções da API externa.
 * Implementa paralelismo limitado para performance sem estourar rate limits.
 */
const fetchAllPages = async (endpoint: string): Promise<any[]> => {
  const pageSize = 100;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Lista de variações de URL base e endpoint para tentar (Estratégia de Resiliência)
  const baseUrlsToTry = [
    EXTERNAL_API_CONFIG.baseUrl,
    EXTERNAL_API_CONFIG.baseUrl.replace(/\/v1$/, ''), // Tenta sem o /v1 se existir
    EXTERNAL_API_CONFIG.baseUrl.replace(/\/v1$/, '/api/v1'), // Tenta com /api/v1
  ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicatas

  let lastStatus = 0;
  let lastErrorData = null;

  for (const baseUrl of baseUrlsToTry) {
    const fullUrl = `${baseUrl}${cleanEndpoint}`;
    const searchParams = new URLSearchParams({ page: '1', pageSize: String(pageSize) });
    const firstUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${searchParams.toString()}`;
    
    console.log(`[FetchAllPages] Tentando: ${firstUrl}`);
    const firstRes = await api.get(firstUrl, { headers: getHeaders() });
    
    if (firstRes.status < 400) {
      console.log(`[FetchAllPages] Sucesso em: ${baseUrl}`);
      const { data: firstData } = firstRes;
      const results = Array.isArray(firstData) ? [...firstData] : [...(firstData.data || [])];
      
      const { total = 0, pageSize: actualSize = pageSize } = firstData.meta || {};

      if (total > actualSize) {
        const totalPages = Math.ceil(total / actualSize);
        const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        
        const batchSize = 5;
        for (let i = 0; i < pageNumbers.length; i += batchSize) {
          const batch = pageNumbers.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(async (page) => {
            try {
              const pUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${new URLSearchParams({ page: String(page), pageSize: String(actualSize) }).toString()}`;
              const pageRes = await api.get(pUrl, { headers: getHeaders() });
              if (pageRes.status < 400) {
                const d = pageRes.data;
                return Array.isArray(d) ? d : (d.data || []);
              }
            } catch (e) {
              console.error(`[FetchBatchError] Falha na página ${page}:`, e instanceof Error ? e.message : String(e));
            }
            return [];
          }));
          batchResults.forEach(list => results.push(...list));
        }
      }
      return results;
    }
    
    lastStatus = firstRes.status;
    lastErrorData = firstRes.data;
    console.warn(`[FetchAllPages] Falha (Status ${lastStatus}) em: ${baseUrl}`);
  }

  console.error(`[FetchAllPages] Todas as tentativas falharam para ${endpoint}. Último erro: ${lastStatus}`, lastErrorData);
  return [];
};

// --- ROTAS DE API ---

/**
 * Health Check: Verifica status do servidor e tenta acordar a API externa enviando um ping.
 */
app.get(["/api/health", "/health"], asyncHandler(async (req: Request, res: Response) => {
  const { baseUrl } = EXTERNAL_API_CONFIG;
  let externalStatus = "unknown";
  
  try {
    const pingEndpoint = `${baseUrl}/health`.replace(/\/\/health$/, '/health');
    console.log(`[HealthCheck] Verificando API Externa: ${pingEndpoint}`);
    const ping = await pingApi.get(pingEndpoint, { headers: getHeaders() });
    console.log(`[HealthCheck] Status: ${ping.status}`);
    // Se respondeu qualquer coisa < 500, consideramos OK (mesmo se for 404, significa que o servidor está lá)
    externalStatus = ping.status < 500 ? "online" : "error";
  } catch (e: any) {
    if (e.code === 'ECONNABORTED') {
      externalStatus = "waking_up";
    } else {
      console.error("[HealthCheckError]", e.message);
      externalStatus = "offline";
    }
  }

  res.json({ 
    status: "ok", 
    external_api: externalStatus,
    env_set: !!(process.env.OMIE_BASE_URL || process.env.EXTERNAL_API_URL || process.env.OMIE_APP_KEY),
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: baseUrl,
      hasKey: !!EXTERNAL_API_CONFIG.appKey,
      hasSecret: !!EXTERNAL_API_CONFIG.appSecret
    }
  });
}));

/**
 * Proxy Omie Direct: Consolida produtos ativos com seus respectivos saldos de estoque.
 */
app.get("/api/omie-direct/products", asyncHandler(async (req: Request, res: Response) => {
  // Busca produtos e estoque em paralelo. Tentamos com prefixo /omie primeiro
  const [rawProductList, stockList] = await Promise.all([
    fetchAllPages('/omie/products'),
    fetchAllPages('/omie/products/stockQuantity')
  ]);

  // Se falhar (vazio), tentamos sem o prefixo /omie (fallback para versões diferentes da API)
  let productList = rawProductList.filter((p: any) => p.active === true);
  let finalStockList = stockList;

  if (productList.length === 0) {
    console.log("[OmieDirect] Tentando fallback sem prefixo /omie...");
    const [fallbackProducts, fallbackStock] = await Promise.all([
      fetchAllPages('/products'),
      fetchAllPages('/products/stockQuantity')
    ]);
    productList = fallbackProducts.filter((p: any) => p.active === true);
    finalStockList = fallbackStock;
  }

  const stockMap = new Map<string, number>();
  
  // Otimização: Mapeamento de estoque para busca O(1)
  finalStockList.forEach((s: any) => {
    const code = String(s.productId || s.product_id || s.id || s.codigo || "");
    const qty = Number(s.quantity || s.stock || s.stockQuantity || 0);
    if (code) stockMap.set(code, qty);
  });

  const mergedProducts = productList.map((p: any) => {
    const prodId = String(p.id || p.productId || p.codigo_produto || "").trim();
    const stock = stockMap.has(prodId) 
      ? stockMap.get(prodId)! 
      : Number(p.stockQuantity || p.quantity || p.stock || p.estoque || 0);

    // Normalização dos campos para o frontend
    return {
      id: p.id,
      codigo_produto: p.id || p.codigo_produto,
      descricao: p.name || p.descricao || p.description,
      unidade: p.unit || p.unidade || 'UN',
      valor_unitario: p.price || p.valor_unitario || 0,
      stock,
      estoque_fisico: stock,
      codigo: p.sku || p.codigo,
      codigo_familia: p.familyId || p.codigo_familia,
      descricao_familia: p.familyName || p.descricao_familia
    };
  });

  res.json({ data: mergedProducts });
}));

/**
 * Sincronização com Planilha Google Sheets (via CSV export)
 */
app.get("/api/excel-sync", asyncHandler(async (req: Request, res: Response) => {
  const SHEET_ID = "1xP5Fk1iBD6a0isS6KF5DMG1ZjMbbLK2FsS6PupZVe6M";
  const timestamp = Date.now();
  
  // URLs para tentar (Exportação e Publicação)
  const urls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&t=${timestamp}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?output=csv&t=${timestamp}`,
    `https://docs.google.com/spreadsheets/d/e/2PACX-1vS-something-if-published/pub?output=csv&t=${timestamp}` // Placeholder
  ];
  
  let csvData = "";
  let lastError = "";

  for (const url of urls) {
    if (url.includes('something-if-published')) continue;
    
    try {
      console.log(`[ExcelSync] Tentando URL: ${url}`);
      const response = await axios.get(url, { 
        responseType: 'text',
        timeout: 10000, 
        maxRedirects: 5,
        validateStatus: () => true, // Captura qualquer status para diagnóstico
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/csv,text/plain,application/vnd.ms-excel'
        }
      });
      
      if (response.status >= 400) {
        console.warn(`[ExcelSync] URL retornou erro ${response.status}: ${response.statusText}`);
        lastError = `Status ${response.status}: ${response.statusText || 'Erro no Google'}.`;
        continue;
      }

      const data = response.data;
      if (data && typeof data === 'string') {
        // Log dos primeiros caracteres para diagnóstico
        const preview = data.substring(0, 150).replace(/\n/g, ' ');
        console.log(`[ExcelSync] Resposta recebida (preview): ${preview}...`);

        if (data.includes('<!DOCTYPE html>') || data.includes('<html')) {
          console.warn("[ExcelSync] Resposta é HTML em vez de CSV. Planilha privada ou página de login.");
          lastError = "A planilha retornou uma página de login. Certifique-se de que ela está configurada como 'Qualquer pessoa com o link' em 'Compartilhar' e também use 'Arquivo > Compartilhar > Publicar na web'.";
        } else if (data.includes(',') || data.includes(';')) {
          csvData = data;
          console.log(`[ExcelSync] Sucesso com a URL: ${url.split('?')[0]}`);
          break;
        } else {
          console.warn("[ExcelSync] Resposta é texto mas não parece CSV (sem delimitadores).");
          lastError = "A planilha retornou texto simples sem o formato CSV esperado. Verifique se o conteúdo está correto.";
        }
      }
    } catch (e: any) {
      console.error(`[ExcelSyncError] Falha crítica na URL: ${e.message}`);
      lastError = `Conexão falhou: ${e.message}`;
    }
  }

  if (!csvData) {
    return res.status(403).json({ 
      error: `Não foi possível obter os dados da planilha. Verifique se o ID ${SHEET_ID} está correto e se a planilha está pública. Detalhe: ${lastError}` 
    });
  }

  try {
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });

    const rawData = parsed.data as any[];
    const suppliersMap: Record<string, any> = {};

    rawData.forEach((row: any) => {
      // Helper para buscar valores em colunas com nomes variados
      const findVal = (row: any, keywords: string[]) => {
        const keys = Object.keys(row);
        const match = keys.find(k => {
          const cleanK = k.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
          return keywords.some(kw => {
            const cleanKW = kw.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return cleanK === cleanKW || cleanK.includes(cleanKW);
          });
        });
        return match ? row[match] : null;
      };

      let sName = (findVal(row, ['Empresa Razão Social', 'Fornecedor', 'Empresa', 'Razão Social']) || "").toString().trim();
      const sPhone = (findVal(row, ['Telefone', 'WhatsApp', 'Celular']) || "").toString().trim();
      const pName = (findVal(row, ['Produto', 'Descrição', 'Item', 'Nome']) || "").toString().trim();
      
      let pPrice = 0;
      const rawPrice = findVal(row, ['Valor Unitário', 'Preço', 'Valor', 'Preço Unitário']);
      if (typeof rawPrice === 'number') {
        pPrice = rawPrice;
      } else if (rawPrice) {
        const strPrice = rawPrice.toString().replace('R$', '').trim();
        if (strPrice.includes(',')) {
          pPrice = parseFloat(strPrice.replace(/\./g, '').replace(',', '.'));
        } else {
          pPrice = parseFloat(strPrice);
        }
      }

      const lastPurchaseDate = (findVal(row, ['Ultima Data Compra', 'Data Compra', 'Última Data', 'Data', 'Data de Compra', 'Ult. Compra']) || "").toString().trim();
      const paymentMethod = (findVal(row, ['Forma de Pagamento', 'Pagamento', 'Pagto', 'Forma Pagto', 'Meio de Pagamento', 'Tipo de Pagamento']) || "").toString().trim();
      const category = (findVal(row, ['Categoria', 'Grupo', 'Seção']) || "Fornecedor").toString().trim();

      // Se não houver nome de fornecedor mas houver produto, agrupa em "DIVERSOS"
      if (!sName && pName) {
        sName = "DIVERSOS";
      }

      if (sName && pName) {
        if (!suppliersMap[sName]) {
          suppliersMap[sName] = {
            name: sName,
            phone: sPhone,
            products: []
          };
        }
        suppliersMap[sName].products.push({
          name: pName,
          price: isNaN(pPrice) ? 0 : pPrice,
          category: category,
          lastPurchaseDate,
          paymentMethod
        });
      }
    });

    res.json({ data: suppliersMap });
  } catch (error) {
    console.error('[ExcelSyncError]', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Erro ao sincronizar com a planilha Google." });
  }
}));

// --- ROTAS DE API ---
/**
 * Proxy Genérico para v1: Encaminha qualquer requisição /api/v1/* para a API manager.
 */
app.all("/api/v1/*", asyncHandler(async (req: Request, res: Response) => {
  const subPath = (req.params as any)[0];
  const { method, body, url: reqUrl } = req;
  const { baseUrl } = EXTERNAL_API_CONFIG;
  
  const queryString = reqUrl.includes('?') ? reqUrl.substring(reqUrl.indexOf('?')) : '';
  let apiUrl = `${baseUrl}/${subPath}${queryString}`;

  let response = await api({
    method,
    url: apiUrl,
    data: body,
    headers: getHeaders()
  });
  
  // Fallback para caminhos que podem não ter o prefixo /omie na API alvo
  if (response.status === 404 && subPath.startsWith('omie/')) {
    const fallbackPath = subPath.replace(/^omie\//, '');
    console.log(`[ProxyFallback] 404 em ${subPath}, tentando fallback para: ${fallbackPath}`);
    apiUrl = `${baseUrl}/${fallbackPath}${queryString}`;
    response = await api({
      method,
      url: apiUrl,
      data: body,
      headers: getHeaders()
    });
  }
  
  if (response.status >= 400 && typeof response.data === 'string') {
    return res.status(response.status).json({ error: response.data || response.statusText });
  }

  res.status(response.status).send(response.data);
}));

/**
 * Middleware de tratamento de erros global: Garante respostas em JSON consistentemente.
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[GlobalErrorHandler]', err instanceof Error ? err.message : String(err));
  res.status(500).json({ 
    error: 'A server error occurred (Global Handler)',
    message: err.message || 'Erro desconhecido',
    path: req.path
  });
});

export default app;
