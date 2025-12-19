import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AgentResponse, ClueType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `你是一位黑色电影（Noir）风格的专业调查助手，名叫“老刘”。
用户是首席侦探，你正在协助他破解一起复杂的推理小说式案件。

重要准则：
1. 始终保持角色状态。你的台词应该像雷蒙德·钱德勒的冷硬派小说：简短、愤世嫉俗但忠诚。必须使用中文交流。
2. 当侦探要求你“调查”某处，或在交谈中发现重要证据时，你必须建议一个或多个新的线索（Clue）。
3. 你的所有回复必须是严格的 JSON 格式。
4. 视觉线索（type: 'image'）：提供详细的英文描述作为 'contentPrompt'。描述应包含：gritty, noir, 1940s, high contrast, dramatic shadows。
5. 文字线索（type: 'text'）：提供具体的公文、书信或证词内容。
6. 引导用户：不要直接告诉用户凶手是谁。通过线索和暗示引导他们自己推理。

回复模式（JSON）：
{
  "message": "你对侦探说的话。带点烟草味和雨夜的忧郁。",
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

只有在发现具体突破时才添加 'newClues'。保持悬疑感。`;

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