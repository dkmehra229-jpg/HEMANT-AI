
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet());

app.use(express.json({ limit: "20kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "HEMANT AI Tutor",
    message: "Server is running"
  });
});

app.use("/api", apiLimiter);

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "OPENAI_API_KEY Render में सेट नहीं है।"
      });
    }

    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "अपना सवाल लिखकर भेजें।"
      });
    }

    const safeMessages = messages.slice(-12).map((m) => {
      if (
        !m ||
        !["user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" ||
        m.content.length > 4000
      ) {
        throw new Error("INVALID_MESSAGES");
      }

      return {
        role: m.role,
        content: m.content
      };
    });

    if (safeMessages.at(-1).role !== "user") {
      return res.status(400).json({
        error: "पहले अपना सवाल भेजें।"
      });
    }

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions:
        "You are HEMANT AI Tutor, a helpful Hindi study assistant. " +
        "Explain concepts in simple Hindi. Help with Rajasthan CET, " +
        "GK, reasoning, maths, computers and exam preparation. " +
        "Be honest when unsure. Do not invent exam notifications or facts.",
      input: safeMessages
    });

    return res.json({
      reply: response.output_text || "कृपया सवाल दोबारा पूछें।"
    });
  } catch (error) {
    if (error.message === "INVALID_MESSAGES") {
      return res.status(400).json({
        error: "सवाल का प्रारूप सही नहीं है।"
      });
    }

    console.error("AI request failed:", error.status || error.message);

    if (error.status === 401) {
      return res.status(502).json({
        error: "API key गलत है। Render में अपनी API key जाँचें।"
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: "API की सीमा या बैलेंस की समस्या है। API usage जाँचें।"
      });
    }

    return res.status(502).json({
      error: "AI से जवाब नहीं मिला। Server logs और API सेटिंग जाँचें।"
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HEMANT AI Tutor listening on port ${PORT}`);
});
        
