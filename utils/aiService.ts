import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'PLACEHOLDER');
// We use Gemini 1.5 Flash as it is fast, cheap, and supports vision.
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface ExtractedRequirement {
  description: string;
  quantity?: number;
}

export async function extractRequirementsFromText(text: string): Promise<ExtractedRequirement[]> {
  const prompt = `
You are a quotation assistant for a cable manufacturing/supply company.
Extract the required cable products and their quantities from the following text.
If no quantity is specified, omit the quantity field for that item.
Return ONLY a valid JSON array of objects, with each object having a 'description' (string) and an optional 'quantity' (number).
Example output: [{"description": "LIYY 2X0.5", "quantity": 100}, {"description": "Oelflex Classic 110 3G1.5"}]

Text to extract from:
${text}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResp = response.text();
    // Clean up potential markdown formatting
    const cleanedText = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as ExtractedRequirement[];
  } catch (error: any) {
    console.error("Failed to extract requirements from text", error);
    const msg = error.message || String(error);
    throw new Error(`Failed to analyze: ${msg}`);
  }
}

// Convert a File (image) to the generative part format expected by Gemini Vision
async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // FileReader result includes the Data URL prefix (e.g., "data:image/jpeg;base64,...")
      // We only want the base64 string
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type
    },
  };
}

export async function extractRequirementsFromImage(imageFile: File): Promise<ExtractedRequirement[]> {
  const prompt = `
You are a quotation assistant for a cable manufacturing/supply company.
Extract the required cable products and their quantities from the provided image (which might be a table, email screenshot, or RFQ).
If no quantity is specified for an item, omit the quantity field for that item.
Return ONLY a valid JSON array of objects, with each object having a 'description' (string) and an optional 'quantity' (number).
Example output: [{"description": "LIYY 2X0.5", "quantity": 100}, {"description": "Oelflex Classic 110 3G1.5"}]
  `;

  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const textResp = response.text();
    const cleanedText = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as ExtractedRequirement[];
  } catch (error: any) {
    console.error("Failed to extract requirements from image", error);
    const msg = error.message || String(error);
    throw new Error(`Failed to analyze: ${msg}`);
  }
}
