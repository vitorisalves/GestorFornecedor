import express, { Request, Response, NextFunction } from "express";
import { initFirebase, fsOps } from "./firebase";
import { EXTERNAL_API_CONFIG, IS_VERCEL, PUSH_CONFIG } from "./config";
import { AIService } from "./services/aiService";
import { PushService } from "./services/pushService";
import { OmieService } from "./services/omieService";
import { ExcelService } from "./services/excelService";
import { XMLService } from "./services/xmlService";
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
  const { xmlData } = req.body;
  const parsedData = xmlService.parseNFe(xmlData);
  
  // 1. Busca faturas existentes para comparação antes de salvar o novo XML
  let existingInvoices: any[] = [];
  try {
    const snapshot = await fsOps.getDocs('invoices', 'invoices');
    existingInvoices = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
  } catch (e) {
    console.error("Erro ao buscar faturas anteriores para comparação de preços:", e);
  }

  // 2. Salva no Firestore
  const docRef = fsOps.doc('invoices', parsedData.id);
  const docSnapshot = await fsOps.getDoc(docRef);

  const exists = typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : !!docSnapshot.exists;
  
  await fsOps.set(docRef, parsedData, 'invoices/' + parsedData.id);
  fsOps.invalidateCache('xml_spendings'); // Invalida o cache de gastos XML, pois um novo arquivo foi inserido
  fsOps.invalidateCache('invoices'); // Invalida o cache de faturas, pois uma nova fatura foi importada
  
  // 3. Comparação de preços dos produtos da nota atual com as compras anteriores
  const currentInvoiceId = parsedData.id;
  const currentInvoiceDate = parsedData.date || new Date().toISOString();
  const currentProducts = parsedData.products || [];

  for (const prod of currentProducts) {
    if (!prod.name || prod.name === 'N/A') continue;

    const normName = prod.name.trim().toLowerCase();
    const prodCode = prod.code || 'N/A';

    // Procura por compras anteriores do mesmo produto
    const previousPurchases: { date: string; price: number; supplierName: string }[] = [];

    existingInvoices.forEach(inv => {
      if (inv.id === currentInvoiceId) return; // ignora a nota atual
      if (!Array.isArray(inv.products)) return;

      inv.products.forEach((p: any) => {
        if (!p.name || p.name === 'N/A') return;
        const otherNormName = p.name.trim().toLowerCase();
        const otherCode = p.code || 'N/A';

        const isMatch = (prodCode !== 'N/A' && prodCode === otherCode) || (normName === otherNormName);
        if (isMatch) {
          const price = Number(p.vUnCom || p.price || p.vUnTrib || 0);
          if (price > 0) {
            previousPurchases.push({
              date: inv.date || '2026-06-19T00:00:00Z',
              price,
              supplierName: inv.supplierName || 'Desconhecido'
            });
          }
        }
      });
    });

    if (previousPurchases.length > 0) {
      // Ordena de forma cronológica crescente para pegar a última compra anterior
      previousPurchases.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const lastPrevious = previousPurchases[previousPurchases.length - 1];

      const oldPrice = lastPrevious.price;
      const newPrice = Number(prod.vUnCom || prod.price || prod.vUnTrib || 0);

      if (newPrice > oldPrice) {
        // Preço subiu!
        const percentIncrease = ((newPrice - oldPrice) / oldPrice) * 100;
        const increaseId = `${currentInvoiceId}_${prodCode !== 'N/A' ? prodCode : prod.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const priceIncreaseDoc = {
          id: increaseId,
          productName: prod.name,
          productCode: prodCode,
          supplierName: parsedData.supplierName || 'Desconhecido',
          oldPrice,
          newPrice,
          percentIncrease,
          invoiceId: currentInvoiceId,
          invoiceDate: currentInvoiceDate,
          alreadyImported: exists, // marca se a nota já foi importada anteriormente
          createdAt: new Date().toISOString()
        };

        // Salva o alerta de aumento de preço no Firestore
        const piRef = fsOps.doc('price_increases', increaseId);
        await fsOps.set(piRef, priceIncreaseDoc, 'price_increases/' + increaseId);
        fsOps.invalidateCache('price_increases');

        // Gera e dispara uma notificação push informando o aumento
        try {
          const formattedOld = oldPrice.toFixed(2);
          const formattedNew = newPrice.toFixed(2);
          const formattedPercent = percentIncrease.toFixed(1);
          await PushService.broadcast(
            "Alerta de Aumento de Preço",
            `O produto "${prod.name}" subiu de R$ ${formattedOld} para R$ ${formattedNew} (+${formattedPercent}%)!`,
            "/dashboard"
          );
        } catch (pushErr) {
          console.warn("Erro ao enviar notificação de aumento de preço:", pushErr);
        }
      }
    }
  }
  
  res.json({ status: exists ? 'updated' : 'imported', id: parsedData.id });
}));

app.get("/api/xml/price-increases", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('price_increases', 'price_increases', true);
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    data.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching price increases:", error);
    res.status(500).json({ error: "Error fetching price increases", message: error.message });
  }
}));

app.post("/api/xml/price-increases/delete", asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Format or list of IDs is invalid" });
  }

  for (const id of ids) {
    const docRef = fsOps.doc('price_increases', id);
    await fsOps.delete(docRef, 'price_increases/' + id);
  }
  fsOps.invalidateCache('price_increases');
  res.json({ status: "success", deletedCount: ids.length });
}));

app.get("/api/xml/invoices", asyncHandler(async (req: Request, res: Response) => {
  console.log("Fetching invoices...");
  try {
    const snapshot = await fsOps.getDocs('invoices', 'invoices');
    console.log("Got snapshot, found docs:", snapshot?.docs?.length);
    if (!snapshot || !snapshot.docs) {
      throw new Error("Snapshot or snapshot.docs is undefined");
    }
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      error: "Error fetching invoices",
      message: error?.message || String(error),
      code: error?.code || "",
      stack: error?.stack || ""
    });
  }
}));

app.get("/api/xml/suppliers", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('suppliers', 'suppliers');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached suppliers:", error);
    res.status(500).json({ error: "Error fetching suppliers", message: error.message });
  }
}));

app.get("/api/xml/authorized_users", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('authorized_users', 'authorized_users');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached authorized_users:", error);
    res.status(500).json({ error: "Error fetching authorized users", message: error.message });
  }
}));

app.get("/api/xml/spendings", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('xml_spendings', 'xml_spendings');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached spendings:", error);
    res.status(500).json({ error: "Error fetching spendings", message: error.message });
  }
}));

app.get("/api/xml/categories", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('categories', 'categories');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached categories:", error);
    res.status(500).json({ error: "Error fetching categories", message: error.message });
  }
}));

app.get("/api/xml/delivered_products", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('delivered_products', 'delivered_products');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached delivered_products:", error);
    res.status(500).json({ error: "Error fetching delivered products", message: error.message });
  }
}));

app.get("/api/xml/reminders", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('reminders', 'reminders');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached reminders:", error);
    res.status(500).json({ error: "Error fetching reminders", message: error.message });
  }
}));

app.get("/api/xml/shopping_lists", asyncHandler(async (req: Request, res: Response) => {
  try {
    const snapshot = await fsOps.getDocs('shopping_lists', 'shopping_lists');
    const data = snapshot.docs.map((doc: any) => {
      const d = typeof doc.data === 'function' ? doc.data() : doc.data;
      return { id: doc.id, ...d };
    });
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching cached shopping_lists:", error);
    res.status(500).json({ error: "Error fetching shopping lists", message: error.message });
  }
}));

app.post("/api/xml/cache/invalidate", asyncHandler(async (req: Request, res: Response) => {
  const { collection } = req.body;
  if (collection) {
    fsOps.invalidateCache(collection);
    console.log(`[Cache Invalidation] Invalidated cache for collection: ${collection}`);
    res.json({ status: 'ok', collection });
  } else {
    res.status(400).json({ error: 'Collection not specified' });
  }
}));

// --- AUXILIAR DE DELEÇÃO DE FATURA ---
const deleteInvoiceHelper = async (id: string, res: Response) => {
  if (!id) {
    return res.status(400).json({ status: 'error', error: 'ID not provided' });
  }
  console.log("Backend deleting invoice ID:", id);

  // Tenta com o ID fornecido direto
  let docRef = await fsOps.doc('invoices', id);
  let docSnapshot = await fsOps.getDoc(docRef, 'invoices/' + id);
  let exists = typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : !!docSnapshot.exists;

  // Se não existe e não começa com 'NFe', tenta adicionar o prefixo 'NFe'
  if (!exists && !id.startsWith('NFe')) {
    const alternativeId = 'NFe' + id;
    console.log(`ID ${id} não encontrado. Tentando ID alternativo: ${alternativeId}`);
    docRef = await fsOps.doc('invoices', alternativeId);
    docSnapshot = await fsOps.getDoc(docRef, 'invoices/' + alternativeId);
    exists = typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : !!docSnapshot.exists;
  }

  // Se começou com 'NFe' e não encontrou, tenta remover o prefixo 'NFe'
  if (!exists && id.startsWith('NFe')) {
    const alternativeId = id.substring(3);
    console.log(`ID ${id} não encontrado. Tentando ID alternativo sem NFe: ${alternativeId}`);
    docRef = await fsOps.doc('invoices', alternativeId);
    docSnapshot = await fsOps.getDoc(docRef, 'invoices/' + alternativeId);
    exists = typeof docSnapshot.exists === 'function' ? docSnapshot.exists() : !!docSnapshot.exists;
  }

  const finalId = docSnapshot.id || id;
  console.log(`Doc exists at final ID ${finalId} before delete:`, exists);

  if (exists) {
    await fsOps.delete(docRef, 'invoices/' + finalId);
    fsOps.invalidateCache('xml_spendings'); // Invalida o cache de gastos também
    fsOps.invalidateCache('invoices'); // Invalida o cache de faturas também
    res.json({ status: 'deleted', id: finalId });
  } else {
    // Retornamos 200/sucesso mesmo se não encontrar para evitar quebrar o fluxo do frontend de forma destrutiva
    res.json({ status: 'not_found', message: `Invoice ${id} not found but checked.` });
  }
};

app.post("/api/xml/invoices/delete", asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.body;
  await deleteInvoiceHelper(id, res);
}));

app.delete("/api/xml/invoices/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  await deleteInvoiceHelper(id, res);
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
