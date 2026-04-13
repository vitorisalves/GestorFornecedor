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

  // --- ROTAS DE API ---
  // Rota de verificação de saúde do servidor.
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy para a API da Omie para evitar problemas de CORS no frontend
  app.all("/api/omie/*", async (req, res) => {
    try {
      const subPath = req.params[0] || '';
      const method = req.method;
      const baseUrl = 'https://production-manager-api.onrender.com/v1';
      
      // Constrói a URL final
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'url') {
          queryParams.append(key, value as string);
        }
      }

      let apiUrl = req.query.url as string;
      if (!apiUrl) {
        // Se não houver URL explícita, monta usando a base + subpath
        apiUrl = `${baseUrl}/${subPath}`;
      }

      const queryString = queryParams.toString();
      if (queryString) {
        apiUrl += (apiUrl.includes('?') ? '&' : '?') + queryString;
      }

      console.log(`Proxying ${method} to: ${apiUrl}`);

      const fetchOptions: RequestInit = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        // Se o corpo estiver vazio, enviamos um objeto vazio para evitar erro FST_ERR_CTP_EMPTY_JSON_BODY na API de destino
        fetchOptions.body = JSON.stringify(req.body && Object.keys(req.body).length > 0 ? req.body : {});
      }

      const response = await fetch(apiUrl, fetchOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Erro na API Omie: ${errorText || response.statusText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Erro no proxy Omie:', error);
      res.status(500).json({ error: 'Erro interno no proxy Omie' });
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
