
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AgentResponse, ClueType } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `你是一位黑色电影（Noir）风格的专业调查助手。
用户是首席侦探，你正在协助他破解一起复杂的推理小说式案件。

重要准则：
1. 始终保持角色状态。你的台词应该像冷硬派小说。必须使用中文交流。
2. 当侦探要求你“调查”某处，或在交谈中发现重要证据时，你必须建议一个新的线索（Clue）。
3. 你的所有回复必须是严格的 JSON 格式。
4. 如果发现需要视觉呈现的线索（如实物、现场照片、平面图），将 'type' 设为 'image' 或 'map'，并提供详细的英文描述作为 'contentPrompt' 以供图片生成。
5. 如果线索只是文件、证词或笔录，请使用 'text' 类型。

回复模式（JSON）：
{
  "message": "你对侦探说的话。如果这是开场，请表现得像刚刚递上一根烟并开始汇报。",
  "newClues": [
    {
      "title": "线索标题",
      "description": "简短说明为什么这个线索很重要",
      "type": "text" | "image" | "map",
      "contentPrompt": "如果类型是 image/map，请提供详细的英文绘画提示词",
      "contentText": "如果类型是 text，请提供具体的文字内容"
    }
  ]
}

只有在发现具体突破时才添加 'newClues'。不要一次性揭开所有谜底。保持悬疑感。`;

export const getDetectiveResponse = async (
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  currentMessage: string,
  caseContext: string
): Promise<AgentResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: `案件背景: ${caseContext}\n\n侦探说: ${currentMessage}` }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            newClues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['text', 'image', 'map'] },
                  contentPrompt: { type: Type.STRING },
                  contentText: { type: Type.STRING }
                },
                required: ['title', 'description', 'type']
              }
            }
          },
          required: ['message']
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return { message: "抱歉，侦探。信号不太好，档案库的连接好像断了。你能再说一遍吗？" };
  }
};

export const generateClueVisual = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A gritty, high-contrast, noir-style cinematic photo of: ${prompt}. Cinematic lighting, heavy shadows, 1940s vintage aesthetic, photorealistic.` }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Error:", error);
    return null;
  }
};
