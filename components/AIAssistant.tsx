import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, CanvasImageElement } from '../types';
import { ICONS } from '../constants';

interface AIAssistantProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  canvasElements: CanvasImageElement[];
  selectedIds: string[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ messages, onSendMessage, isLoading, canvasElements, selectedIds }) => {
  const [prompt, setPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const referenceElements = selectedIds
    .map(id => canvasElements.find(el => el.id === id))
    .filter((el): el is CanvasImageElement => el !== undefined && el.visible && el.type === 'image');
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSendMessage(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="h-full bg-white flex flex-col flex-grow min-h-0">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
        <p className="text-sm text-gray-500">Describe what you want to create or edit.</p>
      </div>

      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-sm rounded-2xl px-4 py-2 ${
                message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              {message.images && message.images.length > 0 && (
                 <div className="mt-2 grid grid-cols-2 gap-2">
                    {message.images.map((img, index) => (
                        <img key={index} src={img} alt="Generated content" className="rounded-lg object-cover" />
                    ))}
                 </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="bg-gray-100 text-gray-800 rounded-2xl px-4 py-3 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="ml-3 text-sm">Generating image...</span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-700 mb-1">References ({referenceElements.length})</h3>
            <div className="flex gap-2 p-2 bg-gray-50 rounded-lg h-[70px] items-center overflow-x-auto">
                {referenceElements.length > 0 ? (
                    referenceElements.map((el, index) => (
                        <div key={el.id} className="relative flex-shrink-0">
                            <img src={el.src} className="w-12 h-12 rounded-md object-cover border-2 border-blue-400"/>
                            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{index + 1}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-gray-400 px-2">Select visible images on the canvas to use as references for the AI.</p>
                )}
            </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., add a hat to person #1"
            className="flex-grow p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:outline-none transition"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="p-3 bg-blue-500 text-white rounded-xl disabled:bg-gray-300 hover:bg-blue-600 transition-colors shadow-sm"
            disabled={isLoading || !prompt.trim() || referenceElements.length === 0}
            aria-label="Send message"
          >
            {ICONS.send}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;