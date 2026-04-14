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

  // Configurações do Omie (podem ser passadas via env ou fixas para teste)
  const sanitizeEnv = (val: string | undefined, fallback: string) => {
    if (!val) return fallback;
    return val.trim().replace(/^["']|["']$/g, '');
  };

  const OMIE_CONFIG = {
    app_key: sanitizeEnv(process.env.OMIE_APP_KEY, "3830837835825"),
    app_secret: sanitizeEnv(process.env.OMIE_APP_SECRET, "fa30baf859eaf8a1f0b1e7b209013775"),
    base_url: sanitizeEnv(process.env.OMIE_BASE_URL, "https://app.omie.com.br/api/v1").replace(/\/$/, "")
  };

  // --- ROTAS DE API ---
  // Rota de verificação de saúde do servidor.
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- ROTA DIRETA OMIE (TESTE) ---
  app.get("/api/omie-direct/products", async (req, res) => {
    try {
      console.log("--- INICIANDO CHAMADA DIRETA OMIE ---");
      console.log("Config:", { app_key: OMIE_CONFIG.app_key, base_url: OMIE_CONFIG.base_url });
      
      // 1. Buscar Produtos
      const productsUrl = `${OMIE_CONFIG.base_url}/geral/produtos/`;
      console.log(`Chamando Omie Produtos: "${productsUrl}" (length: ${productsUrl.length})`);
      
      const productsResponse = await fetch(productsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: "ListarProdutos",
          app_key: OMIE_CONFIG.app_key,
          app_secret: OMIE_CONFIG.app_secret,
          param: [{
            pagina: 1,
            registros_por_pagina: 500
          }]
        })
      });

      if (!productsResponse.ok) {
        const errText = await productsResponse.text();
        console.error("Erro HTTP na API Omie (Produtos):", productsResponse.status, errText);
        return res.status(productsResponse.status).json({ error: `Erro Omie Produtos: ${errText}` });
      }

      const productsData: any = await productsResponse.json();
      
      if (productsData.faultstring) {
        console.error("Falha Omie (Produtos):", productsData.faultstring);
        return res.status(400).json({ error: productsData.faultstring });
      }

      // Omie pode retornar em 'produto_servico_cadastro' ou 'produto_servico_list'
      const productList = productsData.produto_servico_cadastro || productsData.produto_servico_list || [];
      console.log(`Encontrados ${productList.length} produtos.`);

      // 2. Buscar Estoque (Usando PosicaoEstoque para saldo atual consolidado)
      console.log("Buscando posição de estoque atual...");
      let stockList: any[] = [];
      try {
        // O endpoint correto para PosicaoEstoque geralmente é /estoque/consulta/
        const stockPosUrl = `${OMIE_CONFIG.base_url}/estoque/consulta/`;
        const now = new Date();
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const y = now.getFullYear();
        const dateStr = `${d}/${m}/${y}`;
        
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const ss = now.getSeconds().toString().padStart(2, '0');
        const timeStr = `${hh}:${mm}:${ss}`;

        const stockResponse = await fetch(stockPosUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call: "PosicaoEstoque",
            app_key: OMIE_CONFIG.app_key,
            app_secret: OMIE_CONFIG.app_secret,
            param: [{
              data: dateStr
            }]
          })
        });

        if (stockResponse.ok) {
          const stockData: any = await stockResponse.json();
          if (stockData.faultstring) {
            console.warn("Aviso na PosicaoEstoque:", stockData.faultstring);
          }
          // PosicaoEstoque retorna em 'listaPosicaoEstoque'
          stockList = stockData.listaPosicaoEstoque || [];
          console.log(`Encontrados ${stockList.length} registros na Posição de Estoque.`);
        } else {
          const errText = await stockResponse.text();
          console.error("Erro ao chamar PosicaoEstoque:", stockResponse.status, errText);
        }

        // Se PosicaoEstoque falhar ou vier vazio, tenta o ListarEstoque como fallback
        if (stockList.length === 0) {
          console.log("PosicaoEstoque vazio ou falhou, tentando ListarEstoque (Multi-página)...");
          const stockUrl = `${OMIE_CONFIG.base_url}/estoque/consulta/`;
          
          const fetchStockPage = async (page: number) => {
            try {
              const response = await fetch(stockUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  call: "ListarEstoque",
                  app_key: OMIE_CONFIG.app_key,
                  app_secret: OMIE_CONFIG.app_secret,
                  param: [{
                    pagina: page,
                    registros_por_pagina: 500,
                    cExibirTodos: "S",
                    dDataPosicao: dateStr
                  }]
                })
              });
              if (response.ok) return await response.json();
            } catch (e) {
              console.error(`Erro ao buscar página ${page} de estoque:`, e);
            }
            return null;
          };

          const pagesToFetch = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
          const stockResults = await Promise.all(pagesToFetch.map(p => fetchStockPage(p)));
          
          stockResults.forEach((data, index) => {
            if (data && data.estoque_list) {
              stockList.push(...data.estoque_list);
              console.log(`Página ${index + 1} de ListarEstoque: ${data.estoque_list.length} registros.`);
            }
          });
        }
      } catch (stockErr) {
        console.warn("Erro crítico ao buscar estoque:", stockErr);
      }

      // 3. ObterEstoqueProduto (Mais preciso para estoque individual)
      console.log("Consultando estoque individual (ObterEstoqueProduto) para os primeiros 15 itens...");
      const topProducts = productList.slice(0, 15);
      
      const fetchIndividualStock = async (p: any) => {
        try {
          const stockResUrl = `${OMIE_CONFIG.base_url}/estoque/resumo/`;
          const now = new Date();
          const d = now.getDate().toString().padStart(2, '0');
          const m = (now.getMonth() + 1).toString().padStart(2, '0');
          const y = now.getFullYear();
          const dateStr = `${d}/${m}/${y}`;

          const response = await fetch(stockResUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call: "ObterEstoqueProduto",
              app_key: OMIE_CONFIG.app_key,
              app_secret: OMIE_CONFIG.app_secret,
              param: [{ 
                nIdProduto: p.codigo_produto,
                dDia: dateStr
              }]
            })
          });

          if (response.ok) {
            const data: any = await response.json();
            // ObterEstoqueProduto retorna 'listaEstoqueArray'
            if (data && data.listaEstoqueArray) {
              const total = data.listaEstoqueArray.reduce((acc: number, curr: any) => acc + Number(curr.quantidade_estoque || 0), 0);
              return { id: p.codigo_produto, stock: total };
            }
          }
        } catch (e) {
          console.error(`Erro ao consultar estoque do produto ${p.codigo_produto}:`, e);
        }
        return null;
      };

      const individualStocks = await Promise.all(topProducts.map(p => fetchIndividualStock(p)));
      const individualStockMap = new Map<string, number>();
      individualStocks.forEach(item => {
        if (item) individualStockMap.set(String(item.id), item.stock);
      });

      // 4. Mesclar Dados
      const stockMap = new Map<string, number>();
      
      stockList.forEach((s: any) => {
        // Mapeia códigos possíveis tanto de PosicaoEstoque quanto de ListarEstoque
        const codes = [
          s.codigo_produto, 
          s.cCodProd, 
          s.cCodProdInt,
          s.codigo_produto_integracao, 
          s.codigo,
          s.codInt,
          s.codigo_item
        ].filter(c => c !== undefined && c !== null && c !== "");

        // Quantidade (nSaldo para ListarEstoque, estoque para PosicaoEstoque)
        const qty = Number(
          s.estoque ?? 
          s.nSaldo ?? 
          s.estoque_fisico ?? 
          s.quantidade ?? 
          s.saldo ?? 
          s.nSaldoFisico ?? 
          0
        );

        codes.forEach(code => {
          const codeStr = String(code).trim();
          if (codeStr) {
            const current = stockMap.get(codeStr) || 0;
            stockMap.set(codeStr, current + qty);
          }
        });
      });

      console.log(`Mapa de estoque criado com ${stockMap.size} chaves únicas.`);
      
      const mergedProducts = productList.map((p: any) => {
        const prodId = String(p.codigo_produto || "").trim();
        const prodCode = String(p.codigo || "").trim();
        const prodInt = String(p.codigo_produto_integracao || "").trim();
        
        // Prioridade 1: ObterEstoqueProduto (mais preciso)
        let stock = -1;
        if (prodId && individualStockMap.has(prodId)) {
          stock = individualStockMap.get(prodId)!;
        }
        
        // Prioridade 2: Mapa de estoque bulk (PosicaoEstoque / ListarEstoque)
        if (stock === -1) {
          if (prodId && stockMap.has(prodId)) {
            stock = stockMap.get(prodId)!;
          } else if (prodCode && stockMap.has(prodCode)) {
            stock = stockMap.get(prodCode)!;
          } else if (prodInt && stockMap.has(prodInt)) {
            stock = stockMap.get(prodInt)!;
          } else {
            // Fallback final: campo de estoque que vem no próprio cadastro (se houver)
            stock = Number(p.quantidade_estoque ?? p.estoque_atual ?? 0);
          }
        }

        return {
          codigo_produto: p.codigo_produto,
          descricao: p.descricao,
          unidade: p.unidade,
          valor_unitario: p.valor_unitario,
          stock: stock,
          estoque_fisico: stock,
          codigo: p.codigo,
          codigo_familia: p.codigo_familia,
          descricao_familia: p.descricao_familia
        };
      });

      console.log("Envio de dados mesclados concluído. Total:", mergedProducts.length);
      res.json({ data: mergedProducts });
    } catch (error: any) {
      console.error("Erro CRÍTICO na chamada direta Omie:", error);
      res.status(500).json({ error: error.message || "Erro interno ao processar chamada Omie" });
    }
  });

  // Proxy genérico para a API de Produção
  app.all("/api/v1/*", async (req, res) => {
    try {
      const subPath = req.params[0];
      const method = req.method;
      const baseUrl = 'https://production-manager-api.onrender.com/v1';
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
