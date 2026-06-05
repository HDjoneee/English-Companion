import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
};

export default defineConfig({
  plugins: [react(), localAiApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});

function localAiApiPlugin() {
  return {
    name: "local-ai-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: () => void) => {
        const url = req.url || "";

        if (url === "/api/transcribe/health") {
          sendJson(res, 200, {
            configured: Boolean(process.env.OPENAI_API_KEY),
            model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1"
          });
          return;
        }

        if (url === "/api/coach-turn/health") {
          sendJson(res, 200, {
            configured: Boolean(process.env.MINIMAX_API_KEY),
            provider: "minimax",
            model: process.env.MINIMAX_CHAT_MODEL || "MiniMax-M3"
          });
          return;
        }

        if (url === "/api/transcribe") {
          await handleTranscribe(req, res);
          return;
        }

        if (url === "/api/coach-turn") {
          await handleCoachTurn(req, res);
          return;
        }

        next();
      });
    }
  };
}

async function handleTranscribe(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      error: "OPENAI_API_KEY is not configured. Stable cloud transcription is unavailable."
    });
    return;
  }

  try {
    const audio = await readRequestBody(req);
    if (audio.byteLength < 1200) {
      sendJson(res, 200, { text: "" });
      return;
    }

    const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "audio/webm";
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
    const audioPart = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
    const formData = new FormData();
    formData.append("model", model);
    formData.append("language", "en");
    formData.append("response_format", "json");
    formData.append("file", new Blob([audioPart], { type: contentType }), "speech.webm");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });
    const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };

    if (!response.ok) {
      sendJson(res, response.status, {
        error: payload.error?.message || "Cloud transcription request failed."
      });
      return;
    }

    sendJson(res, 200, { text: payload.text || "" });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Local transcription service failed."
    });
  }
}

async function handleCoachTurn(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      configured: false,
      error: "MINIMAX_API_KEY is not configured."
    });
    return;
  }

  try {
    const requestBody = await readJsonBody(req);
    const model = process.env.MINIMAX_CHAT_MODEL || "MiniMax-M3";
    const response = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert English speaking coach. Return strict JSON only: {\"coachResponse\":\"...\",\"suggestions\":[\"...\"]}. coachResponse must be natural spoken English and include a concise follow-up question. suggestions must be brief Chinese coaching notes."
          },
          {
            role: "user",
            content: JSON.stringify(requestBody)
          }
        ],
        temperature: 0.45,
        max_tokens: 700
      })
    });
    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      sendJson(res, response.status, {
        configured: true,
        error: payload.error?.message || "MiniMax coach request failed."
      });
      return;
    }

    const content = payload.choices?.[0]?.message?.content || "";
    const parsed = parseJsonFromModel(content);
    sendJson(res, 200, {
      configured: true,
      coachResponse: typeof parsed.coachResponse === "string" ? parsed.coachResponse : "",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((item) => typeof item === "string") : []
    });
  } catch (error) {
    sendJson(res, 500, {
      configured: true,
      error: error instanceof Error ? error.message : "MiniMax coach service failed."
    });
  }
}

function parseJsonFromModel(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as { coachResponse?: unknown; suggestions?: unknown };
  } catch {
    return { coachResponse: cleaned, suggestions: [] };
  }
}

function sendJson(res: any, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: any) {
  const body = await readRequestBody(req);
  const text = new TextDecoder().decode(body);
  return text ? JSON.parse(text) : {};
}

function readRequestBody(req: any): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    req.on("data", (chunk: Uint8Array | string) => {
      const part = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
      chunks.push(part);
      totalLength += part.byteLength;
    });
    req.on("end", () => {
      const body = new Uint8Array(totalLength);
      let offset = 0;
      chunks.forEach((chunk) => {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      });
      resolve(body);
    });
    req.on("error", reject);
  });
}
