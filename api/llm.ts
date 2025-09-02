import type { VercelRequest, VercelResponse } from "@vercel/node";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, system } = req.body;

    const chat = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // or whichever Groq model
      messages: [
        system ? { role: "system", content: system } : null,
        { role: "user", content: prompt },
      ].filter(Boolean) as any,
    });

    res.status(200).json({ text: chat.choices[0].message?.content ?? "" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? "LLM error" });
  }
}
