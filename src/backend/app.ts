import express, { Request, Response, NextFunction } from "express";
import axios, { AxiosInstance } from "axios";
import webPush from "web-push";
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import Papa from 'papaparse';

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
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1xP5Fk1iBD6a0isS6KF5DMG1ZjMbbLK2FsS6PupZVe6M/export?format=csv";
  
  try {
    const response = await axios.get(SHEET_URL, { responseType: 'text' });
    const csvData = response.data;

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
