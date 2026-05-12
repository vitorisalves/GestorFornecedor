import path from "path";

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
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    apiKey: process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.VITE_FIREBASE_APP_ID || "",
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || "(default)"
  };

  try {
    // Tenta carregar do arquivo gerado pelo set_up_firebase
    const configModule = await import('../../firebase-applet-config.json', { assert: { type: 'json' } });
    config = { ...config, ...configModule.default };
  } catch (e) {
    // Silencioso se não existir
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
