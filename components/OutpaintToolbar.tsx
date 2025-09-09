import React from 'react';
import { ICONS } from '../constants';

interface OutpaintToolbarProps {
  position: { top: number; left: number };
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const OutpaintToolbar: React.FC<OutpaintToolbarProps> = ({
  position,
  prompt,
  onPromptChange,
  onGenerate,
  onCancel,
  isLoading,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate();
  };

  return (
    <div
      className="absolute bg-white/90 backdrop-blur-sm shadow-2xl rounded-xl p-2 flex items-center gap-2 z-50 border border-gray-200"
      style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe the new area (optional)"
          className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none transition w-64"
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="p-3 bg-blue-500 text-white rounded-xl disabled:bg-gray-300 hover:bg-blue-600 transition-colors shadow-sm"
          disabled={isLoading}
          aria-label="Generate"
        >
          {ICONS.send}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          aria-label="Cancel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </form>
    </div>
  );
};

export default OutpaintToolbar;
