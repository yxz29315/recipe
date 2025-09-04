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

// 1) Add a strict default system prompt
const DEFAULT_SYSTEM = `
You are a terse ingredient-extraction and recipe assistant.
Hard rules:
- Do NOT mention or refer to the input source (image, photo, text, prompt, etc.).
- Do NOT write any preface, explanation, or meta-commentary.
- Output must exactly follow the format given by the user.
`;

// 2) Make the base prompt an explicit template with zero room for prefaces
const basePrompt = `
Task: Extract ingredients from any provided text and/or image, then suggest 1–2 recipes.
Rules:
- Start immediately with a bullet list of ingredient names ONLY (one per line). No intro sentence.
- Combine ingredients from BOTH text and image if both are present; deduplicate similar items.
- After the list, suggest 1–2 recipes using those ingredients. Provide the FULL recipe (every step) for the first suggestion.
- Never mention the image/text, the word "based", "seems", or any meta commentary.

Exact Format (follow precisely):
- <ingredient 1>
- <ingredient 2>
- <ingredient 3>

Recipe ideas:
1) <Recipe title>
Ingredients:
- <ingredient a>
- <ingredient b>
Steps:
1. <step>
2. <step>

2) <Optional second recipe title> (brief idea only)
`.trim();

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || "";
  const allowOrigin = ALLOW_LIST.has(origin) ? origin : "*";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// --- Safety net: strip any meta lines like "however, based on the image..." ---
function stripMetaLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let beforeRecipes = true;

  for (const raw of lines) {
    const line = raw;

    if (/^\s*recipe ideas:\s*$/i.test(line.trim())) {
      beforeRecipes = false;
      out.push(line);
      continue;
    }

    // Meta lines we don't want *before* the bullet list/recipes.
    const mentionsImage = /(image|photo|picture|upload|provided|attached)/i.test(line);
    const startsWithMeta =
      /^(however|but|based on|according to|from|in|looking at)\b/i.test(line.trim());
    const isIngredientsHeader =
      /^(?:the\s+)?ingredients?\s*(?:are|include)\b.*:?\s*$/i.test(line.trim());

    if (beforeRecipes && ((startsWithMeta && mentionsImage) || isIngredientsHeader)) {
      continue; // drop it
    }

    out.push(line);
  }

  return out.join("\n").trim();
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

    if (!prompt && !image) {
      return res.status(400).json({ error: "Provide 'prompt' text, an 'image' URL, or both." });
    }

    const messages: any[] = [
      { role: "system", content: system ? `${DEFAULT_SYSTEM}\n${system}` : DEFAULT_SYSTEM },
    ];

    const userContent: any[] = [];

    if (image) {
      userContent.push({
        type: "image_url",
        image_url: { url: image },
      });
    }

    // Let user text (if any) go first, then the strict template
    const finalPrompt = prompt ? `${prompt}\n\n${basePrompt}` : basePrompt;

    userContent.push({ type: "text", text: finalPrompt });

    messages.push({ role: "user", content: userContent });


    const chat = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: messages.filter(Boolean) as any,
      temperature: 0.4,
    });

    const raw = chat.choices[0].message?.content ?? "";
    const cleaned = stripMetaLines(raw);

    return res.status(200).json({ text: cleaned });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? "LLM error" });
  }
}