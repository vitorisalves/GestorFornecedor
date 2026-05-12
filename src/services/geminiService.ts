import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

export interface ExtractedProduct {
  name: string;
  rawName: string;
  price: number;
  quantity?: number;
  category?: string;
  supplierName?: string;
}

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
      
      // Compress to JPEG with 0.8 quality for speed/quality balance
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
  });
};

/**
 * Process document using Gemini AI (Client-side).
 */
export const processDocumentWithAI = async (
  fileData?: { mimeType: string; data: string },
  promptText?: string,
  existingProductNames?: string[]
): Promise<ExtractedProduct[]> => {
  // Use the platform-provided GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Configuração incompleta: GEMINI_API_KEY não encontrada.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [];
  
  if (fileData) {
    let processableData = fileData.data;
    
    // If it's an image, compress it to speed up transmission and processing
    if (fileData.mimeType.startsWith('image/')) {
      try {
        const fullBase64 = `data:${fileData.mimeType};base64,${fileData.data}`;
        processableData = await compressImage(fullBase64);
      } catch (e) {
        console.warn("Falha na compressão, enviando original", e);
      }
    }

    parts.push({
      inlineData: {
        mimeType: fileData.mimeType.startsWith('image/') ? 'image/jpeg' : fileData.mimeType,
        data: processableData
      }
    });
  }

  if (promptText) {
    parts.push({ text: promptText });
  } else {
    parts.push({ text: "Extraia itens e preços." });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
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
          3. Seja conciso. Ignore cabeçalhos e rodapés não relacionados a itens.
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
                  supplierName: { type: Type.STRING }
                },
                required: ["name", "rawName", "price"]
              }
            }
          },
          required: ["products"]
        }
      }
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("O modelo não retornou nenhum texto.");
    }

    try {
      const parsed = JSON.parse(text.trim());
      return parsed.products || [];
    } catch (parseError) {
      console.error("Erro ao analisar JSON da AI:", text);
      throw new Error("Resposta da AI em formato inválido.");
    }
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("Erro no processamento AI:", msg);
    throw new Error(msg);
  }
};
