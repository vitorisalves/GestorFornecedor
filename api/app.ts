import express, { Request, Response, NextFunction } from "express";
import { initFirebase, fsOps } from "./firebase";
import { EXTERNAL_API_CONFIG, IS_VERCEL, PUSH_CONFIG } from "./config";
import { AIService } from "./backend_services/aiService";
import { PushService } from "./backend_services/pushService";
import { OmieService } from "./backend_services/omieService";
import { ExcelService } from "./backend_services/excelService";
import { XMLService } from "./backend_services/xmlService";
import { startBackgroundReminderWorker } from "./reminderWorker";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- INICIALIZAÇÃO ---
PushService.init();
initFirebase().then(() => {
  if (!IS_VERCEL) {
    startBackgroundReminderWorker();
  }
}).catch(err => console.error("[App] Erro na inicialização:", err));

/**
 * Wrapper para rotas assíncronas capturarem erros.
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[AsyncHandler Error] ${req.method} ${req.url}:`, err);
    next(err);
  });
};

// --- ROTAS DE DIAGNÓSTICO ---
app.get("/api/health", asyncHandler(async (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    config: { baseUrl: EXTERNAL_API_CONFIG.baseUrl }
  });
}));

// --- ROTAS EXCEL / GOOGLE SHEETS ---
app.get("/api/excel-sync", asyncHandler(async (req: Request, res: Response) => {
  const SHEET_ID = "1EarQhvZBT65Ptf-LULWnAfS844WSL7i8mryNRmt-qDY";
  try {
    const data = await ExcelService.syncFromGoogleSheets(SHEET_ID);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}));

// --- ROTAS AI (GEMINI) ---
app.post("/api/ai/match-dashboard", asyncHandler(async (req: Request, res: Response) => {
  const { spreadsheetNames, shoppingItemNames } = req.body;
  const mapping = await AIService.matchDashboard(spreadsheetNames, shoppingItemNames);
  res.json({ mapping });
}));

app.post("/api/ai/process-document", asyncHandler(async (req: Request, res: Response) => {
  const { fileData, promptText, existingProductNames } = req.body;
  const products = await AIService.processDocument(fileData, promptText, existingProductNames);
  res.json(products);
}));

// --- ROTAS XML ---
const xmlService = new XMLService();
app.post("/api/xml/process", asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log("[API/XML] Recebida requisição para processar XML...");
  const { xmlData } = req.body;
  if (!xmlData) {
    return res.status(400).json({ error: "Dados inválidos", message: "O conteúdo XML da nota fiscal não foi enviado." });
  }

  try {
    console.log(`[API/XML] Tamanho do XML recebido: ${(xmlData.length / 1024).toFixed(2)} KB`);
    const parsedData = xmlService.parseNFe(xmlData);
    console.log(`[API/XML] XML parseado com sucesso. ID da Nota: ${parsedData?.id}`);
    
    if (!parsedData || !parsedData.id) {
      throw new Error("O parser falhou em identificar e extrair a Chave/ID da Nota Fiscal.");
    }

    // Salva no Firestore
    const docRef = fsOps.doc('invoices', parsedData.id);
    const docSnapshot = await fsOps.getDoc(docRef);

    const exists = typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : !!docSnapshot.exists;
    
    await fsOps.set(docRef, parsedData, 'invoices/' + parsedData.id);
    
    const duration = Date.now() - startTime;
    console.log(`[API/XML] Processamento do XML finalizado em ${duration}ms. Status: ${exists ? 'updated' : 'imported'}`);
    res.json({ status: exists ? 'updated' : 'imported', id: parsedData.id });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("[Vercel-NFe-Diagnostic] Erro ao processar ou salvar nota no Firestore após " + duration + "ms.");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);

    res.status(500).json({
      error: "Erro no processamento do XML",
      message: "Não foi possível carregar ou registrar esta nota fiscal no banco.",
      details: error.message,
      code: error.code || "INTERNAL_PROCESSING_ERROR",
      durationMs: duration
    });
  }
}));

app.get("/api/xml/invoices", asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log("[API/XML] Iniciando busca das faturas (invoices) no Firestore...");
  
  try {
    const snapshot = await fsOps.getDocs('invoices', 'invoices');
    
    if (!snapshot || !snapshot.docs) {
      console.warn("[API/XML] Snapshot recebido vazio ou nulo.");
      return res.json([]);
    }

    console.log(`[API/XML] Consulta bem-sucedida! Encontrados ${snapshot.docs.length} documentos.`);
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });

    const duration = Date.now() - startTime;
    console.log(`[API/XML] Faturas mapeadas e enviadas em ${duration}ms.`);
    res.json(data);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("[Vercel-Invoices-Diagnostic] Falha catastrófica ao sincronizar faturas no Vercel após " + duration + "ms:");
    console.error("Mensagem de Erro:", error.message);
    console.error("Erro Code:", error.code);
    console.error("Stack Trace:", error.stack);

    res.status(500).json({
      error: "Falha de comunicação com o Banco de Dados",
      message: "O servidor de banco de dados do Firebase demorou muito para responder ou recusou as credenciais.",
      details: error.message,
      code: error.code || "DATABASE_FETCH_ERROR",
      durationMs: duration,
      help: "Verifique se o Firestore está ativo e as regras de segurança permitem requisições."
    });
  }
}));

app.post("/api/xml/invoices/delete", asyncHandler(async (req: Request, res: Response) => {
  console.log("Request body:", req.body);
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ status: 'error', error: 'ID not provided' });
  }
  console.log("Backend deleting invoice ID:", id);
  
  const docRef = fsOps.doc('invoices', id);
  const docSnapshot = await fsOps.getDoc(docRef, 'invoices/' + id);
  const exists = typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : !!docSnapshot.exists;
  console.log("Doc exists before delete:", exists);

  if (exists) {
    await fsOps.delete(docRef, 'invoices/' + id);
    res.json({ status: 'deleted' });
  } else {
    res.status(404).json({ status: 'error', error: 'Document not found' });
  }
}));

// --- ROTAS DE NOTIFICAÇÃO ---
app.get("/api/notifications/vapid-key", (req, res) => {
  res.json({ publicKey: PUSH_CONFIG.publicKey });
});

app.post("/api/notifications/subscribe", asyncHandler(async (req: Request, res: Response) => {
  const subscription = req.body;
  const docId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
  await fsOps.set(fsOps.doc('push_subscriptions', docId), {
    ...subscription,
    updatedAt: new Date().toISOString()
  });
  res.status(201).json({ status: "subscribed" });
}));

app.post("/api/notifications/broadcast", asyncHandler(async (req: Request, res: Response) => {
  const { title, message, url } = req.body;
  const count = await PushService.broadcast(title || "Aviso", message || "Novidade!", url);
  res.json({ sent_to: count });
}));

// --- ROTAS OMIE / PROXY ---
app.get("/api/omie-direct/products", asyncHandler(async (req: Request, res: Response) => {
  const [productList, stockList] = await Promise.all([
    OmieService.fetchAllPages('/omie/products'),
    OmieService.fetchAllPages('/omie/products/stockQuantity')
  ]);

  const stockMap = new Map<string, number>();
  stockList.forEach((s: any) => {
    const code = String(s.productId || s.product_id || s.id || "");
    if (code) stockMap.set(code, Number(s.quantity || 0));
  });

  const merged = productList.filter(p => p.active !== false).map((p: any) => ({
    id: p.id,
    descricao: p.name || p.descricao,
    unidade: p.unit || 'UN',
    valor_unitario: p.price || 0,
    stock: stockMap.get(String(p.id)) || 0
  }));

  res.json({ data: merged });
}));

app.all("/api/v1/*", asyncHandler(async (req: Request, res: Response) => {
  const subPath = (req.params as any)[0];
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const response = await OmieService.proxyRequest(req.method, subPath, req.body, queryString);
  
  if (response.status >= 400 && typeof response.data === 'string') {
    return res.status(response.status).json({ error: response.data });
  }
  res.status(response.status).send(response.data);
}));

// --- TRATAMENTO DE ERROS ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ErrorHandler]', err.message);
  
  // Se for erro de timeout ou conexão do axios/ai
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return res.status(504).json({
      error: 'Timeout na requisição',
      message: 'O servidor demorou muito para responder. Tente novamente com um arquivo menor.'
    });
  }

  res.status(err.status || 500).json({ 
    error: err.name || 'Erro no servidor',
    message: err.message || 'Ocorreu um erro inesperado.'
  });
});

export default app;
