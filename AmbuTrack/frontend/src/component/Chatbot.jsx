import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, HelpCircle, ChevronRight, AlertCircle } from "lucide-react";
import api from "../api";
import "./Chatbot.css";

const QUICK_ACTIONS = {
  patient: [
    "How do I book an ambulance?",
    "How does payment work?",
    "My ambulance is taking too long",
    "I have an emergency!",
    "How do I find nearby hospitals?",
  ],
  driver: [
    "How do I accept a ride request?",
    "How does online/offline work?",
    "How do I manage a trip?",
    "How is my fare calculated?",
    "My account is pending approval",
  ],
};

export default function Chatbot({ role = "patient" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text:
        role === "driver"
          ? "Hi! 👋 I'm AmbuBot, your assistant. I can help you manage rides, earnings, and more. What do you need help with?"
          : "Hi! 👋 I'm AmbuBot, your assistant. I can help you book ambulances, track rides, find hospitals, and more. How can I help?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const historyRef = useRef([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;

    setError(null);
    setMessages((prev) => [...prev, { from: "user", text: msg }]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await api.post("/api/chat", {
        message: msg,
        role,
        history: historyRef.current,
      });

      const { reply } = res.data;

      historyRef.current = [
        ...historyRef.current,
        { from: "user", text: msg },
        { from: "bot", text: reply },
      ];

      setMessages((prev) => [...prev, { from: "bot", text: reply }]);
    } catch {
      const fallbackReply = msg.toLowerCase().includes('emergency') || msg.toLowerCase().includes('urgent')
        ? "🚨 **EMERGENCY**: If this is life-threatening, please call **102** (Ambulance), **100** (Police), or **101** (Fire) immediately!"
        : "👋 I'm AmbuBot! Something went wrong on my end. Please try one of the quick actions below.";
        
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: fallbackReply },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderText = (text) =>
    text.split("\n").map((line, j) => (
      <span key={j}>
        {line}
        <br />
      </span>
    ));

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`chatbot-fab ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Chat support"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-header-avatar">
                <HelpCircle size={18} />
              </div>
              <div>
                <div className="chatbot-header-title">AmbuBot Support</div>
                <div className="chatbot-header-status">
                  <span className="chatbot-online-dot"></span> Online
                </div>
              </div>
            </div>
            <button className="chatbot-close" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chatbot-msg ${msg.from}`}>
                {msg.from === "bot" && (
                  <div className="chatbot-msg-avatar">
                    <HelpCircle size={14} />
                  </div>
                )}
                <div className="chatbot-msg-bubble">{renderText(msg.text)}</div>
              </div>
            ))}

            {isTyping && (
              <div className="chatbot-msg bot">
                <div className="chatbot-msg-avatar">
                  <HelpCircle size={14} />
                </div>
                <div className="chatbot-msg-bubble typing">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}

            {error && (
              <div className="chatbot-error">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="chatbot-quick-actions">
            {(QUICK_ACTIONS[role] || QUICK_ACTIONS.patient).map((q, i) => (
              <button
                key={i}
                className="chatbot-quick-btn"
                onClick={() => handleSend(q)}
                disabled={isTyping}
              >
                <ChevronRight size={12} /> {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="chatbot-input-area">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="chatbot-input"
              disabled={isTyping}
            />
            <button
              className="chatbot-send"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
