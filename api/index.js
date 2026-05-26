// src/backend/app.ts
import express from "express";

// src/backend/firebase.ts
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore/lite";
import { initializeApp, getApps, getApp } from "firebase/app";

// src/backend/config.ts
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var HARDCODED_FIREBASE_FALLBACK = {
  "projectId": "gen-lang-client-0797058892",
  "appId": "1:537926473295:web:ace7767bebec90f352bc3a",
  "apiKey": "AIzaSyB_aiE9vxewLqthVwg_hKHwOjKXHnS5jB0",
  "authDomain": "gen-lang-client-0797058892.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-bed5d8c6-de22-4942-9608-255e065ea8fb",
  "storageBucket": "gen-lang-client-0797058892.firebasestorage.app",
  "messagingSenderId": "537926473295",
  "measurementId": ""
};
var getFileFirebaseConfig = () => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.warn("[Config] Erro ao ler firebase-applet-config.json diretamente do cwd:", e);
  }
  try {
    if (typeof import.meta !== "undefined" && import.meta && import.meta.url) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const resolvingPath = path.resolve(__dirname, "../../firebase-applet-config.json");
      if (fs.existsSync(resolvingPath)) {
        return JSON.parse(fs.readFileSync(resolvingPath, "utf8"));
      }
    }
  } catch (e) {
  }
  return HARDCODED_FIREBASE_FALLBACK;
};
var firebaseConfigJson = getFileFirebaseConfig();
var sanitizeEnv = (val, fallback) => {
  if (!val) return fallback;
  return val.trim().replace(/^["']|["']$/g, "");
};
var getFirebaseConfig = async () => {
  let fileConfig = { ...firebaseConfigJson };
  try {
    const possiblePaths = [
      path.join(process.cwd(), "firebase-applet-config.json"),
      path.join(process.cwd(), "..", "firebase-applet-config.json"),
      path.join(process.cwd(), "../..", "firebase-applet-config.json")
    ];
    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, "utf8");
        fileConfig = JSON.parse(fileContent);
        break;
      }
    }
  } catch (e) {
  }
  if (!fileConfig.projectId || !fileConfig.apiKey) {
    fileConfig = { ...HARDCODED_FIREBASE_FALLBACK, ...fileConfig };
  }
  let config = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || HARDCODED_FIREBASE_FALLBACK.projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || HARDCODED_FIREBASE_FALLBACK.storageBucket,
    apiKey: process.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || HARDCODED_FIREBASE_FALLBACK.apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || HARDCODED_FIREBASE_FALLBACK.authDomain,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || HARDCODED_FIREBASE_FALLBACK.messagingSenderId,
    appId: process.env.VITE_FIREBASE_APP_ID || fileConfig.appId || HARDCODED_FIREBASE_FALLBACK.appId,
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || fileConfig.firestoreDatabaseId || HARDCODED_FIREBASE_FALLBACK.firestoreDatabaseId
  };
  return config;
};
var EXTERNAL_API_CONFIG = {
  baseUrl: sanitizeEnv(process.env.OMIE_BASE_URL || process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, ""),
  appKey: sanitizeEnv(process.env.OMIE_APP_KEY, ""),
  appSecret: sanitizeEnv(process.env.OMIE_APP_SECRET, "")
};
var AI_CONFIG = {
  apiKey: (process.env.G_API_KEY || process.env.GEMINI_API_KEY || "").trim()
};
var PUSH_CONFIG = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "BLzFX530XvDT4SYRB5rtIyrBEXIwdIBZ_PdBppRdlHPrOx-iwJtKy1uek7Ah6MmS4dvfilxpt109ILtA0X4N_Ek",
  privateKey: process.env.VAPID_PRIVATE_KEY || "Xa8catoJrTvxLBpT5nmnS3l2tYh9RWL7-hHYV0M36WE",
  email: "mailto:vitorisalves1@gmail.com"
};
var IS_VERCEL = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== void 0 || process.env.NOW_REGION !== void 0 || process.env.AWS_LAMBDA_FUNCTION_NAME !== void 0;

// src/backend/firebase.ts
var adminDb = null;
var clientDb = null;
var adminDisabled = true;
var initPromise = null;
var initFirebase = async () => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const firebaseConfig = await getFirebaseConfig();
    try {
      if (IS_VERCEL) {
        console.log("[Firebase] Vercel environment detected. Skipper Admin SDK init completely to avoid metadata credential hangs.");
        adminDisabled = true;
      } else {
        const { initializeApp: initAdminApp, getApps: getAdminApps } = await import("firebase-admin/app");
        const { getFirestore: getAdminFirestore } = await import("firebase-admin/firestore");
        if (getAdminApps().length === 0) {
          initAdminApp({ projectId: firebaseConfig.projectId });
        }
        const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
        try {
          adminDb = getAdminFirestore(dbId);
        } catch (dbErr) {
          adminDb = getAdminFirestore();
        }
        try {
          await adminDb.collection("_health_check").limit(1).get();
          console.log("[Firebase] Admin SDK verified successfully.");
        } catch (healthErr) {
          if (healthErr.message?.includes("PERMISSION_DENIED") || healthErr.code === 7) {
            console.warn("[Firebase] Admin SDK health check failed (PERMISSION_DENIED). Falling back to Client SDK.");
            adminDisabled = true;
          }
        }
      }
    } catch (e) {
      console.warn("[Firebase] Admin SDK init failed, using Client only.", e);
    }
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      try {
        const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
        clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId || "(default)");
        console.log("[Firebase] Client SDK initialized with Firestore Lite.");
      } catch (err) {
        console.error("[Firebase] Client SDK init failed:", err);
      }
    }
  })();
  return initPromise;
};
var getDb = async () => {
  if (!adminDb && !clientDb) {
    await initFirebase();
  }
  if (adminDb && !adminDisabled) return adminDb;
  if (!clientDb) {
    console.warn("[Firebase] clientDb est\xE1 nulo em getDb(), tentando inicializa\xE7\xE3o for\xE7ada de recupera\xE7\xE3o...");
    try {
      const firebaseConfig = await getFirebaseConfig();
      const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId || "(default)");
      console.log("[Firebase] Recupera\xE7\xE3o do clientDb por inicializa\xE7\xE3o for\xE7ada realizada com sucesso!");
    } catch (e) {
      console.error("[Firebase] Inicializa\xE7\xE3o for\xE7ada de recupera\xE7\xE3o do clientDb falhou:", e);
    }
  }
  if (!clientDb) {
    throw new Error("Erro de conex\xE3o com o Banco de Dados: O SDK do Firebase n\xE3o p\xF4de ser inicializado no servidor.");
  }
  return clientDb;
};
var safeStringify = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return "[Serialization Error]";
  }
};
var handleFirestoreError = (error, operationType, path2) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: "server-context", usingAdmin: !!adminDb },
    operationType,
    path: path2
  };
  if (errInfo.error.toLowerCase().includes("not found") || errInfo.error.includes("404")) {
    console.warn("[FirestoreWarn]", safeStringify(errInfo));
    return errInfo;
  }
  console.error("[FirestoreError]", safeStringify(errInfo));
  return errInfo;
};
var fsOps = {
  collection: async (coll) => {
    const db = await getDb();
    return db.collection ? db.collection(coll) : collection(db, coll);
  },
  getDocs: async (collOrQuery, path2 = "unknown") => {
    try {
      const db = await getDb();
      if (db.collection) {
        if (typeof collOrQuery === "string") return await db.collection(collOrQuery).get();
        if (collOrQuery.get) return await collOrQuery.get();
      }
      if (typeof collOrQuery === "string") return await getDocs(collection(db, collOrQuery));
      return await getDocs(collOrQuery);
    } catch (err) {
      if (typeof err.message === "string" && (err.message.toLowerCase().includes("not found") || err.message.includes("404"))) {
        console.warn(`[FirestoreWarn] List operation failed (Not Found) at ${path2}`);
        return { docs: [] };
      }
      handleFirestoreError(err, "list" /* LIST */, path2);
      throw err;
    }
  },
  doc: async (coll, id) => {
    const db = await getDb();
    return db.collection ? db.collection(coll).doc(id) : doc(db, coll, id);
  },
  getDoc: async (refPromise, path2 = "unknown") => {
    try {
      const ref = await refPromise;
      return ref.get ? await ref.get() : await getDoc(ref);
    } catch (err) {
      handleFirestoreError(err, "get" /* GET */, path2);
      throw err;
    }
  },
  update: async (refPromise, data, path2 = "unknown") => {
    try {
      const ref = await refPromise;
      return ref.update ? await ref.update(data) : await updateDoc(ref, data);
    } catch (err) {
      if (typeof err.message === "string" && (err.message.toLowerCase().includes("not found") || err.message.includes("404"))) {
        console.warn(`[FirestoreWarn] Update operation failed (Not Found) at ${path2}`);
        return;
      }
      handleFirestoreError(err, "update" /* UPDATE */, path2);
      throw err;
    }
  },
  set: async (refPromise, data, path2 = "unknown") => {
    try {
      const ref = await refPromise;
      return ref.set ? await ref.set(data) : await setDoc(ref, data);
    } catch (err) {
      if (typeof err.message === "string" && (err.message.toLowerCase().includes("not found") || err.message.includes("404"))) {
        console.warn(`[FirestoreWarn] Set operation failed (Not Found) at ${path2}`);
        return;
      }
      handleFirestoreError(err, "write" /* WRITE */, path2);
      throw err;
    }
  },
  delete: async (refPromise, path2 = "unknown") => {
    try {
      const ref = await refPromise;
      console.log(`[Firestore] Deleting doc at path: ${path2}`);
      const result = ref.delete ? await ref.delete() : await deleteDoc(ref);
      console.log(`[Firestore] Delete successful for path: ${path2}`);
      return result;
    } catch (err) {
      console.error(`[Firestore] Delete failed for path: ${path2}`, err);
      if (typeof err.message === "string" && (err.message.toLowerCase().includes("not found") || err.message.includes("404"))) {
        console.warn(`[FirestoreWarn] Delete operation failed (Not Found) at ${path2}`);
        return;
      }
      handleFirestoreError(err, "delete" /* DELETE */, path2);
      throw err;
    }
  }
};

// src/backend/services/aiService.ts
import { GoogleGenAI, Type } from "@google/genai";
var AIService = class {
  static {
    this.instance = null;
  }
  static getInstance() {
    if (!this.instance) {
      if (!AI_CONFIG.apiKey) {
        throw new Error("GEMINI_API_KEY n\xE3o configurada no servidor.");
      }
      this.instance = new GoogleGenAI({ apiKey: AI_CONFIG.apiKey });
    }
    return this.instance;
  }
  static parseJson(text) {
    if (!text) return {};
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        cleanText = match[1];
      }
    }
    try {
      return JSON.parse(cleanText);
    } catch (e) {
      console.warn("[AIService] Direct parse failed, trying to find JSON boundaries", e);
      const start = cleanText.indexOf("{");
      const end = cleanText.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(cleanText.substring(start, end + 1));
        } catch (e2) {
          console.error("[AIService] Failed to extract JSON from text:", cleanText);
          return {};
        }
      }
      return {};
    }
  }
  /**
   * Mapeia itens da lista de compras para a planilha de metas
   */
  static async matchDashboard(spreadsheetNames, shoppingItemNames) {
    const ai = this.getInstance();
    const prompt = `
      Mapeie os nomes dos itens da LISTA DE COMPRAS para os nomes oficiais da PLANILHA DE METAS.
      
      RETORNE APENAS UM JSON no seguinte formato:
      {
        "NOME_NA_LISTA": "NOME_OFICIAL_NA_PLANILHA"
      }

      PLANILHA (Nomes Oficiais):
      ${spreadsheetNames.join("\n")}

      LISTA (Nomes Manuais):
      ${shoppingItemNames.join("\n")}
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });
    const text = response.candidates && response.candidates[0]?.content?.parts?.[0]?.text;
    return this.parseJson(text);
  }
  /**
   * Extrai produtos e preços de documentos (Notas Fiscais)
   */
  static async processDocument(fileData, promptText, existingProductNames) {
    const ai = this.getInstance();
    const parts = [];
    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data
        }
      });
    }
    parts.push({ text: promptText || "Extraia itens e pre\xE7os." });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: `
          Aja como um extrator de dados ultra-r\xE1pido de notas fiscais.
          META: Retornar JSON de produtos com pre\xE7o unit\xE1rio.
          ${existingProductNames && existingProductNames.length > 0 ? `

LISTA DE PRODUTOS EXISTENTES (PARA MATCHING):
${existingProductNames.join(", ")}` : ""}
          REGRAS:
          1. "name": Se o item for similar a um da "LISTA DE PRODUTOS EXISTENTES", use EXATAMENTE o nome da lista. Caso contr\xE1rio, use o nome lido.
          2. "rawName": Nome bruto como est\xE1 no documento.
        `,
        responseMimeType: "application/json",
        temperature: 0.1,
        topP: 0.8,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  rawName: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  supplierName: { type: Type.STRING },
                  lastPurchaseDate: { type: Type.STRING, description: "Data da compra/emiss\xE3o" },
                  paymentMethod: { type: Type.STRING, description: "Dinheiro, Cart\xE3o, Pix, Boleto, etc" }
                },
                required: ["name", "rawName", "price"]
              }
            }
          },
          required: ["products"]
        }
      }
    });
    const text = response.candidates && response.candidates[0]?.content?.parts?.[0]?.text;
    const parsed = this.parseJson(text);
    return parsed.products || [];
  }
};

// src/backend/services/pushService.ts
import webPush from "web-push";
var PushService = class {
  static init() {
    webPush.setVapidDetails(
      PUSH_CONFIG.email,
      PUSH_CONFIG.publicKey,
      PUSH_CONFIG.privateKey
    );
  }
  /**
   * Envia uma notificação para uma única subscrição
   */
  static async sendNotification(subscription, title, message, url = "/") {
    const payload = JSON.stringify({
      title,
      body: message,
      url,
      tag: "gestor-update-" + Date.now()
    });
    try {
      await webPush.sendNotification(subscription, payload);
      return true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        const docId = Buffer.from(subscription.endpoint).toString("base64").substring(0, 50);
        try {
          await fsOps.delete(fsOps.doc("push_subscriptions", docId));
        } catch (e) {
          console.error("[PushService] Erro ao remover inscri\xE7\xE3o inv\xE1lida:", e);
        }
      }
      return false;
    }
  }
  /**
   * Envia uma notificação para todos os inscritos
   */
  static async broadcast(title, message, url = "/") {
    const snapshot = await fsOps.getDocs("push_subscriptions");
    const subscriptions = snapshot.docs.map((doc2) => doc2.data());
    const results = await Promise.all(
      subscriptions.map((sub) => this.sendNotification(sub, title, message, url))
    );
    return results.filter(Boolean).length;
  }
};

// src/backend/services/omieService.ts
import axios from "axios";
var OmieService = class {
  static {
    this.api = axios.create({
      timeout: 3e4,
      validateStatus: () => true
    });
  }
  static getHeaders() {
    return {
      "Content-Type": "application/json",
      ...EXTERNAL_API_CONFIG.appKey ? { "x-omie-app-key": EXTERNAL_API_CONFIG.appKey } : {},
      ...EXTERNAL_API_CONFIG.appSecret ? { "x-omie-app-secret": EXTERNAL_API_CONFIG.appSecret } : {}
    };
  }
  /**
   * Busca páginas de forma recursiva/paginada
   */
  static async fetchAllPages(endpoint) {
    const pageSize = 100;
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const baseUrlsToTry = [
      EXTERNAL_API_CONFIG.baseUrl,
      EXTERNAL_API_CONFIG.baseUrl.replace(/\/v1$/, ""),
      EXTERNAL_API_CONFIG.baseUrl.replace(/\/v1$/, "/api/v1")
    ].filter((v, i, a) => a.indexOf(v) === i);
    for (const baseUrl of baseUrlsToTry) {
      const fullUrl = `${baseUrl}${cleanEndpoint}`;
      const firstUrl = `${fullUrl}${fullUrl.includes("?") ? "&" : "?"}${new URLSearchParams({ page: "1", pageSize: String(pageSize) }).toString()}`;
      const firstRes = await this.api.get(firstUrl, { headers: this.getHeaders() });
      if (firstRes.status < 400) {
        const { data: firstData } = firstRes;
        const results = Array.isArray(firstData) ? [...firstData] : [...firstData.data || []];
        const { total = 0, pageSize: actualSize = pageSize } = firstData.meta || {};
        if (total > actualSize) {
          const totalPages = Math.ceil(total / actualSize);
          const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          for (let i = 0; i < pageNumbers.length; i += 5) {
            const batch = pageNumbers.slice(i, i + 5);
            const batchResults = await Promise.all(batch.map(async (page) => {
              try {
                const pUrl = `${fullUrl}${fullUrl.includes("?") ? "&" : "?"}${new URLSearchParams({ page: String(page), pageSize: String(actualSize) }).toString()}`;
                const res = await this.api.get(pUrl, { headers: this.getHeaders() });
                return Array.isArray(res.data) ? res.data : res.data.data || [];
              } catch (e) {
                return [];
              }
            }));
            batchResults.forEach((list) => results.push(...list));
          }
        }
        return results;
      }
    }
    return [];
  }
  /**
   * Proxy genérico para a API
   */
  static async proxyRequest(method, subPath, body, queryString) {
    const { baseUrl } = EXTERNAL_API_CONFIG;
    let apiUrl = `${baseUrl}/${subPath}${queryString}`;
    let response = await this.api({
      method,
      url: apiUrl,
      data: body,
      headers: this.getHeaders()
    });
    if (response.status === 404 && subPath.startsWith("omie/")) {
      apiUrl = `${baseUrl}/${subPath.replace(/^omie\//, "")}${queryString}`;
      response = await this.api({
        method,
        url: apiUrl,
        data: body,
        headers: this.getHeaders()
      });
    }
    return response;
  }
};

// src/backend/services/excelService.ts
import axios2 from "axios";
import Papa from "papaparse";
var ExcelService = class {
  /**
   * Busca e processa CSV de uma planilha pública do Google Sheets
   */
  static async syncFromGoogleSheets(sheetId) {
    const timestamp = Date.now();
    const urls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&t=${timestamp}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv&t=${timestamp}`
    ];
    let csvData = "";
    let lastError = "";
    for (const url of urls) {
      try {
        const response = await axios2.get(url, {
          responseType: "text",
          timeout: 8e3,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          }
        });
        if (response.status < 400 && typeof response.data === "string") {
          if (response.data.includes("<!DOCTYPE html>") || response.data.includes("<html")) {
            lastError = "Planilha privada ou requer login.";
            continue;
          }
          csvData = response.data;
          break;
        }
      } catch (e) {
        lastError = e.message;
      }
    }
    if (!csvData) throw new Error(lastError || "Falha ao obter CSV");
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const rawData = Array.isArray(parsed.data) ? parsed.data : [];
    if (rawData.length === 0) throw new Error("Planilha vazia");
    const suppliersMap = {};
    rawData.forEach((row) => {
      const findVal = (row2, keywords) => {
        const match = Object.keys(row2).find((k) => {
          const cleanK = k.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return keywords.some((kw) => {
            const cleanKW = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return cleanK === cleanKW || cleanK.includes(cleanKW);
          });
        });
        return match ? row2[match] : null;
      };
      const sNameRaw = findVal(row, ["Empresa Raz\xE3o Social", "Fornecedor", "Empresa", "Raz\xE3o Social"]);
      const sPhone = findVal(row, ["Telefone", "WhatsApp", "Celular"]) || "";
      const pName = findVal(row, ["Produto", "Nome", "Descri\xE7\xE3o", "Item"]);
      const rawPrice = findVal(row, ["Valor Unit\xE1rio", "Pre\xE7o Unit\xE1rio", "Pre\xE7o", "Custo"]);
      const category = findVal(row, ["Categoria", "Grupo"]) || "Fornecedores";
      const lastPurchaseDate = findVal(row, ["Ultima Data Compra", "Data Compra", "\xDAltima Data", "Data", "Data de Compra", "Ult. Compra", "Compra", "Dt Compra"]) || "";
      const paymentMethod = findVal(row, ["Forma de Pagamento", "Pagamento", "Pagto", "Forma Pagto", "Meio de Pagamento", "Tipo de Pagamento", "Condicao", "Condi\xE7\xE3o de Pagamento"]) || "";
      if (sNameRaw && pName) {
        const sName = String(sNameRaw).trim().toUpperCase();
        let pPrice = 0;
        if (typeof rawPrice === "number") pPrice = rawPrice;
        else if (rawPrice) {
          const str = String(rawPrice).trim().replace("R$", "").replace(/\s/g, "");
          pPrice = str.includes(",") ? parseFloat(str.replace(/\./g, "").replace(",", ".")) : parseFloat(str);
        }
        if (!suppliersMap[sName]) suppliersMap[sName] = { name: sName, phone: sPhone, products: [] };
        suppliersMap[sName].products.push({
          name: pName,
          price: isNaN(pPrice) ? 0 : pPrice,
          category,
          lastPurchaseDate,
          paymentMethod
        });
      }
    });
    return suppliersMap;
  }
};

// src/backend/services/xmlService.ts
import { XMLParser } from "fast-xml-parser";
var XMLService = class {
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }
  getQuantity(val) {
    if (val === void 0 || val === null) return "0";
    if (typeof val === "object") {
      if ("#text" in val) return (val["#text"] || "").toString();
      const values = Object.values(val);
      if (values.length > 0) return this.getQuantity(values[0]);
    }
    return val.toString();
  }
  extractQuantity(prod) {
    if (!prod) return 0;
    const fields = ["qTrib", "qCom", "qUnid", "qVol", "qBC"];
    for (const field of fields) {
      if (field in prod) {
        const strVal = this.getQuantity(prod[field]);
        const parsed = parseFloat(strVal.replace(",", "."));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    for (const key in prod) {
      if (key.toLowerCase().startsWith("q")) {
        const strVal = this.getQuantity(prod[key]);
        const parsed = parseFloat(strVal.replace(",", "."));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 0;
  }
  parseNFe(xmlData) {
    const jsonObj = this.parser.parse(xmlData);
    let nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
    if (!nfe) {
      const findInfNFe = (obj) => {
        if (obj && typeof obj === "object") {
          if ("infNFe" in obj) return obj.infNFe;
          for (const key in obj) {
            const res = findInfNFe(obj[key]);
            if (res) return res;
          }
        }
        return null;
      };
      nfe = findInfNFe(jsonObj);
    }
    if (!nfe) {
      throw new Error("N\xE3o foi poss\xEDvel encontrar a estrutura infNFe no XML.");
    }
    const id = nfe["@_Id"] || (nfe.emit?.CNPJ ? `${nfe.emit.CNPJ}_${nfe.ide?.nNF}` : null) || nfe.ide?.nNF || `unknown_${Date.now()}`;
    const supplierName = nfe.emit?.xNome || "Desconhecido";
    const items = nfe.det;
    const products = Array.isArray(items) ? items.map((item) => {
      return {
        code: item.prod?.cProd || "N/A",
        name: item.prod?.xProd || "N/A",
        quantity: this.extractQuantity(item.prod),
        qTrib: this.getQuantity(item.prod?.qTrib)
      };
    }) : items ? [{
      code: items.prod?.cProd || "N/A",
      name: items.prod?.xProd || "N/A",
      quantity: this.extractQuantity(items.prod),
      qTrib: this.getQuantity(items.prod?.qTrib)
    }] : [];
    return {
      id,
      supplierName,
      date: nfe.ide?.dhEmi || (/* @__PURE__ */ new Date()).toISOString(),
      products
    };
  }
};

// src/backend/reminderWorker.ts
import { query, collection as collection2, where, getDocs as getDocs2 } from "firebase/firestore/lite";
var startBackgroundReminderWorker = () => {
  console.log("[ReminderWorker] Inicializando verifica\xE7\xE3o de lembretes...");
  setInterval(async () => {
    try {
      const nowStr = (/* @__PURE__ */ new Date()).toISOString();
      let snapshot;
      try {
        const db = await getDb();
        if (db.collection) {
          snapshot = await db.collection("reminders").where("notified", "==", false).where("date", "<=", nowStr).get();
        } else {
          const remindersColl = collection2(db, "reminders");
          const q = query(
            remindersColl,
            where("notified", "==", false),
            where("date", "<=", nowStr)
          );
          snapshot = await getDocs2(q);
        }
      } catch (dbErr) {
        if (dbErr.code === 7 || dbErr.message?.includes("PERMISSION_DENIED")) {
          console.warn("[ReminderWorker] Admin falhou com PERMISSION_DENIED. Tentando Client SDK...");
          const clientAppDb = await getDb();
          const q = query(
            collection2(clientAppDb, "reminders"),
            where("notified", "==", false),
            where("date", "<=", nowStr)
          );
          snapshot = await getDocs2(q);
        } else {
          throw dbErr;
        }
      }
      if (!snapshot || snapshot.empty) return;
      console.log(`[ReminderWorker] Processando ${snapshot.docs.length} lembretes pendentes...`);
      for (const reminderDoc of snapshot.docs) {
        const reminder = reminderDoc.data();
        const title = "Lembrete de Produto";
        const message = `Est\xE1 na hora de comprar: ${reminder.productName}`;
        await PushService.broadcast(title, message);
        try {
          await fsOps.update(reminderDoc.ref, { notified: true });
        } catch (updateErr) {
          console.error(`[ReminderWorker] Erro ao atualizar lembrete ${reminderDoc.id}:`, updateErr);
        }
      }
    } catch (err) {
      console.error("[ReminderWorker] Erro no ciclo de verifica\xE7\xE3o:", err);
    }
  }, 3e4);
};

// src/backend/app.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
PushService.init();
initFirebase().then(() => {
  if (!IS_VERCEL) {
    startBackgroundReminderWorker();
  }
}).catch((err) => console.error("[App] Erro na inicializa\xE7\xE3o:", err));
var asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[AsyncHandler Error] ${req.method} ${req.url}:`, err);
    next(err);
  });
};
app.get("/api/health", asyncHandler(async (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    config: { baseUrl: EXTERNAL_API_CONFIG.baseUrl }
  });
}));
app.get("/api/excel-sync", asyncHandler(async (req, res) => {
  const SHEET_ID = "1EarQhvZBT65Ptf-LULWnAfS844WSL7i8mryNRmt-qDY";
  try {
    const data = await ExcelService.syncFromGoogleSheets(SHEET_ID);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));
app.post("/api/ai/match-dashboard", asyncHandler(async (req, res) => {
  const { spreadsheetNames, shoppingItemNames } = req.body;
  const mapping = await AIService.matchDashboard(spreadsheetNames, shoppingItemNames);
  res.json({ mapping });
}));
app.post("/api/ai/process-document", asyncHandler(async (req, res) => {
  const { fileData, promptText, existingProductNames } = req.body;
  const products = await AIService.processDocument(fileData, promptText, existingProductNames);
  res.json(products);
}));
var xmlService = new XMLService();

function areCodesCompatible(c1, c2) {
  if (!c1 || !c2) return false;
  const clean = (c) => {
    let s = String(c || '').trim().toLowerCase();
    s = s.replace(/^(manual|cód|cod|codigo|código)[\s-_:]*/g, '');
    s = s.replace(/^0+/, '');
    s = s.replace(/[^a-z0-9]/g, '');
    return s;
  };
  const cleanC1 = clean(c1);
  const cleanC2 = clean(c2);
  if (!cleanC1 || !cleanC2) return false;
  return cleanC1 === cleanC2 || cleanC1.includes(cleanC2) || cleanC2.includes(cleanC1);
}

app.post("/api/xml/process", asyncHandler(async (req, res) => {
  const { xmlData } = req.body;
  const parsedData = xmlService.parseNFe(xmlData);
  const docRef = fsOps.doc("invoices", parsedData.id);
  const docSnapshot = await fsOps.getDoc(docRef);
  const exists = typeof docSnapshot.exists === "function" ? docSnapshot.exists() : !!docSnapshot.exists;
  await fsOps.set(docRef, parsedData, "invoices/" + parsedData.id);

  // --- REGRA DE ASSOCIAÇÃO TEMPORAL (Opção A) ---
  try {
    const invoicesSnapshot = await fsOps.getDocs("invoices", "invoices");
    if (invoicesSnapshot && invoicesSnapshot.docs) {
      const xmlDate = new Date(parsedData.date);
      for (const docSnap of invoicesSnapshot.docs) {
        if (docSnap.id.startsWith("manual-inv-")) {
          const manualInv = typeof docSnap.data === "function" ? docSnap.data() : docSnap.data;
          
          // Check if it is awaiting XML
          if (manualInv && (manualInv.xmlStatus === "Aguardando XML" || !manualInv.xmlStatus)) {
            // Check for code overlap
            let hasMatchingProduct = false;
            for (const manualProd of (manualInv.products || [])) {
              for (const xmlProd of (parsedData.products || [])) {
                if (areCodesCompatible(manualProd.code, xmlProd.code)) {
                  hasMatchingProduct = true;
                  break;
                }
              }
              if (hasMatchingProduct) break;
            }

            if (hasMatchingProduct) {
              const manualDate = new Date(manualInv.date || docSnap.createTime?.toDate()?.toISOString() || new Date());
              const diffTime = Math.abs(manualDate.getTime() - xmlDate.getTime());
              const diffDays = diffTime / (1000 * 60 * 60 * 24);

              // Janela temporal ajustada para 10 dias
              if (diffDays <= 10) {
                manualInv.xmlStatus = "Confirmado via XML";
                manualInv.associatedXmlInvoiceId = parsedData.id;
                
                const manualDocRef = fsOps.doc("invoices", docSnap.id);
                await fsOps.set(manualDocRef, { ...manualInv, id: docSnap.id }, "invoices/" + docSnap.id);
                console.log(`Associated manual invoice ${docSnap.id} with XML invoice ${parsedData.id} via temporal proximity.`);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro na regra de associacao temporal de XML:", err);
  }
  // ------------------------------------

  res.json({ status: exists ? "updated" : "imported", id: parsedData.id });
}));
app.get("/api/xml/invoices", asyncHandler(async (req, res) => {
  console.log("Fetching invoices...");
  try {
    const snapshot = await fsOps.getDocs("invoices", "invoices");
    console.log("Got snapshot, found docs:", snapshot?.docs?.length);
    if (!snapshot || !snapshot.docs) {
      throw new Error("Snapshot or snapshot.docs is undefined");
    }
    const data = snapshot.docs.map((doc2) => {
      const d = typeof doc2.data === "function" ? doc2.data() : doc2.data;
      return { id: doc2.id, ...d };
    });
    res.json(data);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      error: "Error fetching invoices",
      message: error?.message || String(error),
      code: error?.code || "",
      stack: error?.stack || ""
    });
  }
}));
app.post("/api/xml/invoices/delete", asyncHandler(async (req, res) => {
  console.log("Request body:", req.body);
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ status: "error", error: "ID not provided" });
  }
  console.log("Backend deleting invoice ID:", id);
  const docRef = fsOps.doc("invoices", id);
  const docSnapshot = await fsOps.getDoc(docRef, "invoices/" + id);
  const exists = typeof docSnapshot.exists === "function" ? docSnapshot.exists() : !!docSnapshot.exists;
  console.log("Doc exists before delete:", exists);
  if (exists) {
    await fsOps.delete(docRef, "invoices/" + id);
    res.json({ status: "deleted" });
  } else {
    res.status(404).json({ status: "error", error: "Document not found" });
  }
}));
app.get("/api/notifications/vapid-key", (req, res) => {
  res.json({ publicKey: PUSH_CONFIG.publicKey });
});
app.post("/api/notifications/subscribe", asyncHandler(async (req, res) => {
  const subscription = req.body;
  const docId = Buffer.from(subscription.endpoint).toString("base64").substring(0, 50);
  await fsOps.set(fsOps.doc("push_subscriptions", docId), {
    ...subscription,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.status(201).json({ status: "subscribed" });
}));
app.post("/api/notifications/broadcast", asyncHandler(async (req, res) => {
  const { title, message, url } = req.body;
  const count = await PushService.broadcast(title || "Aviso", message || "Novidade!", url);
  res.json({ sent_to: count });
}));
app.get("/api/omie-direct/products", asyncHandler(async (req, res) => {
  const [productList, stockList] = await Promise.all([
    OmieService.fetchAllPages("/omie/products"),
    OmieService.fetchAllPages("/omie/products/stockQuantity")
  ]);
  const stockMap = /* @__PURE__ */ new Map();
  stockList.forEach((s) => {
    const code = String(s.productId || s.product_id || s.id || "");
    if (code) stockMap.set(code, Number(s.quantity || 0));
  });
  const merged = productList.filter((p) => p.active !== false).map((p) => ({
    id: p.id,
    descricao: p.name || p.descricao,
    unidade: p.unit || "UN",
    valor_unitario: p.price || 0,
    stock: stockMap.get(String(p.id)) || 0
  }));
  res.json({ data: merged });
}));
app.all("/api/v1/*", asyncHandler(async (req, res) => {
  const subPath = req.params[0];
  const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const response = await OmieService.proxyRequest(req.method, subPath, req.body, queryString);
  if (response.status >= 400 && typeof response.data === "string") {
    return res.status(response.status).json({ error: response.data });
  }
  res.status(response.status).send(response.data);
}));
app.use((err, req, res, next) => {
  console.error("[ErrorHandler]", err.message);
  if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
    return res.status(504).json({
      error: "Timeout na requisi\xE7\xE3o",
      message: "O servidor demorou muito para responder. Tente novamente com um arquivo menor."
    });
  }
  res.status(err.status || 500).json({
    error: err.name || "Erro no servidor",
    message: err.message || "Ocorreu um erro inesperado."
  });
});
var app_default = app;
export {
  app_default as default
};
