
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateMRPSummary(orders: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        作为高级物料计划专家，请对以下客户订单执行MRP（物料需求计划）后的结果进行简短总结。
        订单数据：${JSON.stringify(orders)}
        要求：
        1. 总结计算的订单总数。
        2. 指出潜在的供应链风险。
        3. 给出1-2条优化建议。
        4. 使用中文，保持专业简洁。
      `,
      config: {
        temperature: 0.7,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "MRP 计算完成。所有订单已重新评估并纳入生产计划。请注意检查高优先级订单的物料到位情况。";
  }
}
