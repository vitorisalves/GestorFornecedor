
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
 * Process document using Gemini AI via Backend Proxy.
 */
export const processDocumentWithAI = async (
  fileData?: { mimeType: string; data: string },
  promptText?: string,
  existingProductNames?: string[]
): Promise<ExtractedProduct[]> => {
  try {
    const response = await fetch('/api/ai/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData, promptText, existingProductNames })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Erro no servidor: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("Erro no processamento AI:", msg);
    throw new Error(msg);
  }
};
