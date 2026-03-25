// routes/chatRoutes.js — Google Gemini-powered chatbot endpoint
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

const SYSTEM_PROMPT = `You are AmbuBot, the AI assistant for AmbuTrack — an ambulance booking and emergency response platform operating in Nepal.

You help two types of users:
1. **Patients** — people who need an ambulance or emergency help
2. **Drivers** — ambulance operators who accept ride requests

Your knowledge covers:
- How to book an ambulance (patients tap an ambulance marker → "Book This Ambulance" or use "Emergency: Auto-Assign Nearest")
- Payment: base fare + per-km rate, paid via Credit Card or eSewa after trip completion
- Cancelling a pending request
- Tracking the ambulance live on the map (blue moving marker)
- Trip flow: En Route → Arrived → Trip Started → Completed
- Driver earnings: Base Fare + (Distance × Per KM Rate), set in Settings
- Going online/offline as a driver
- Driver approval: new drivers need admin approval before they can go online
- Updating profile, vehicle info, pricing in Settings
- Finding nearby hospitals/clinics (shown on map as green markers, within 5 km)
- Emergency numbers in Nepal: Ambulance 102, Police 100, Fire 101
- Two-factor authentication (OTP via email)

Rules:
- Give comprehensive, friendly, and helpful answers to ALL queries.
- You are free to answer any general knowledge questions or act as a general AI assistant.
- Never ask for passwords or personal details
- For life-threatening emergencies, always mention calling 102 first
- Format responses with bullet points or numbered steps where appropriate, but keep it brief`;

router.post("/", async (req, res) => {
  try {
    const { message, role = "patient", history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return res.status(503).json({ error: "AI service not configured. Please add a valid GEMINI_API_KEY to the .env file." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `${SYSTEM_PROMPT}\n\nThe current user role is: ${role}.`,
    });

    // Convert stored history to Gemini format
    const geminiHistory = history.map((msg) => ({
      role: msg.from === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message.trim());
    const reply = result.response.text();

    res.json({ reply });
  } catch (err) {
    console.error("Gemini chat error:", err);
    const status = err?.status || 500;
    res.status(status).json({
      error: "Failed to get AI response. Please try again.",
    });
  }
});

export default router;
