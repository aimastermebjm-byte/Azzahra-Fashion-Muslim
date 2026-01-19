import { GoogleGenerativeAI } from "@google/generative-ai";

// Use existing API key from environment or storage
// In a real app, this should be securely handled
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const geminiImageService = {
    /**
     * Generate an image based on a text prompt using Gemini/Imagen
     * Note: This uses the REST API directly as the JS SDK support for Imagen might vary
     */
    async generateBannerImage(prompt: string): Promise<string> {
        if (!API_KEY) {
            throw new Error('API Key Gemini tidak ditemukan. Mohon konfigurasi VITE_GEMINI_API_KEY.');
        }

        const enhancedPrompt = `Create a WIDE PANORAMIC promotional banner image (Aspect Ratio: 16:9). 
The banner should be suitable for website header/carousel. 
CRITICAL COMPOSITION: Keep the main subject/text CENTERED horizontally and vertically. The top and bottom 20% will be cropped, so ensure all important elements are in the MIDDLE HORIZONTAL STRIP.
Style: professional, elegant, high-end fashion brand aesthetic, cinematic lighting, minimalist.
Content: ${prompt}
IMPORTANT: Output MUST be landscape 16:9 wide format.`;

        try {
            console.log('Attempting Native Generation with gemini-2.5-flash-image');
            const genAI = new GoogleGenerativeAI(API_KEY);

            // STRICT MODE: Only use Gemini Native Image Model
            // Using 'gemini-2.5-flash-image' for native image generation
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

            const result = await model.generateContent(enhancedPrompt);
            const response = result.response;

            // Parse Native Image Response (Inline Data)
            const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

            if (imagePart && imagePart.inlineData) {
                console.log('✅ Native Gemini Image Generated!');
                // Convert Base64 to Blob URL for display
                const mimeType = imagePart.inlineData.mimeType || 'image/png';
                const base64Data = imagePart.inlineData.data;

                // Helper to convert base64 to blob
                const binaryString = window.atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: mimeType });
                return URL.createObjectURL(blob);
            }

            throw new Error('Gemini tidak mengembalikan data gambar (Text-only response). Pastikan API Key support Image Generation dan memiliki kuota.');

        } catch (e: any) {
            console.error('Native Gemini Generation failed:', e);
            // DIRECT ERROR THROW - NO FALLBACK
            throw new Error(`Gagal generate dengan Gemini: ${e.message || 'Unknown error'}`);
        }
    }
};
