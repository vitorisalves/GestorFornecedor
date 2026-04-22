import express from "express";
import axios from "axios";

const app = express();

// Aumenta o tempo limite global do axios (8 segundos para dar margem ao Vercel de 10s)
const api = axios.create({
  timeout: 8000,
  validateStatus: () => true, // Não lança erro automaticamente no catch para status != 200
});

app.use(express.json());

const sanitizeEnv = (val: string | undefined, fallback: string) => {
  if (!val) return fallback;
  return val.trim().replace(/^["']|["']$/g, '');
};

const EXTERNAL_API_CONFIG = {
  base_url: sanitizeEnv(process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, "")
};

// Wrapper para rotas async capturarem erros no Express 4
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- ROTAS DE API ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env_set: !!process.env.EXTERNAL_API_URL });
});

app.get("/api/omie-direct/products", asyncHandler(async (req: any, res: any) => {
  const baseUrl = EXTERNAL_API_CONFIG.base_url;
  
  const fetchAllPages = async (endpoint: string) => {
    // Usamos pageSize 100 para minimizar o número de requests
    const firstUrl = `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=1&pageSize=100`;
    const firstRes = await api.get(firstUrl);
    
    if (firstRes.status >= 400) return [];
    
    const firstData = firstRes.data;
    const results = Array.isArray(firstData) ? [...firstData] : [...(firstData.data || [])];
    
    const meta = firstData.meta || {};
    const total = meta.total || 0;
    const pageSize = meta.pageSize || 100;

    if (total > pageSize) {
      const totalPages = Math.ceil(total / pageSize);
      const pageNumbers = [];
      // Pegamos apenas as páginas restantes
      for (let i = 2; i <= totalPages; i++) pageNumbers.push(i);
      
      // Parallel fetch para ganhar velocidade (mas limitado para não estourar rate limit)
      // Vercel Hobby tem CPU limitada, 5 por vez é seguro
      const batchSize = 5;
      for (let i = 0; i < pageNumbers.length; i += batchSize) {
        const batch = pageNumbers.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (page) => {
          try {
            const res = await api.get(`${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`);
            if (res.status < 400) {
              const d = res.data;
              return Array.isArray(d) ? d : (d.data || []);
            }
          } catch (e) {
            console.error(`Erro na página ${page} de ${endpoint}`);
          }
          return [];
        }));
        batchResults.forEach(list => results.push(...list));
      }
    }
    return results;
  };

  // 1. Inicia busca de produtos e estoque em paralelo para economizar tempo
  const [rawProductList, stockList] = await Promise.all([
    fetchAllPages('/products'),
    fetchAllPages('/products/stockQuantity')
  ]);

  const productList = rawProductList.filter((p: any) => p.active === true);
  const stockMap = new Map<string, number>();
  
  stockList.forEach((s: any) => {
    const code = String(s.productId || s.product_id || s.id || s.codigo || "");
    const qty = Number(s.quantity || s.stock || s.stockQuantity || 0);
    if (code) stockMap.set(code, qty);
  });

  const mergedProducts = productList.map((p: any) => {
    const prodId = String(p.id || p.productId || p.codigo_produto || "").trim();
    let stock = stockMap.has(prodId) ? stockMap.get(prodId)! : -1;
    if (stock === -1) {
      stock = Number(p.stockQuantity || p.quantity || p.stock || p.estoque || 0);
    }

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

app.all("/api/v1/*", asyncHandler(async (req: any, res: any) => {
  const subPath = req.params[0];
  const method = req.method;
  const baseUrl = EXTERNAL_API_CONFIG.base_url;
  const apiUrl = `${baseUrl}/${subPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

  const response = await api({
    method,
    url: apiUrl,
    data: req.body,
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (response.status >= 400 && typeof response.data === 'string') {
    return res.status(response.status).json({ error: response.data || response.statusText });
  }

  res.status(response.status).send(response.data);
}));

// Middleware de tratamento de erros global (para evitar que o Vercel mostre página HTML de erro)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('ERRO GLOBAL NO BACKEND:', err);
  res.status(500).json({ 
    error: 'A server error occurred (Global Handler)',
    message: err.message || 'Erro desconhecido',
    path: req.path
  });
});

export default app;
