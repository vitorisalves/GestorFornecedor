import express, { Request, Response, NextFunction } from "express";
import axios, { AxiosInstance } from "axios";
import webPush from "web-push";
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';

// Inicialização segura do Firebase Admin
if (getApps().length === 0) {
  initializeApp();
}

// Configuração Web Push (Chaves fixas geradas para consistência entre reinícios de servidor)
const VAPID_KEY_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BLzFX530XvDT4SYRB5rtIyrBEXIwdIBZ_PdBppRdlHPrOx-iwJtKy1uek7Ah6MmS4dvfilxpt109ILtA0X4N_Ek';
const VAPID_KEY_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'Xa8catoJrTvxLPgT5nmnS3l2tYh9RWL7-hHYV0M36WE';

// Utilizamos as chaves fixas para que o navegador se mantenha autenticado mesmo se o servidor reiniciar
const finalVapidKeys = { publicKey: VAPID_KEY_PUBLIC, privateKey: VAPID_KEY_PRIVATE };

webPush.setVapidDetails(
  'mailto:vitorisalves1@gmail.com',
  finalVapidKeys.publicKey,
  finalVapidKeys.privateKey
);

// Obter instância do Firestore
const getDb = () => (getApps().length > 0) ? getFirestore() : null;

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
  const db = getDb();
  
  if (db) {
    const subsCol = db.collection('push_subscriptions');
    // Sanitiza o endpoint para usar como ID (base64)
    const docId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
    await subsCol.doc(docId).set({
      ...subscription,
      updatedAt: new Date().toISOString()
    });
  }
  
  res.status(201).json({ status: "subscribed" });
}));

/**
 * Dispara notificações para todos os dispositivos inscritos salvos no Banco.
 */
app.post("/api/notifications/broadcast", asyncHandler(async (req: Request, res: Response) => {
  const { title, message, url } = req.body;
  const db = getDb();
  
  let targetSubscriptions: any[] = [];
  if (db) {
    const snapshot = await db.collection('push_subscriptions').get();
    targetSubscriptions = snapshot.docs.map(doc => doc.data());
  }
  
  const payload = JSON.stringify({
    title: title || "Gestor Fornecedores",
    body: message || "Nova atualização!",
    url: url || "/",
    tag: 'gestor-update-' + Date.now()
  });

  const promises = targetSubscriptions.map(sub => 
    webPush.sendNotification(sub, payload).catch(async err => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        if (db) {
          const docId = Buffer.from(sub.endpoint).toString('base64').substring(0, 50);
          await db.collection('push_subscriptions').doc(docId).delete();
        }
      }
      console.error("Erro ao enviar push:", err instanceof Error ? err.message : String(err));
    })
  );

  await Promise.all(promises);
  res.json({ sent_to: targetSubscriptions.length });
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

const EXTERNAL_API_CONFIG: ApiConfig = {
  baseUrl: sanitizeEnv(process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, "")
};

// Sanitiza environment
const buildUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  const url = `${EXTERNAL_API_CONFIG.baseUrl}${endpoint}`;
  if (!params) return url;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => searchParams.set(key, String(value)));
  
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${url}${separator}${searchParams.toString()}`;
};

/**
 * Busca recursiva/paginada para coleções da API externa.
 * Implementa paralelismo limitado para performance sem estourar rate limits.
 */
const fetchAllPages = async (endpoint: string): Promise<any[]> => {
  const pageSize = 100;
  const firstUrl = buildUrl(endpoint, { page: 1, pageSize });
  
  const firstRes = await api.get(firstUrl);
  if (firstRes.status >= 400) return [];
  
  const { data: firstData } = firstRes;
  const results = Array.isArray(firstData) ? [...firstData] : [...(firstData.data || [])];
  
  const { total = 0, pageSize: actualSize = pageSize } = firstData.meta || {};

  if (total > actualSize) {
    const totalPages = Math.ceil(total / actualSize);
    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    
    // Processamento em lotes (batching) para performance balanceada
    const batchSize = 5;
    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      const batch = pageNumbers.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (page) => {
        try {
          const pageRes = await api.get(buildUrl(endpoint, { page, pageSize: actualSize }));
          if (pageRes.status < 400) {
            const d = pageRes.data;
            return Array.isArray(d) ? d : (d.data || []);
          }
        } catch (e) {
          console.error(`[FetchBatchError] Falha na página ${page} de ${endpoint}:`, e instanceof Error ? e.message : String(e));
        }
        return [];
      }));
      batchResults.forEach(list => results.push(...list));
    }
  }
  return results;
};

// --- ROTAS DE API ---

/**
 * Health Check: Verifica status do servidor e tenta acordar a API externa enviando um ping.
 */
app.get(["/api/health", "/health"], asyncHandler(async (req: Request, res: Response) => {
  const { baseUrl } = EXTERNAL_API_CONFIG;
  let externalStatus = "unknown";
  
  try {
    const ping = await pingApi.get(`${baseUrl}/`);
    externalStatus = ping.status < 500 ? "online" : "error";
  } catch (e: any) {
    externalStatus = e.code === 'ECONNABORTED' ? "waking_up" : "offline";
  }

  res.json({ 
    status: "ok", 
    external_api: externalStatus,
    env_set: !!process.env.EXTERNAL_API_URL,
    timestamp: new Date().toISOString()
  });
}));

/**
 * Proxy Omie Direct: Consolida produtos ativos com seus respectivos saldos de estoque.
 */
app.get("/api/omie-direct/products", asyncHandler(async (req: Request, res: Response) => {
  // Busca produtos e estoque em paralelo
  const [rawProductList, stockList] = await Promise.all([
    fetchAllPages('/products'),
    fetchAllPages('/products/stockQuantity')
  ]);

  const productList = rawProductList.filter((p: any) => p.active === true);
  const stockMap = new Map<string, number>();
  
  // Otimização: Mapeamento de estoque para busca O(1)
  stockList.forEach((s: any) => {
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

// --- ROTAS DE API ---
/**
 * Proxy Genérico para v1: Encaminha qualquer requisição /api/v1/* para a API manager.
 */
app.all("/api/v1/*", asyncHandler(async (req: Request, res: Response) => {
  const subPath = (req.params as any)[0];
  const { method, body, url: reqUrl } = req;
  const { baseUrl } = EXTERNAL_API_CONFIG;
  
  const queryString = reqUrl.includes('?') ? reqUrl.substring(reqUrl.indexOf('?')) : '';
  const apiUrl = `${baseUrl}/${subPath}${queryString}`;

  const response = await api({
    method,
    url: apiUrl,
    data: body,
    headers: { 'Content-Type': 'application/json' }
  });
  
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
