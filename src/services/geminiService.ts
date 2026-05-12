
import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedProduct {
  name: string;
  rawName: string;
  price: number;
  quantity?: number;
  category?: string;
  supplierName?: string;
  lastPurchaseDate?: string;
  paymentMethod?: string;
}

/**
 * AI Instance following skill guidelines
 */
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

/**
 * Compresses and resizes an image before sending to AI to improve speed.
 */
const compressImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
  });
};

/**
 * Helper to parse JSON from AI response
 */
const parseJson = (text: string | undefined): any => {
  if (!text) return {};
  
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) cleanText = match[1];
  }
  
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleanText.substring(start, end + 1));
      } catch (e2) {}
    }
    return {};
  }
};

/**
 * Process document using Gemini AI directly from frontend.
 */
export const processDocumentWithAI = async (
  fileData?: { mimeType: string; data: string },
  promptText?: string,
  existingProductNames?: string[]
): Promise<ExtractedProduct[]> => {
  try {
    const ai = getAI();
    const parts: any[] = [];
    
    if (fileData) {
      let data = fileData.data;
      if (fileData.mimeType.startsWith('image/')) {
        data = await compressImage(`data:${fileData.mimeType};base64,${data}`);
      }
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType.startsWith('image/') ? 'image/jpeg' : fileData.mimeType,
          data
        }
      });
    }

    parts.push({ text: promptText || "Extraia itens e preços." });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: `
          Aja como um extrator de dados ultra-rápido de notas fiscais.
          META: Retornar JSON de produtos com preço unitário.
          ${existingProductNames && existingProductNames.length > 0 ? `\n\nLISTA DE PRODUTOS EXISTENTES (PARA MATCHING):\n${existingProductNames.join(", ")}` : ""}
          REGRAS:
          1. "name": Se o item for similar a um da "LISTA DE PRODUTOS EXISTENTES", use EXATAMENTE o nome da lista. Caso contrário, use o nome lido.
          2. "rawName": Nome bruto como está no documento.
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
                  lastPurchaseDate: { type: Type.STRING, description: "Data da compra/emissão" },
                  paymentMethod: { type: Type.STRING, description: "Dinheiro, Cartão, Pix, Boleto, etc" }
                },
                required: ["name", "rawName", "price"]
              }
            }
          },
          required: ["products"]
        }
      }
    });

    const parsed = parseJson(response.text);
    return parsed.products || [];
  } catch (error: any) {
    console.error("Gemini Frontend Error:", error);
    // Fallback to backend if frontend fails (maybe key not set in Vercel public env)
    // but the user says backend is what fails on Vercel. 
    // Let's try to handle the error gracefully.
    const msg = error?.message || String(error);
    if (msg.includes("API key not valid") || msg.includes("not found")) {
      throw new Error("API Key do Gemini não configurada ou inválida.");
    }
    throw error;
  }
};

/**
 * AI Product matching directly from frontend.
 */
export const matchDashboardWithAI = async (
  spreadsheetNames: string[],
  shoppingItemNames: string[]
): Promise<Record<string, string>> => {
  try {
    const ai = getAI();
    const prompt = `
      Mapeie os nomes dos itens da LISTA DE COMPRAS para os nomes oficiais da PLANILHA DE METAS.
      
      RETORNE APENAS UM JSON no seguinte formato:
      {
        "NOME_NA_LISTA": "NOME_OFICIAL_NA_PLANILHA"
      }

      PLANILHA (Nomes Oficiais):
      ${spreadsheetNames.join('\n')}

      LISTA (Nomes Manuais):
      ${shoppingItemNames.join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    return parseJson(response.text);
  } catch (error) {
    console.error("Match AI Error:", error);
    return {};
  }
};
