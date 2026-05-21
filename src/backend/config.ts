import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let firebaseConfigJson: any = {};
try {
  firebaseConfigJson = require("../../firebase-applet-config.json");
} catch (e) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const possiblePaths = [
      path.join(process.cwd(), "firebase-applet-config.json"),
      path.resolve(__dirname, "../../firebase-applet-config.json")
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        firebaseConfigJson = JSON.parse(fs.readFileSync(p, "utf8"));
        break;
      }
    }
  } catch (innerE) {
    // Silencioso se falhar
  }
}

/**
 * Limpa variáveis de ambiente removendo aspas e espaços extras.
 */
export const sanitizeEnv = (val: string | undefined, fallback: string): string => {
  if (!val) return fallback;
  return val.trim().replace(/^["']|["']$/g, '');
};

/**
 * Configuração do Firebase
 */
export const getFirebaseConfig = async () => {
  let config: any = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "",
    apiKey: process.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "",
    appId: process.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "",
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId || "(default)"
  };

  try {
    // Tenta carregar do arquivo gerado pelo set_up_firebase se presente
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(fileContent);
      config = { ...config, ...parsed };
    }
  } catch (e) {
    // Silencioso se não existir ou falhar
  }

  return config;
};

/**
 * Configuração da API Externa (Omie/Proxy)
 */
export const EXTERNAL_API_CONFIG = {
  baseUrl: sanitizeEnv(process.env.OMIE_BASE_URL || process.env.EXTERNAL_API_URL, "https://production-manager-api.onrender.com/v1").replace(/\/$/, ""),
  appKey: sanitizeEnv(process.env.OMIE_APP_KEY, ""),
  appSecret: sanitizeEnv(process.env.OMIE_APP_SECRET, "")
};

/**
 * Configuração do Gemini AI
 */
export const AI_CONFIG = {
  apiKey: (process.env.G_API_KEY || process.env.GEMINI_API_KEY || "").trim()
};

/**
 * Configuração de Web Push (VAPID)
 */
export const PUSH_CONFIG = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BLzFX530XvDT4SYRB5rtIyrBEXIwdIBZ_PdBppRdlHPrOx-iwJtKy1uek7Ah6MmS4dvfilxpt109ILtA0X4N_Ek',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'Xa8catoJrTvxLBpT5nmnS3l2tYh9RWL7-hHYV0M36WE',
  email: 'mailto:vitorisalves1@gmail.com'
};

export const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
