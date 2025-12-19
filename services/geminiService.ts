
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AgentResponse, ClueType } from "../types";

const SYSTEM_INSTRUCTION = `你是一位专业的调查助手，正在协助侦探破解一起复杂的推理案件。

重要准则：
1. 你的名字叫“助手”。
2. 语言风格：专业、直接、高效，不要过多的辞藻修饰。必须使用中文交流。
3. 当侦探要求调查某处，或对话中出现关键突破时，你必须提供新的线索（Clue）。
4. 你的所有回复必须是严格的 JSON 格式。
5. 视觉线索（type: 'image'）：提供简洁的英文描述作为 'contentPrompt'。
6. 文字线索（type: 'text'）：提供具体的公文、书信或证词内容。
7. 引导用户：通过线索和暗示引导用户推理，不要直接揭晓真相。

回复模式（JSON）：
{
  "message": "对侦探的回复内容。",
  "newClues": [
    {
      "title": "线索标题",
      "description": "说明该线索的重要性",
      "type": "text" | "image" | "map",
      "contentPrompt": "如果类型是 image/map，请提供英文绘画提示词",
      "contentText": "如果类型是 text，请提供具体的文字内容"
    }
  ]
}

只有在发现具体突破时才添加 'newClues'。`;

export const getDetectiveResponse = async (
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  currentMessage: string,
  caseContext: string
): Promise<AgentResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: `案件背景: ${caseContext}\n\n侦探指令: ${currentMessage}` }] }
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

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini Text Error:", error);
    return { message: "抱歉，通讯信号不稳定。请您重复刚才的指令。" };
  }
};

export const generateClueVisual = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A professional forensic photo of: ${prompt}. Realistic, detailed, neutral lighting.` }]
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
