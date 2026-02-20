import { useState, useEffect } from 'react';
import api from '../api';

const SpeechRecognition =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition;

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

function Chatbot() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

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

  const toggleListening = () => {
    if (!recognition)
      return alert('Voice recognition not supported in this browser.');

    if (listening) {
      recognition.stop();
    } else {
      setListening(true);
      recognition.start();
    }
  };

  async function ask() {
    if (!question.trim() && images.length === 0) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('message', question);
      images.forEach((img) => formData.append('images', img));

      const res = await api.post('/chat/ask', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAnswer(res.data.answer);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
    <div className="center-container">
      <div className="chat-card">

        {/* HEADER */}
        <header className="chat-header">
          <div className="left">
            <span className="pulse"></span>
            <strong>Fitness AI Assistant</strong>
          </div>

          <div className="right">
            <div className="rovo-icon">🤖</div>
          </div>
        </header>

        {/* BODY */}
        <div className="chat-body">
          {!answer && !loading && (
            <div className="empty">
              <p>Ask me about your workout, nutrition, or upload a progress photo for feedback.</p>
            </div>
          )}

          {loading && (
            <div className="loader">
              <div className="spinner"></div>
              <span>Analyzing your query...</span>
            </div>
          )}

          {answer && (
            <div className="bubble">
              <p>{answer}</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="chat-footer">
          <div className="preview-grid">
            {images.map((img, idx) => (
              <div key={idx} className="thumb">
                <img src={URL.createObjectURL(img)} alt="upload" />
                <button onClick={() => removeImage(idx)}>×</button>
              </div>
            ))}
          </div>

          <div className="input-row">
            <label className="icon-btn">
              📎
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
            </label>

            <button
              className={`icon-btn ${listening ? 'active' : ''}`}
              onClick={toggleListening}
            >
              {listening ? '🛑' : '🎤'}
            </button>

            <input
              className="text-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={listening ? 'I am listening...' : 'Ask anything...'}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />

            <button
              className="icon-btn send"
              onClick={ask}
              disabled={loading}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .center-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #f8fafc;
        }

        .chat-card {
          width: 100%;
          max-width: 550px;
          background: #ffffff;
          border-radius: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #f1f5f9;
        }

        .chat-header {
          padding: 24px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
        }

        .left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .left strong {
          font-weight: 800;
          font-size: 1.1rem;
          color: #1e293b;
          letter-spacing: -0.5px;
        }

        .rovo-icon {
          font-size: 1.2rem;
          background: #f1f5f9;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
        }

        .pulse {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          animation: pulse-ring 2s infinite;
        }

        .chat-body {
          height: 400px;
          padding: 28px;
          overflow-y: auto;
          background: #ffffff;
        }

        .empty {
          text-align: center;
          margin-top: 120px;
          color: #94a3b8;
          font-size: 0.95rem;
          font-weight: 500;
          padding: 0 40px;
        }

        .bubble {
          background: #f1f5f9;
          padding: 18px 22px;
          border-radius: 24px;
          border-bottom-left-radius: 4px;
          line-height: 1.6;
          color: #334155;
          font-size: 0.95rem;
          font-weight: 500;
          animation: fadeIn 0.3s ease;
        }

        .loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 120px;
          gap: 12px;
          color: #6366f1;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .chat-footer {
          padding: 24px;
          border-top: 1px solid #f1f5f9;
        }

        .preview-grid {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          flex-wrap: wrap;
        }

        .thumb {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #f1f5f9;
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
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .input-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8fafc;
          padding: 8px 12px;
          border-radius: 20px;
          border: 1px solid #f1f5f9;
        }

        .icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .icon-btn:hover {
          background: #f1f5f9;
          transform: translateY(-1px);
        }

        .icon-btn.active {
          background: #fee2e2;
          color: #ef4444;
          animation: pulse-ring 1.5s infinite;
        }

        .icon-btn.send {
          background: #6366f1;
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .icon-btn.send:hover {
          background: #4f46e5;
          box-shadow: 0 6px 15px rgba(99, 102, 241, 0.4);
        }

        .text-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 500;
          color: #1e293b;
        }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default Chatbot;