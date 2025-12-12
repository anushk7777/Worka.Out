import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserProfile, ProgressEntry } from '../types';
import { generateTrainerResponse } from '../services/geminiService';

interface Props {
  userProfile: UserProfile;
  progressLogs: ProgressEntry[];
  onClose: () => void; // Added close prop
}

const ChatInterface: React.FC<Props> = ({ userProfile, progressLogs, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'model',
      text: `Welcome ${userProfile.name}. I am your Master Trainer. I've analyzed your stats and created your plan based on the ETF methodology. I'm ready to review your progress logs. What questions do you have?`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await generateTrainerResponse(messages, userProfile, progressLogs, userMsg.text);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark pb-0">
      {/* Header */}
      <div className="bg-secondary p-4 border-b border-gray-700 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <h2 className="text-lg font-bold text-white flex items-center">
          <i className="fas fa-robot mr-2 text-primary"></i> Master Trainer AI
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-secondary text-gray-200 rounded-tl-none border border-gray-700'
              }`}
            >
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className="mb-1">{line}</p>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary p-3 rounded-2xl rounded-tl-none border border-gray-700">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-secondary border-t border-gray-700 sticky bottom-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your progress or diet..."
            className="flex-1 bg-dark border border-gray-600 rounded-full px-4 py-2 text-white focus:border-primary outline-none"
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-orange-600 disabled:opacity-50"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;