
import { GoogleGenAI, Type } from "@google/genai";
import { AgentResponse } from "../types";

const SYSTEM_INSTRUCTION = `你是一位专业的调查助手，正在协助侦探破解一起复杂的推理案件。

重要准则：
1. 语言风格：专业、高效，带有1940年代黑色电影感。必须使用中文交流。
2. 回复必须是严格的 JSON 格式。
3. 线索生成：只有在发现关键点时才添加 'newClues'。

回复模式（JSON）：
{
  "message": "回复内容",
  "newClues": []
}`;

export const getDetectiveResponse = async (
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  currentMessage: string,
  caseContext: string
): Promise<AgentResponse> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined") {
    return { message: "错误：未检测到 API 密钥。请在 Vercel 设置中配置 API_KEY 并重新部署项目。" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // 推荐的免费层级高性能模型
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

    const text = response.text;
    if (!text) throw new Error("API 返回内容为空");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini 详情错误:", error);
    // 检查是否是频率限制（免费账号常见）
    if (error.message?.includes('429')) {
      return { message: "侦探，由于免费 API 的频率限制，助手暂时有些忙。请等待一分钟后再次尝试。" };
    }
    return { message: "抱歉，侦探。通讯器出现了技术故障。请检查网络或确认 API 密钥是否有效。" };
  }
};

export const generateClueVisual = async (prompt: string): Promise<string | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // 免费层级可用的图像生成模型
      contents: {
        parts: [{ text: `A 1940s noir forensic photo: ${prompt}. Grayscale, grainy, high contrast.` }]
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
    console.error("生成图像失败:", error);
    return null;
  }
};
