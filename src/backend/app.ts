import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

const sanitizeEnv = (val: string | undefined, fallback: string) => {
  if (!val) return fallback;
  return val.trim().replace(/^["']|["']$/g, '');
};

const EXTERNAL_API_CONFIG = {
  base_url: sanitizeEnv(process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, "")
};

// --- ROTAS DE API ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/omie-direct/products", async (req, res) => {
  try {
    const baseUrl = EXTERNAL_API_CONFIG.base_url;
    
    const fetchAllPages = async (endpoint: string) => {
      const firstUrl = `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=1&pageSize=50`;
      const firstRes = await fetch(firstUrl);
      if (!firstRes.ok) return [];
      
      const firstData: any = await firstRes.json();
      const results = Array.isArray(firstData) ? [...firstData] : [...(firstData.data || [])];
      
      if (firstData.meta && firstData.meta.total && firstData.meta.total > (firstData.meta.pageSize || 50)) {
        const total = firstData.meta.total;
        const pageSize = firstData.meta.pageSize || 50;
        const totalPages = Math.ceil(total / pageSize);
        
        const pageNumbers = [];
        for (let i = 2; i <= totalPages; i++) pageNumbers.push(i);
        
        const batchSize = 5;
        for (let i = 0; i < pageNumbers.length; i += batchSize) {
          const batch = pageNumbers.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(async (page) => {
            try {
              const res = await fetch(`${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`);
              if (res.ok) {
                const d = await res.json();
                return Array.isArray(d) ? d : (d.data || []);
              }
            } catch (e) {
              console.error(`Erro na página ${page} de ${endpoint}:`, e);
            }
            return [];
          }));
          batchResults.forEach(list => results.push(...list));
        }
      }
      return results;
    };

    const rawProductList = await fetchAllPages('/products');
    const productList = rawProductList.filter((p: any) => p.active === true);

    let stockMap = new Map<string, number>();
    try {
      const stockList = await fetchAllPages('/products/stockQuantity');
      stockList.forEach((s: any) => {
        const code = s.productId || s.product_id || s.id || s.codigo;
        const qty = Number(s.quantity || s.stock || s.stockQuantity || 0);
        if (code) stockMap.set(String(code), qty);
      });
    } catch (stockErr) {
      console.warn("Erro ao buscar estoque completo:", stockErr);
    }

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
        stock: stock,
        estoque_fisico: stock,
        codigo: p.sku || p.codigo,
        codigo_familia: p.familyId || p.codigo_familia,
        descricao_familia: p.familyName || p.descricao_familia
      };
    });

    res.json({ data: mergedProducts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro interno ao processar chamada da API" });
  }
});

app.all("/api/v1/*", async (req, res) => {
  try {
    const subPath = req.params[0];
    const method = req.method;
    const baseUrl = EXTERNAL_API_CONFIG.base_url;
    const apiUrl = `${baseUrl}/${subPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    const fetchOptions: RequestInit = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = JSON.stringify(req.body && Object.keys(req.body).length > 0 ? req.body : {});
    }

    const response = await fetch(apiUrl, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        errorJson = { error: errorText || response.statusText };
      }
      return res.status(response.status).json(errorJson);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no proxy da API' });
  }
});

export default app;
