import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedProduct {
  name: string;
  rawName: string;
  price: number;
  quantity?: number;
  category?: string;
  supplierName?: string;
}

/**
 * Process document using Gemini AI (Client-side).
 */
export const processDocumentWithAI = async (
  fileData?: { mimeType: string; data: string },
  prompt?: string,
  existingProductNames?: string[]
): Promise<ExtractedProduct[]> => {
  // Use G_API_KEY as requested, fallback to GEMINI_API_KEY
  const apiKey = process.env.G_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("A chave G_API_KEY não foi encontrada. Certifique-se de configurá-la nas variáveis de ambiente (Vercel ou local).");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const productsContext = existingProductNames && existingProductNames.length > 0 
    ? `\n\nPRODUTOS JÁ EXISTENTES NO SISTEMA:\n${existingProductNames.join(", ")}`
    : "";

  const systemInstruction = `
    Você é um assistente especializado em extração de dados de notas fiscais e atualização de preços.
    Sua tarefa é identificar produtos e seus respectivos preços unitários.
    
    INSTRUÇÕES DE VÍNCULO (MATCHING):
    1. No campo "name", se o produto extraído parecer ser um dos "PRODUTOS JÁ EXISTENTES" (mesmo que o nome não seja idêntico, ex: "leite piracan" -> "leite piracanjuba integral 1L"), você deve retornar EXATAMENTE o nome do produto que já existe. Se não houver correspondência, use o nome lido.
    2. No campo "rawName", retorne SEMPRE o nome original conforme lido no documento, sem alterações (ex: se está "LT PIRACAN", retorne "LT PIRACAN").
    3. Use sua inteligência para entender abreviações, marcas e variações e associar ao nome correto em "name".
    
    Regras de Extração:
    - Extraia o NOME do produto e o PREÇO UNITÁRIO atual.
    - Ignore impostos e descontos totais.
    - Retorne os dados em formato JSON seguindo o schema.${productsContext}
  `;

  const parts: any[] = [];
  
  if (fileData) {
    parts.push({
      inlineData: {
        mimeType: fileData.mimeType,
        data: fileData.data
      }
    });
  }

  if (prompt) {
    parts.push({ text: prompt });
  } else {
    parts.push({ text: "Extraia todos os produtos e preços deste documento." });
  }

  try {
    const genConfig = {
      systemInstruction,
      responseMimeType: "application/json",
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
                supplierName: { type: Type.STRING }
              },
              required: ["name", "rawName", "price"]
            }
          }
        },
        required: ["products"]
      }
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: genConfig
    });

    const text = response.text;
    if (!text) {
      throw new Error("O modelo não retornou nenhum texto.");
    }

    const result = JSON.parse(text.trim());
    return result.products || [];
  } catch (error: any) {
    // Log safe message instead of whole object if possible
    const msg = error?.message || String(error);
    console.error("AI Processing Error:", msg);
    
    // Throw a simple error to avoid circular structure issues in UI
    throw new Error(msg);
  }
};
