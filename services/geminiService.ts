import { GoogleGenAI, Modality } from "@google/genai";
import type { CanvasImageElement } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64.split(',')[1],
      mimeType,
    },
  };
};

export const generateImage = async (
  prompt: string,
  referenceElements: CanvasImageElement[]
): Promise<string> => {
    const parts: any[] = [];

    if (referenceElements.length === 0) {
        throw new Error("Please select at least one reference image for generation.");
    }
    const textPrompt = `The user wants to generate an image. Their prompt is: "${prompt}". Use the provided reference images to create the final result.`;
    parts.push({ text: textPrompt });
    referenceElements.forEach(ref => {
        parts.push(fileToGenerativePart(ref.src, ref.mimeType));
    });


    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        // FIX: Add optional chaining to prevent runtime errors if `candidates` is undefined.
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                return `data:${mimeType};base64,${base64ImageBytes}`;
            }
        }
        throw new Error("No image was generated. The model might have refused the request.");
    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate image. Please check the console for details.");
    }
};

export const removeBackground = async (
    base64Image: string,
    mimeType: string
): Promise<string> => {
    const prompt = "Please remove the background of this image, making it transparent. The main subject should be preserved. Output a PNG with a transparent background.";
    const imagePart = fileToGenerativePart(base64Image, mimeType);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [{ text: prompt }, imagePart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        // FIX: Add optional chaining to prevent runtime errors if `candidates` is undefined.
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const newMimeType = 'image/png';
                return `data:${newMimeType};base64,${base64ImageBytes}`;
            }
        }
        throw new Error("Background removal failed: The AI did not return an image.");
    } catch (error) {
        console.error("Error removing background:", error);
        throw new Error("Failed to remove background. Please check the console for details.");
    }
};