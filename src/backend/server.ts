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

  // --- ROTAS DE API ---
  // Rota de verificação de saúde do servidor.
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
