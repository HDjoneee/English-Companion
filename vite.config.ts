import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
};

export default defineConfig({
  plugins: [react(), transcriptionApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});

function transcriptionApiPlugin() {
  return {
    name: "local-transcription-api",
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

        if (url !== "/api/transcribe") {
          next();
          return;
        }

        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          sendJson(res, 503, {
            error: "未配置 OPENAI_API_KEY，无法使用稳定云端转写。"
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
              error: payload.error?.message || "云端转写请求失败。"
            });
            return;
          }

          sendJson(res, 200, { text: payload.text || "" });
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "本地转写服务异常。"
          });
        }
      });
    }
  };
}

function sendJson(res: any, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
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
