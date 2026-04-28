import express, { Request, Response, NextFunction } from "express";
import axios, { AxiosInstance } from "axios";
import webPush from "web-push";

// Configuração Web Push
const vapidKeys = webPush.generateVAPIDKeys();
webPush.setVapidDetails(
  'mailto:vitorisalves1@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Armazenamento temporário de assinaturas (Em produção, use um Banco de Dados)
let subscriptions: any[] = [];

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
  res.json({ publicKey: vapidKeys.publicKey });
});

/**
 * Salva uma nova assinatura de Push.
 */
app.post("/api/notifications/subscribe", (req, res) => {
  const subscription = req.body;
  
  // Evita duplicatas simples
  if (!subscriptions.find(s => s.endpoint === subscription.endpoint)) {
    subscriptions.push(subscription);
  }
  
  res.status(201).json({ status: "subscribed" });
});

/**
 * Endpoint para disparar notificações para todos os dispositivos inscritos (teste/uso interno).
 */
app.post("/api/notifications/broadcast", asyncHandler(async (req: Request, res: Response) => {
  const { title, message, url } = req.body;
  
  const payload = JSON.stringify({
    title: title || "Gestor Fornecedores",
    body: message || "Nova atualização!",
    url: url || "/"
  });

  const promises = subscriptions.map(sub => 
    webPush.sendNotification(sub, payload).catch(err => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Remove assinaturas expiradas/inválidas
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
      }
      console.error("Erro ao enviar push:", err);
    })
  );

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
          console.error(`[FetchBatchError] Falha na página ${page} de ${endpoint}`);
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
  console.error('[GlobalErrorHandler]', err);
  res.status(500).json({ 
    error: 'A server error occurred (Global Handler)',
    message: err.message || 'Erro desconhecido',
    path: req.path
  });
});

export default app;
