import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// --- CONFIGURAÇÃO DE CAMINHOS ---
// Define __dirname em ambiente ESM para resolução de caminhos de arquivos.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para parsear JSON no corpo das requisições
  app.use(express.json());

  // Configurações da API Externa (podem ser passadas via env ou fixas para teste)
  const sanitizeEnv = (val: string | undefined, fallback: string) => {
    if (!val) return fallback;
    return val.trim().replace(/^["']|["']$/g, '');
  };

  const EXTERNAL_API_CONFIG = {
    base_url: sanitizeEnv(process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, "")
  };

  // --- ROTAS DE API ---
  // Rota de verificação de saúde do servidor.
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- ROTA DIRETA PRODUTOS (NOVA API) ---
  app.get("/api/omie-direct/products", async (req, res) => {
    try {
      console.log("--- INICIANDO CHAMADA NOVA API (FULL FETCH) ---");
      const baseUrl = EXTERNAL_API_CONFIG.base_url;
      
      // Helper para buscar todas as páginas de um endpoint
      const fetchAllPages = async (endpoint: string) => {
        console.log(`Buscando todas as páginas de: ${endpoint}`);
        const firstUrl = `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=1&pageSize=50`;
        const firstRes = await fetch(firstUrl);
        if (!firstRes.ok) return [];
        
        const firstData: any = await firstRes.json();
        const results = Array.isArray(firstData) ? [...firstData] : [...(firstData.data || [])];
        
        if (firstData.meta && firstData.meta.total && firstData.meta.total > (firstData.meta.pageSize || 50)) {
          const total = firstData.meta.total;
          const pageSize = firstData.meta.pageSize || 50;
          const totalPages = Math.ceil(total / pageSize);
          console.log(`Detectadas ${totalPages} páginas para ${endpoint}. Buscando restantes...`);
          
          const pageNumbers = [];
          for (let i = 2; i <= totalPages; i++) pageNumbers.push(i);
          
          // Busca em lotes de 5 para não sobrecarregar
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

      // 1. Buscar Todos os Produtos
      const rawProductList = await fetchAllPages('/products');
      
      // Filtra apenas produtos ativos
      const productList = rawProductList.filter((p: any) => p.active === true);
      console.log(`Total: ${rawProductList.length} produtos. Ativos: ${productList.length}.`);

      // 2. Buscar Todo o Estoque
      console.log("Buscando posição de estoque completa...");
      let stockMap = new Map<string, number>();
      try {
        const stockList = await fetchAllPages('/products/stockQuantity');
        
        stockList.forEach((s: any) => {
          const code = s.productId || s.product_id || s.id || s.codigo;
          const qty = Number(s.quantity || s.stock || s.stockQuantity || 0);
          if (code) {
            stockMap.set(String(code), qty);
          }
        });
        console.log(`Mapa de estoque criado com ${stockMap.size} registros.`);
      } catch (stockErr) {
        console.warn("Erro ao buscar estoque completo:", stockErr);
      }

      // 3. Mesclar Dados
      const mergedProducts = productList.map((p: any) => {
        const prodId = String(p.id || p.productId || p.codigo_produto || "").trim();
        
        // Prioridade 1: Mapa de estoque do endpoint stockQuantity
        let stock = stockMap.has(prodId) ? stockMap.get(prodId)! : -1;
        
        // Prioridade 2: Campo interno do próprio produto
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

      console.log("Envio de dados concluído. Total mesclado:", mergedProducts.length);
      res.json({ data: mergedProducts });
    } catch (error: any) {
      console.error("Erro CRÍTICO na chamada da API:", error);
      res.status(500).json({ error: error.message || "Erro interno ao processar chamada da API" });
    }
  });

  // Proxy genérico para a API de Produção
  app.all("/api/v1/*", async (req, res) => {
    try {
      const subPath = req.params[0];
      const method = req.method;
      const baseUrl = EXTERNAL_API_CONFIG.base_url;
      const apiUrl = `${baseUrl}/${subPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

      console.log(`Proxying ${method} to: ${apiUrl}`);

      const fetchOptions: RequestInit = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
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
      console.error('Erro no proxy API:', error);
      res.status(500).json({ error: 'Erro interno no proxy da API' });
    }
  });

  // --- MIDDLEWARE VITE / SERVIDO DE ARQUIVOS ESTÁTICOS ---
  // Configura o Vite para desenvolvimento ou serve a pasta 'dist' em produção.
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- INICIALIZAÇÃO DO SERVIDOR ---
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
