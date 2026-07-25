import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'PLACEHOLDER');
// We use Gemini 1.5 Flash as it is fast, cheap, and supports vision.
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

export interface ExtractedRequirement {
  partNo?: string;
  description: string;
  quantity?: number;
}

export async function extractRequirementsFromText(text: string): Promise<ExtractedRequirement[]> {
  const prompt = `
You are a quotation assistant for a cable manufacturing company.
Extract the required products and their quantities from the following text.
For each item, extract the 'partNo' (this is usually a 7-digit number like 1119104, but can also be an alphanumeric code like 4510013U100), the 'description' (e.g. OELFLEX CLASSIC 110), and the 'quantity'.
If no quantity is specified, omit it. Do NOT make up items. Only extract exactly what is in the text.
Return ONLY a valid JSON array of objects.
Example output: [{"partNo": "1119104", "description": "ÖLFLEX CLASSIC 110 4G0,75-100 MTR", "quantity": 100}]

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
You are a quotation assistant for a cable manufacturing company.
Extract the required products and their quantities from the provided image.
For each item, extract the 'partNo' (this is usually a 7-digit number like 1119104, but can also be an alphanumeric code like 4510013U100), the 'description', and the 'quantity'.
If no quantity is specified, omit it. Do NOT make up items. Only extract exactly what is in the image.
Return ONLY a valid JSON array of objects.
Example output: [{"partNo": "1119104", "description": "ÖLFLEX CLASSIC 110 4G0,75-100 MTR", "quantity": 100}]
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
