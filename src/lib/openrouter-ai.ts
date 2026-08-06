import OpenAI from "openai";

/**
 * OpenRouter AI: single model.
 * google/gemini-3.1-flash-lite (multimodal, high-volume, low latency)
 */
const MODEL = "google/gemini-3.1-flash-lite";

export function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function openRouterModel() {
  return process.env.OPENROUTER_MODEL?.trim() || MODEL;
}

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is missing. Add your OpenRouter key to .env."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "MealWorks",
    },
  });
}

/** Strip fences and grab outermost JSON object/array. */
function sliceJsonBlob(raw: string): string {
  let s = raw
    .replace(/```json\s*/gi, "```")
    .replace(/```/g, "")
    .trim();

  // Prefer object; fall back to array
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else if (arrStart >= 0) start = arrStart;
  if (start < 0) return s;
  s = s.slice(start);

  // Truncate junk after balanced structure when possible
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end >= 0) return s.slice(0, end + 1);
  return s;
}

/** Fix common LLM JSON mistakes and truncated payloads. */
function repairJsonText(input: string): string {
  let s = sliceJsonBlob(input);

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Remove BOM / weird whitespace
  s = s.replace(/^\uFEFF/, "");

  // If truncated mid-structure, close open brackets/braces
  // First: if ends inside a string, close the string
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
  }
  if (inStr) s += '"';

  // Drop incomplete trailing key-value (e.g. ,"name": or ,"name": "foo
  s = s.replace(/,\s*"[^"]*"\s*:\s*("[^"]*)?$/g, "");
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/g, "");
  s = s.replace(/,\s*$/g, "");
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Balance brackets
  const stack: string[] = [];
  inStr = false;
  esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      if (stack.length && stack[stack.length - 1] === c) stack.pop();
    }
  }
  while (stack.length) s += stack.pop();

  // Final trailing-comma cleanup after closing
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

export function extractJson<T>(raw: string): T {
  const attempts = [
    () => JSON.parse(sliceJsonBlob(raw)) as T,
    () => JSON.parse(repairJsonText(raw)) as T,
    () => {
      // Sometimes model wraps in array or double-encodes
      const repaired = repairJsonText(raw);
      const once = JSON.parse(repaired);
      if (typeof once === "string") return JSON.parse(once) as T;
      return once as T;
    },
  ];

  let last: unknown;
  for (const tryParse of attempts) {
    try {
      return tryParse();
    } catch (e) {
      last = e;
    }
  }

  const hint =
    last instanceof Error ? last.message : "unknown parse error";
  throw new Error(
    `AI returned invalid JSON (${hint}). Try Refresh again.`
  );
}

export function friendlyOpenRouterError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("429") ||
    /rate.?limit/i.test(msg) ||
    /quota/i.test(msg) ||
    /too many requests/i.test(msg)
  ) {
    return "OpenRouter rate limit hit. Wait a minute and try again.";
  }
  if (/invalid JSON|Expected ','|JSON at position/i.test(msg)) {
    return msg;
  }
  return msg.length > 300 ? msg.slice(0, 300) + "..." : msg;
}

function stripEmDashes(s: string) {
  return s.replace(/\u2014|\u2013/g, "-");
}

type CallOpts = { temperature?: number; maxTokens?: number };

async function chat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: CallOpts
) {
  const client = getClient();
  const model = openRouterModel();
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: opts?.temperature ?? 0.1,
      max_tokens: opts?.maxTokens ?? 8192,
      response_format: { type: "json_object" },
      messages,
    });
    const text = res.choices[0]?.message?.content || "";
    if (!text.trim()) throw new Error("Empty response");
    // Log finish reason when truncated (helps debug)
    const finish = res.choices[0]?.finish_reason;
    if (finish === "length") {
      console.warn("[openrouter] response truncated (max_tokens); repairing JSON");
    }
    return { text, model, finishReason: finish };
  } catch (err) {
    console.error(`[openrouter] ${model} failed`, err);
    throw new Error(friendlyOpenRouterError(err));
  }
}

/** Text (prefs + match). */
export async function orText(system: string, user: string, opts?: CallOpts) {
  return chat(
    [
      {
        role: "system",
        content:
          stripEmDashes(system) +
          "\n\nNever use em dashes. Use commas or hyphens. Valid compact JSON only. No trailing commas. No comments.",
      },
      { role: "user", content: stripEmDashes(user) },
    ],
    opts
  );
}

/**
 * Call text model, parse JSON; on parse/empty failure retry once with a fix prompt.
 */
export async function orTextJson<T>(
  system: string,
  user: string,
  opts?: CallOpts
): Promise<{ data: T; model: string; attempts: number }> {
  let lastErr: unknown;
  let lastText = "";
  const baseTokens = opts?.maxTokens ?? 4096;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const userMsg =
        attempt === 1
          ? user
          : `${user}\n\nPREVIOUS OUTPUT WAS INVALID JSON. Return ONLY valid compact JSON matching the schema. No markdown, no comments, no trailing commas.`;
      const { text, model } = await orText(system, userMsg, {
        ...opts,
        maxTokens:
          attempt === 1 ? baseTokens : Math.min(baseTokens + 2048, 16000),
      });
      lastText = text;
      const data = extractJson<T>(text);
      return { data, model, attempts: attempt };
    } catch (err) {
      lastErr = err;
      console.warn(
        `[openrouter] orTextJson attempt ${attempt} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`AI JSON failed after retries. Snippet: ${lastText.slice(0, 120)}`);
}

/** Vision (menu photo). Same single model. */
export async function orVision(
  system: string,
  userText: string,
  imageDataUrl: string,
  opts?: CallOpts
) {
  return chat(
    [
      {
        role: "system",
        content:
          stripEmDashes(system) +
          "\n\nNever use em dashes. Use commas or hyphens. Valid compact JSON only. No trailing commas. No comments.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: stripEmDashes(userText) },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    opts
  );
}
