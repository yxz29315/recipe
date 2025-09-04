import type { VercelRequest, VercelResponse } from "@vercel/node";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// allow local dev + your prod domain if you add one later
const ALLOW_LIST = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "https://recipe-beta-six.vercel.app",
]);

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || "";
  const allowOrigin = ALLOW_LIST.has(origin) ? origin : "*";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    // preflight ok
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, image, system } = (req.body as any) || {};

    const messages: any[] = [
        system ? { role: "system", content: system } : null,
    ];

    const userContent: any[] = [];
    const basePrompt = "Concisely list the ingredients found in the user's request (no introductory sentence). Then, suggest 1-2 possible recipes using these ingredients. For the first recipe, provide the full recipe with every step.";
    
    let finalPrompt = basePrompt;
    if (prompt) {
      finalPrompt = `${prompt}\n\n${basePrompt}`;
    }

    userContent.push({ type: "text", text: finalPrompt });

    if (image) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: image,
        },
      });
    }

    if (prompt || image) {
        messages.push({
            role: "user",
            content: userContent,
        });
    }

    const chat = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // Use the multimodal model
      messages: messages.filter(Boolean) as any,
      temperature: 0.4,
    });
    return res.status(200).json({ text: chat.choices[0].message?.content ?? "" });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? "LLM error" });
  }
}