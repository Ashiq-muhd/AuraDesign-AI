
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { RoomAnalysis, ElementPosition } from "../types";

// Note: process.env.API_KEY is handled by the environment
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeRoom = async (base64Image: string): Promise<RoomAnalysis> => {
  const ai = getAIClient();
  const prompt = `Analyze this room photo. Provide a structured analysis including:
    1. Room type (e.g., Living Room, Bedroom)
    2. Current design style
    3. List of key elements present
    4. 3-5 design improvement suggestions
    5. 3 organization tips to maximize space.
    Return the response in valid JSON format only.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          roomType: { type: Type.STRING },
          style: { type: Type.STRING },
          elements: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          organizationTips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["roomType", "style", "elements", "suggestions", "organizationTips"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as RoomAnalysis;
};

export const generateRedesign = async (
  base64Image: string, 
  elementsToAdd: string[], 
  userItems: string[] = []
): Promise<string> => {
  const ai = getAIClient();
  
  const itemParts = userItems.map((img, i) => ({
    inlineData: { data: img.split(',')[1], mimeType: 'image/png' }
  }));

  const prompt = `Reimagine this room's interior design while strictly preserving its original structural architecture.
    
    ARCHITECTURAL CONSTRAINTS (MANDATORY):
    - STICK TO THE SHELL: Do not change the walls, floor, ceiling, windows, or doors. They must remain in their exact original positions and shapes.
    - PRESERVE PERSPECTIVE: The camera angle and room geometry must remain identical to the original photo.
    
    DESIGN INSTRUCTIONS:
    - ${userItems.length > 0 ? `CRITICAL: Incorporate the specific items shown in the attached reference photos into the design. Match their appearance exactly.` : ''}
    - ${elementsToAdd.length > 0 ? `Include these design elements: ${elementsToAdd.join(', ')}.` : ''}
    - Style: Professional architectural interior photography.
    - Ensure the room looks redesigned, not structurally rebuilt.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
        ...itemParts,
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  let imageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) throw new Error("Failed to generate image");
  return imageUrl;
};

export const generateRedesignWithLayout = async (
  base64Image: string, 
  positions: Record<string, ElementPosition>,
  userItems: string[] = [],
  styleVariation?: string
): Promise<string> => {
  const ai = getAIClient();
  
  const layoutDescriptions = Object.entries(positions).map(([name, pos]) => {
    const horizontal = pos.x < 33 ? "left side" : pos.x > 66 ? "right side" : "center";
    const vertical = pos.y < 33 ? "top area" : pos.y > 66 ? "bottom area" : "middle";
    
    let descriptiveLabel = name;
    if (name.startsWith('Uploaded Item')) {
      const idx = parseInt(name.split(' ').pop() || '0');
      descriptiveLabel = `User's uploaded furniture item reference #${idx}`;
    }
    
    return `Place ${descriptiveLabel} specifically at the ${vertical} ${horizontal} of the existing room (at coordinates X:${pos.x}%, Y:${pos.y}%)`;
  }).join(". ");

  const itemParts = userItems.map((img, i) => ({
    inlineData: { data: img.split(',')[1], mimeType: 'image/png' }
  }));

  const prompt = `Redesign the room layout according to the following spatial instructions while maintaining the original room structure.
    
    SPATIAL LAYOUT:
    ${layoutDescriptions}.
    
    STRICT STRUCTURAL PRESERVATION:
    - DO NOT alter the room's permanent features (walls, floor, ceiling, windows, doors, outlets, radiators).
    - MAINTAIN the exact viewpoint and focal length of the original photo.
    - All furniture and decor items must appear to be physically occupying the existing space.
    
    ADDITIONAL CONSTRAINTS:
    - ${userItems.length > 0 ? `The reference photos are the specific furniture items to be placed at the positions labeled "User's uploaded furniture item reference #X". Match their visual identity perfectly.` : ''}
    - ${styleVariation ? `Variation request: ${styleVariation}.` : ''}
    - Style: High-end professional architectural photography.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
        ...itemParts,
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  let imageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) throw new Error("Failed to generate image with layout");
  return imageUrl;
};

export const editImage = async (base64Image: string, editInstruction: string): Promise<string> => {
  const ai = getAIClient();
  
  const prompt = `Modify this generated room image based on this instruction: "${editInstruction}".
    MAINTAIN STRUCTURAL INTEGRITY:
    - Keep walls, doors, and windows exactly where they are. Do not change the room's geometry.
    - Focus exclusively on adjusting lighting, colors, or specific decor items.
    Style: Maintain the existing photographic quality.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  let imageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) throw new Error("Failed to edit image");
  return imageUrl;
};

export const chatWithAI = async (message: string, history: { role: 'user' | 'model', text: string }[], currentImage?: string) => {
  const ai = getAIClient();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "You are an expert interior designer and organization consultant named Aura. Be helpful, professional, and encouraging. You can analyze images if the user provides them.",
    }
  });

  if (currentImage) {
     const response = await ai.models.generateContent({
       model: 'gemini-3-pro-preview',
       contents: {
         parts: [
           { inlineData: { data: currentImage.split(',')[1], mimeType: 'image/png' } },
           { text: message }
         ]
       }
     });
     return response.text;
  }

  const response = await chat.sendMessage({ message });
  return response.text;
};
