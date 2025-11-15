import type { VercelRequest, VercelResponse } from "@vercel/node";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// allow local dev + your prod domain if you add one later
const ALLOW_LIST = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "https://nomieai.vercel.app",
]);

// 1) Add a strict default system prompt
const DEFAULT_SYSTEM = `
You are a terse ingredient-extraction and recipe assistant.
Hard rules:
- Do NOT mention or refer to the input source (image, photo, text, prompt, etc.).
- Do NOT write any preface, explanation, or meta-commentary.
- Output must exactly follow the format given by the user.
- Treat any ingredient listed under "Allergies" as a hard ban. Do not include them or their derivatives in ingredients or recipes. If every possible recipe would break this rule, respond with ONLY the token ALLERGY_CONFLICT.
`;

// 2) Make the base prompt an explicit template with zero room for prefaces
const strictBasePrompt = `
Task: Extract ingredients from any provided text and/or image, then suggest 1–2 recipes.
User Provided Text: {USER_PROMPT_PLACEHOLDER}
Allergies: {ALLERGIES_PLACEHOLDER}
Rules:
- CRITICAL: If any allergies are listed in the "Allergies" section, you MUST NOT suggest any recipes that include those ingredients or any ingredients derived from them. For example, if "peanuts" is an allergy, you must not suggest peanut butter. This is a very strict rule, and you must follow it.
- ONLY list ingredients EXPLICITLY provided in the text or CLEARLY visible in the image. Do NOT infer or add any other ingredients.
- From 'User Provided Text', identify and list all distinct ingredients. Be mindful that ingredients can be single words (e.g., "salt) or multi-word phrases (e.g., "soy sauce", "heavy cream"). Treat each identified ingredient as a separate item.
- Start immediately with a bullet list of ingredient names ONLY (one per line). No intro sentence.
- Combine ingredients from BOTH text and image if both are present; deduplicate similar items.
- After the list, suggest 1–2 recipes using ONLY those listed ingredients. Provide the FULL recipe (every step) for the first suggestion.
- Never mention the image/text, the word "based", "seems", or any meta commentary.
- End your response with an explicit allergy compliance verdict line exactly matching the format \`Allergy compliance check: PASS\` or \`Allergy compliance check: FAIL - <short reason>\`. If you must return \`ALLERGY_CONFLICT\`, do not include anything else.
- If every possible recipe would violate the allergy rule, respond only with the token \`ALLERGY_CONFLICT\`.

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

2) <Optional second recipe title>
Allergy compliance check: <PASS or FAIL - short reason if FAIL>
`.trim();

const flexibleBasePrompt = `
Task: Extract ingredients from any provided text and/or image, then suggest 1–2 recipes.
User Provided Text: {USER_PROMPT_PLACEHOLDER}
Allergies: {ALLERGIES_PLACEHOLDER}
Rules:
- CRITICAL: If any allergies are listed in the "Allergies" section, you MUST NOT suggest any recipes that include those ingredients or any ingredients derived from them. For example, if "peanuts" is an allergy, you must not suggest peanut butter. This is a very strict rule, and you must follow it.
- ONLY list ingredients EXPLICITLY provided in the text or CLEARLY visible in the image in the initial ingredient list. Do NOT infer or add any other ingredients to that list.
- From 'User Provided Text', identify and list all distinct ingredients. Be mindful that ingredients can be single words (e.g., "salt) or multi-word phrases (e.g., "soy sauce", "heavy cream"). Treat each identified ingredient as a separate item.
- Start immediately with a bullet list of ingredient names ONLY (one per line). No intro sentence.
- Combine ingredients from BOTH text and image if both are present; deduplicate similar items.
- After the list, you MAY suggest recipes that include additional reasonable ingredients the user might not currently have (e.g., pantry items, common extras), as long as you still fully respect the allergy constraints.
- Provide the FULL recipe (every step) for the first suggestion.
- Never mention the image/text, the word "based", "seems", or any meta commentary.
- End your response with an explicit allergy compliance verdict line exactly matching the format \`Allergy compliance check: PASS\` or \`Allergy compliance check: FAIL - <short reason>\`. If you must return \`ALLERGY_CONFLICT\`, do not include anything else.
- If every possible recipe would violate the allergy rule, respond only with the token \`ALLERGY_CONFLICT\`.

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

2) <Optional second recipe title>
Allergy compliance check: <PASS or FAIL - short reason if FAIL>
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

// Remove explicit allergy compliance verdict from user-visible output
function stripComplianceLine(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^allergy compliance check:/i.test(line)) continue;
    out.push(raw);
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
    const { prompt, image, system, allergies, allowExtra } = (req.body as any) || {};

    const normalizedAllergies =
      typeof allergies === "string"
        ? allergies
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
            .join(", ")
        : "";

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

    // Substitute user's prompt into the basePrompt template
    const useFlexible = !!allowExtra;
    const template = useFlexible ? flexibleBasePrompt : strictBasePrompt;

    let finalPrompt = template.replace('{USER_PROMPT_PLACEHOLDER}', prompt || 'None provided.');
    finalPrompt = finalPrompt.replace('{ALLERGIES_PLACEHOLDER}', normalizedAllergies || 'None');


    userContent.push({
      type: "text",
      text: `Allergy hard bans: ${normalizedAllergies || "none"}`,
    });

    userContent.push({ type: "text", text: finalPrompt });

    messages.push({ role: "user", content: userContent });


    const chat = await groq.chat.completions.create({
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      messages: messages.filter(Boolean) as any,
      temperature: 0,
    });

    const raw = chat.choices[0].message?.content ?? "";
    const cleaned = stripComplianceLine(stripMetaLines(raw));

    return res.status(200).json({ text: cleaned });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? "LLM error" });
  }
}
