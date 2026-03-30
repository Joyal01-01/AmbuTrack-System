import express from "express";

const router = express.Router();

const SYSTEM_PROMPT = `You are AmbuBot, the support assistant for AmbuTrack — an ambulance booking and emergency response platform operating in Nepal.
...`;

const getRuleBasedResponse = (message, role) => {
  const msg = message.toLowerCase();
  
  if (msg.includes("emergency") || msg.includes("urgent") || msg.includes("help")) {
    return "🚨 **EMERGENCY**: If this is life-threatening, please call **102** (Ambulance), **100** (Police), or **101** (Fire) immediately! \n\nOn AmbuTrack, you can use the **'Emergency: Auto-Assign Nearest'** button on your dashboard to find help rapidly.";
  }
  
  if (msg.includes("book") || msg.includes("request") || msg.includes("get")) {
    return "🏥 **How to book an ambulance:** \n1. Go to your **Dashboard**.\n2. Tap any available **Ambulance Marker** (Red) on the map.\n3. Review the pricing and click **'Book This Ambulance'**.\n\nAlternatively, use the **'Request Ambulance'** button to broadcast to all nearby drivers.";
  }
  
  if (msg.includes("pay") || msg.includes("cost") || msg.includes("fare") || msg.includes("price")) {
    return "💳 **Pricing & Payment:** \n- Fares are calculated as: **Base Fare + (Distance × Per KM Rate)**.\n- You can pay via **eSewa** or **Credit/Debit Card** directly through the app after your trip is completed.";
  }

  if (msg.includes("hospital") || msg.includes("doctor") || msg.includes("clinic")) {
    return "🏥 **Nearby Hospitals:** \nCheck the map for **Green Markers**. These represent vetted hospitals and clinics within 5km of your location. Tap a marker to see their details.";
  }

  if (msg.includes("driver") && role === "patient") {
    return "👨‍✈️ **Driver Info:** \nOnce a driver accepts your request, their name, phone number, and vehicle details will appear on your screen. You can track their live location in real-time.";
  }

  if (msg.includes("online") || msg.includes("approve") || msg.includes("accept")) {
    if (role === "driver") {
       return "🚦 **For Drivers:** \n- Toggle your status to **'Online'** in your dashboard to start receiving requests.\n- If you are a new driver, please wait for **Admin Approval** (usually within 24 hours) before you can go online.";
    }
  }

  return "👋 I'm AmbuBot! I can help you with ambulance bookings, payments, finding hospitals, or emergency contacts. \n\nTry asking: *'How do I book?'* or *'What is the emergency number?'*";
};

router.post("/", async (req, res) => {
  try {
    const { message, role = "patient", history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const token = process.env.HF_TOKEN; 
    const modelId = "mistralai/Mistral-7B-Instruct-v0.3";

    if (token && token !== "your_huggingface_token_here") {
      try {
        const messages = [
          { role: "system", content: `You are AmbuBot for AmbuTrack. User role: ${role}.` },
          ...history.map(msg => ({
            role: msg.from === "user" ? "user" : "assistant",
            content: msg.text
          })),
          { role: "user", content: message.trim() }
        ];

        const aiResponse = await fetch(`https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: modelId, messages, max_tokens: 500, stream: false }),
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          return res.json({ reply: data.choices[0].message.content });
        }
      } catch (err) {
        console.error("Chat fallback triggered:", err.message);
      }
    }

    const reply = getRuleBasedResponse(message.trim(), role);
    res.json({ reply });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Sorry, I had trouble processing that. Please try again or call emergency services." });
  }
});

export default router;
