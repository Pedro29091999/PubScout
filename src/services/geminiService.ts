import { GoogleGenAI, Type } from "@google/genai";
import { PubCrawl } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please check your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generatePubCrawl(
  location: string,
  numPubs: number,
  maxDistanceBetween: number
): Promise<PubCrawl> {
  const ai = getAI();
  const prompt = `Suggest a pub crawl route in ${location} with exactly ${numPubs} pubs. 
  The distance between each consecutive pub should be roughly around or less than ${maxDistanceBetween} meters if possible.
  For each pub, provide a realistic drinks menu (at least 5 items).
  Make sure the pubs are real venues in that area.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          totalDistance: { type: Type.NUMBER },
          pubs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                address: { type: Type.STRING },
                description: { type: Type.STRING },
                distanceFromPrevious: { type: Type.NUMBER },
                drinks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      price: { type: Type.STRING },
                      category: { 
                        type: Type.STRING,
                        enum: ["Beer", "Wine", "Spirit", "Cocktail", "Soft Drink"]
                      }
                    },
                    required: ["name", "price", "category"]
                  }
                }
              },
              required: ["id", "name", "address", "description", "distanceFromPrevious", "drinks"]
            }
          }
        },
        required: ["name", "pubs", "totalDistance"]
      },
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Could not generate a valid pub crawl. Please try again.");
  }
}
