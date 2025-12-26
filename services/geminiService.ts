
import { GoogleGenAI, Type } from "@google/genai";
import { AgentResponse } from "../types";

// 声明全局常量以应对 Vite 的 define 注入
declare const __API_KEY__: string;

const SYSTEM_INSTRUCTION = `你是一位专业的调查助手，正在协助侦探破解复杂的推理案件。

重要准则：
1. 你的名字叫“助手”，语言风格需符合1940年代黑色电影的冷峻、专业感。
2. 必须使用中文交流。
3. 你的回复必须是严格的 JSON 格式，且符合指定的 Schema。
4. 线索（newClues）：只有当侦探的调查产生了实际结果（如搜查了某个地方、询问了关键问题）时，才返回新线索。

回复模式（JSON）：
{
  "message": "对侦探的回复",
  "newClues": []
}`;

// 辅助函数：安全获取 API KEY
const getSafeApiKey = (): string | undefined => {
  try {
    const key = (typeof __API_KEY__ !== 'undefined' ? __API_KEY__ : undefined) || process.env.API_KEY;
    return (key && key !== "undefined" && key !== "") ? key : undefined;
  } catch {
    return undefined;
  }
};

export const getDetectiveResponse = async (
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  currentMessage: string,
  caseContext: string
): Promise<AgentResponse> => {
  const apiKey = getSafeApiKey();

  if (!apiKey) {
    return { 
      message: "【系统错误】未检测到 API 密钥。请在 Vercel 设置中添加 API_KEY 环境变量并重新部署项目。" 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // 使用 gemini-3-flash-preview 以保证最佳响应速度和稳定性
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: [
        ...history, 
        { role: 'user', parts: [{ text: `[当前案件背景]\n${caseContext}\n\n[侦探最新行动]\n${currentMessage}` }] }
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
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    console.group("Gemini API 故障诊断");
    console.error("错误详情:", error);
    console.groupEnd();

    const errorMsg = error.message || "";
    
    // 专门处理密钥泄露错误
    if (errorMsg.includes('reported as leaked') || errorMsg.includes('API key not valid')) {
      return { 
        message: "⚠️ 【密钥失效】您的 API 密钥已被 Google 识别为泄露并禁用。请前往 AI Studio 生成新密钥，在环境变量中更新并重新部署。" 
      };
    }
    
    // 处理频率限制
    if (errorMsg.includes('429')) {
      return { message: "侦探，由于免费配额限制，助手暂时无法查阅档案。请稍等一分钟后再试。" };
    }

    // 处理网络/地区限制
    if (errorMsg.includes('fetch') || errorMsg.includes('NetworkError')) {
      return { message: "📡 【连接失败】无法连接到 AI 服务器。请确认您的科学上网工具已开启全局模式，且支持 Google 服务。" };
    }
    
    return { message: `抱歉，侦探。通讯器出现异常：${errorMsg || '未知错误'}` };
  }
};

export const generateClueVisual = async (prompt: string): Promise<string | null> => {
  const apiKey = getSafeApiKey();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A gritty 1940s forensic evidence photo: ${prompt}` }]
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
    console.error("图像生成失败:", error);
    return null;
  }
};
