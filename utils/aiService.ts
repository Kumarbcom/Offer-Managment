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
You are an advanced quotation and engineering assistant for a cable manufacturing and distribution company (specializing in brands like LAPP).
Extract the required products, their quantities, and technical parameters from the text.
For each item, extract:
1. 'partNo': An alphanumeric code (often 7 or 8 digits for LAPP, e.g., 1119104).
2. 'description': The full product description (e.g., "ÖLFLEX CLASSIC 110 4G0,75-100 MTR"). Correct common misspellings (e.g., "Oelflex" to "ÖLFLEX").
3. 'quantity': The requested length or number of items (numeric value).
4. 'uom': The unit of measure (e.g., MTR, NOS, RL, DRM). Default to MTR if cable length is implied.
5. 'coreCount': If applicable, extract the number of cores (e.g., 4G0.75 means 4 cores).
6. 'crossSection': If applicable, extract the cross-sectional area (e.g., 4G0.75 means 0.75 sqmm).
7. 'remarks': Any additional technical requirements, voltage grades, shielding requirements, or special instructions.

CRITICAL: The input might be messy, contain tables, or be a mix of part numbers and descriptions.
It is perfectly okay if some fields are missing. Leave them blank or null.
You MUST extract an object for EVERY single row/item you see. Do NOT skip any rows. Do NOT make up items.
Return ONLY a valid JSON array of objects.
Example output: [{"partNo": "1119104", "description": "ÖLFLEX CLASSIC 110 4G0,75-100 MTR", "quantity": 100, "uom": "MTR", "coreCount": "4", "crossSection": "0.75", "remarks": "Control cable"}]

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
    if (msg.includes('429') || msg.includes('quota')) {
      throw new Error('Google AI Free Tier Limit Reached! Please wait 60 seconds and try again, or upgrade your API key to a paid tier.');
    }
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
You are an advanced quotation and engineering assistant for a cable manufacturing and distribution company (specializing in brands like LAPP).
Extract the required products, their quantities, and technical parameters from the provided image.
For each item, extract:
1. 'partNo': An alphanumeric code (often 7 or 8 digits for LAPP, e.g., 1119104).
2. 'description': The full product description (e.g., "ÖLFLEX CLASSIC 110 4G0,75-100 MTR"). Correct common misspellings (e.g., "Oelflex" to "ÖLFLEX").
3. 'quantity': The requested length or number of items (numeric value).
4. 'uom': The unit of measure (e.g., MTR, NOS, RL, DRM). Default to MTR if cable length is implied.
5. 'coreCount': If applicable, extract the number of cores (e.g., 4G0.75 means 4 cores).
6. 'crossSection': If applicable, extract the cross-sectional area (e.g., 4G0.75 means 0.75 sqmm).
7. 'remarks': Any additional technical requirements, voltage grades, shielding requirements, or special instructions.

CRITICAL: The image might be messy, contain tables, or be a mix of part numbers and descriptions.
It is perfectly okay if some fields are missing. Leave them blank or null.
You MUST extract an object for EVERY single row/item you see in the image. Do NOT skip any rows. Do NOT make up items.
Return ONLY a valid JSON array of objects.
Example output: [{"partNo": "1119104", "description": "ÖLFLEX CLASSIC 110 4G0,75-100 MTR", "quantity": 100, "uom": "MTR", "coreCount": "4", "crossSection": "0.75", "remarks": "Control cable"}]
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
    if (msg.includes('429') || msg.includes('quota')) {
      throw new Error('Google AI Free Tier Limit Reached! Please wait 60 seconds and try again, or upgrade your API key to a paid tier.');
    }
    throw new Error(`Failed to analyze: ${msg}`);
  }
}
