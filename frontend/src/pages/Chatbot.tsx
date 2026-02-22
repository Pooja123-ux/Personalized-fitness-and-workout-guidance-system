import { useEffect, useRef, useState } from 'react';
import api from '../api';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  meta?: {
    category?: string;
    confidence?: number;
    sources?: string[];
    followUpQuestions?: string[];
  };
};

const SpeechRecognition =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition;

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

const QUICK_PROMPTS = [
  'Beginner workout plan',
  'High protein Indian foods',
  'How much water should I drink?',
  'Best exercises for fat loss',
  'How to recover from muscle soreness?'
];

function Chatbot() {
  const [question, setQuestion] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Ask me any fitness or nutrition question. I can answer common guidance and dataset-backed questions on exercises, Indian foods, diet recommendations, health conditions, and yoga.',
      meta: {
        category: 'intro',
        confidence: 0.95
      }
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!recognition) return;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion((prev) => prev + (prev ? ' ' : '') + transcript);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleListening = () => {
    if (!recognition) {
      alert('Voice recognition is not supported in this browser.');
      return;
    }
    if (listening) {
      recognition.stop();
    } else {
      setListening(true);
      recognition.start();
    }
  };

  const addUserMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: text.trim()
      }
    ]);
  };

  const addAssistantMessage = (
    text: string,
    meta?: ChatMessage['meta']
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: text?.trim() || "I couldn't generate a response. Please try again.",
        meta
      }
    ]);
  };

  const askTextQuestion = async (text: string) => {
    const res = await api.post('/chat/public-ask', {
      question: text
    });

    const payload = res?.data || {};
    addAssistantMessage(payload.answer || 'No answer returned.', {
      category: payload.category,
      confidence: payload.confidence,
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      followUpQuestions: Array.isArray(payload.follow_up_questions)
        ? payload.follow_up_questions.slice(0, 3)
        : []
    });
  };

  const askWithImages = async (text: string) => {
    const formData = new FormData();
    formData.append('message', text);
    images.forEach((img) => formData.append('images', img));

    const res = await api.post('/chat/ask', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    addAssistantMessage(res?.data?.answer || 'No answer returned.');
    setImages([]);
  };

  const ask = async (overrideQuestion?: string) => {
    const prompt = (overrideQuestion ?? question).trim();
    if (!prompt && images.length === 0) return;

    try {
      setLoading(true);
      if (prompt) addUserMessage(prompt);
      if (!overrideQuestion) setQuestion('');

      if (images.length > 0) {
        await askWithImages(prompt);
      } else {
        await askTextQuestion(prompt);
      }
    } catch (err) {
      console.error(err);
      addAssistantMessage(
        'I ran into an error while processing that. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setImages((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-page">
      <div className="chat-shell">
        <header className="chat-header">
          <div className="brand">
            <span className="dot" />
            <div>
              <strong>Fitness Assistant</strong>
              <p>General + dataset-backed answers</p>
            </div>
          </div>
          <span className="status-pill">{loading ? 'Thinking...' : 'Online'}</span>
        </header>

        <div className="quick-prompts">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              disabled={loading}
              onClick={() => ask(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="chat-body">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`msg-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="msg-bubble">
                <p>{msg.text}</p>

                {msg.role === 'assistant' && msg.meta?.followUpQuestions && msg.meta.followUpQuestions.length > 0 && (
                  <div className="followups">
                    {msg.meta.followUpQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="followup-chip"
                        disabled={loading}
                        onClick={() => ask(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && (msg.meta?.category || typeof msg.meta?.confidence === 'number') && (
                  <div className="meta">
                    {msg.meta?.category && <span>{msg.meta.category}</span>}
                    {typeof msg.meta?.confidence === 'number' && (
                      <span>{Math.round(msg.meta.confidence * 100)}% confidence</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant">
              <div className="msg-bubble loading-bubble">
                <span className="loader-dot" />
                <span className="loader-dot" />
                <span className="loader-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-footer">
          {images.length > 0 && (
            <div className="preview-grid">
              {images.map((img, idx) => (
                <div key={`${img.name}-${idx}`} className="thumb">
                  <img src={URL.createObjectURL(img)} alt="upload preview" />
                  <button type="button" onClick={() => removeImage(idx)}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="composer">
            <label className="icon-btn" title="Upload images">
              +
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
            </label>

            <button
              type="button"
              className={`icon-btn ${listening ? 'active' : ''}`}
              onClick={toggleListening}
              title="Voice input"
            >
              {listening ? 'Stop' : 'Mic'}
            </button>

            <input
              className="text-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                listening ? 'Listening...' : 'Ask any fitness or nutrition question...'
              }
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />

            <button
              type="button"
              className="send-btn"
              onClick={() => ask()}
              disabled={loading || (!question.trim() && images.length === 0)}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap');

        :root {
          --bg: #f4f7f2;
          --panel: #ffffff;
          --line: #d4dfd0;
          --ink: #17261f;
          --muted: #5a6e64;
          --brand: #1e7b52;
          --brand-dark: #165d3e;
          --bubble-assistant: #e8f2eb;
          --bubble-user: #1e7b52;
        }

        .chat-page {
          min-height: 100vh;
          padding: 24px 14px;
          background:
            radial-gradient(circle at 20% 0%, #dff3e8 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, #e8efe3 0%, transparent 45%),
            var(--bg);
          font-family: 'Manrope', sans-serif;
        }

        .chat-shell {
          max-width: 980px;
          margin: 0 auto;
          border: 1px solid var(--line);
          border-radius: 26px;
          background: var(--panel);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 48px);
        }

        .chat-header {
          padding: 16px 18px;
          border-bottom: 1px solid var(--line);
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          background: linear-gradient(135deg, #f5faf7 0%, #eef5f0 100%);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand strong {
          color: var(--ink);
          font-size: 1.05rem;
        }

        .brand p {
          margin: 0;
          color: var(--muted);
          font-size: 0.8rem;
          font-weight: 600;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #25c372;
          box-shadow: 0 0 0 6px rgba(37, 195, 114, 0.14);
        }

        .status-pill {
          border: 1px solid #bad8c8;
          border-radius: 999px;
          padding: 6px 10px;
          color: var(--brand-dark);
          font-size: 0.78rem;
          font-weight: 800;
          background: #eef9f2;
        }

        .quick-prompts {
          padding: 12px 18px;
          border-bottom: 1px solid var(--line);
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          background: #fcfefc;
        }

        .chip {
          border: 1px solid #c7d9ce;
          border-radius: 999px;
          background: #f5faf7;
          color: #214e37;
          padding: 7px 11px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
        }

        .chip:hover:not(:disabled) {
          background: #eaf6ef;
        }

        .chat-body {
          flex: 1;
          overflow: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: linear-gradient(180deg, #fbfdfa 0%, #f8fbf8 100%);
        }

        .msg-row {
          display: flex;
        }

        .msg-row.user {
          justify-content: flex-end;
        }

        .msg-row.assistant {
          justify-content: flex-start;
        }

        .msg-bubble {
          max-width: min(82%, 760px);
          border-radius: 18px;
          padding: 11px 13px;
          border: 1px solid transparent;
          animation: fadeIn 0.2s ease-out;
        }

        .msg-row.assistant .msg-bubble {
          background: var(--bubble-assistant);
          color: #1f3329;
          border-color: #cddfd3;
          border-bottom-left-radius: 4px;
        }

        .msg-row.user .msg-bubble {
          background: var(--bubble-user);
          color: #ffffff;
          border-color: #1a6947;
          border-bottom-right-radius: 4px;
        }

        .msg-bubble p {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.5;
          font-weight: 600;
          font-size: 0.92rem;
        }

        .followups {
          margin-top: 10px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .followup-chip {
          border: 1px solid #b7ccc0;
          background: #f4faf6;
          color: #23563d;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
        }

        .meta {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          color: #4f6d5d;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .loading-bubble {
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }

        .loader-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #5c7367;
          animation: pulse 0.9s infinite ease-in-out;
        }

        .loader-dot:nth-child(2) { animation-delay: 0.15s; }
        .loader-dot:nth-child(3) { animation-delay: 0.3s; }

        .chat-footer {
          border-top: 1px solid var(--line);
          padding: 12px;
          background: #f8fcf8;
        }

        .preview-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .thumb {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #cfe1d6;
        }

        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumb button {
          position: absolute;
          top: 2px;
          right: 2px;
          border: none;
          border-radius: 999px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          color: white;
          background: #c73636;
          font-size: 0.72rem;
          line-height: 1;
        }

        .composer {
          display: flex;
          gap: 8px;
          align-items: center;
          border: 1px solid #c7d9ce;
          border-radius: 14px;
          padding: 7px;
          background: #ffffff;
        }

        .icon-btn,
        .send-btn {
          border: 1px solid #c5d6cb;
          border-radius: 10px;
          background: #f7fbf8;
          color: #22553c;
          height: 36px;
          font-weight: 800;
          cursor: pointer;
        }

        .icon-btn {
          min-width: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
        }

        .icon-btn.active {
          background: #ffe8e8;
          border-color: #f0b0b0;
          color: #9d1d1d;
        }

        .text-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 0.92rem;
          font-weight: 600;
          color: #1d3127;
          font-family: inherit;
        }

        .send-btn {
          min-width: 74px;
          background: var(--brand);
          border-color: var(--brand);
          color: #ffffff;
          padding: 0 14px;
        }

        .send-btn:disabled,
        .chip:disabled,
        .followup-chip:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @keyframes pulse {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-2px); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 700px) {
          .chat-page {
            padding: 0;
          }
          .chat-shell {
            border-radius: 0;
            min-height: 100vh;
            max-width: 100%;
          }
          .msg-bubble {
            max-width: 92%;
          }
          .quick-prompts {
            padding: 10px 12px;
          }
          .chat-body {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default Chatbot;
