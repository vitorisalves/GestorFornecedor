export interface ExtractedProduct {
  name: string;
  rawName: string;
  price: number;
  quantity?: number;
  category?: string;
  supplierName?: string;
}

/**
 * Process document using Gemini AI (Server-side proxy).
 * This ensures the API key remains hidden and allows for easier configuration in Vercel.
 */
export const processDocumentWithAI = async (
  fileData?: { mimeType: string; data: string },
  prompt?: string,
  existingProductNames?: string[]
): Promise<ExtractedProduct[]> => {
  try {
    const response = await fetch("/api/ai/process-document", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileData,
        prompt,
        existingProductNames,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erro ao processar documento com IA");
    }

    const result = await response.json();
    return result.products;
  } catch (error: any) {
    console.error("AI Service Error:", error);
    throw error;
  }
};
