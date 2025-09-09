import React from 'react';
import type { CanvasTextElement } from '../types';
import { ICONS } from '../constants';

interface TextToolbarProps {
  selectedElement: CanvasTextElement;
  onUpdate: (props: Partial<CanvasTextElement>) => void;
}

const StyleButton: React.FC<{
    // FIX: Made the `icon` prop optional to allow buttons with text children.
    icon?: JSX.Element;
    label: string;
    isActive: boolean;
    onClick: () => void;
    children?: React.ReactNode;
    className?: string;
}> = ({ icon, label, isActive, onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`p-2 rounded-md transition-colors duration-200 ${
      isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    } ${className}`}
  >
    {children || icon}
  </button>
);

const ColorInput: React.FC<{ value: string; onChange: (color: string) => void; title: string; }> = ({ value, onChange, title }) => (
    <div className="relative w-7 h-7 rounded-md border border-gray-300 overflow-hidden">
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -top-1 -left-1 w-10 h-10 cursor-pointer"
            title={title}
        />
    </div>
);

const NumberInput: React.FC<{ value: number; onChange: (value: number) => void; label: string; min?: number; step?: number; }> = ({ value, onChange, label, min, step }) => (
    <div className="flex flex-col items-center">
        <input
            type="number"
            value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="w-14 p-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            min={min}
            step={step}
        />
        <label className="text-xs text-gray-500 mt-0.5">{label}</label>
    </div>
);


const TextToolbar: React.FC<TextToolbarProps> = ({ selectedElement, onUpdate }) => {
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10);
    if (!isNaN(newSize) && newSize > 0) {
      onUpdate({ fontSize: newSize, height: newSize * 1.2 });
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 p-2 flex items-center flex-wrap gap-x-4 gap-y-2 z-10 flex-shrink-0">
      {/* STYLE */}
      <div className="flex items-center gap-1">
        <StyleButton
          icon={ICONS.bold}
          label="Bold"
          isActive={selectedElement.fontWeight === 'bold'}
          onClick={() => onUpdate({ fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}
        />
        <StyleButton
          icon={ICONS.italic}
          label="Italic"
          isActive={selectedElement.fontStyle === 'italic'}
          onClick={() => onUpdate({ fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}
        />
        <StyleButton
          icon={ICONS.underline}
          label="Underline"
          isActive={selectedElement.textDecoration === 'underline'}
          onClick={() => onUpdate({ textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })}
        />
      </div>

      <div className="h-6 w-px bg-gray-300" />
      
      {/* SIZE */}
      <div className="flex items-center gap-2">
        <label htmlFor="font-size" className="text-sm text-gray-600">Size:</label>
        <input
          id="font-size"
          type="number"
          value={Math.round(selectedElement.fontSize)}
          onChange={handleFontSizeChange}
          className="w-16 p-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      <div className="h-6 w-px bg-gray-300" />

      {/* FILL */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Fill:</label>
        <StyleButton label="Solid" isActive={selectedElement.fillType === 'solid'} onClick={() => onUpdate({ fillType: 'solid' })} className="text-xs px-2 h-8">Solid</StyleButton>
        <StyleButton label="Gradient" isActive={selectedElement.fillType === 'gradient'} onClick={() => onUpdate({ fillType: 'gradient' })} icon={ICONS.gradient}/>
        {selectedElement.fillType === 'solid' ? (
          <ColorInput value={selectedElement.color} onChange={color => onUpdate({ color })} title="Text color" />
        ) : (
          <div className="flex items-center gap-2 ml-2 p-2 bg-gray-100 rounded-lg">
            <ColorInput value={selectedElement.gradientColors[0]} onChange={color => onUpdate({ gradientColors: [color, selectedElement.gradientColors[1]] })} title="Gradient start color" />
            <ColorInput value={selectedElement.gradientColors[1]} onChange={color => onUpdate({ gradientColors: [selectedElement.gradientColors[0], color] })} title="Gradient end color" />
            <select
                value={selectedElement.gradientDirection}
                onChange={e => onUpdate({ gradientDirection: e.target.value })}
                className="p-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none h-7"
            >
                <option value="to right">→ Right</option>
                <option value="to bottom">↓ Down</option>
                <option value="to top">↑ Up</option>
                <option value="to left">← Left</option>
                <option value="to bottom right">↘ SE</option>
                <option value="to top left">↖ NW</option>
            </select>
          </div>
        )}
      </div>

      <div className="h-6 w-px bg-gray-300" />

      {/* OUTLINE */}
      <div className="flex items-center gap-2">
         <StyleButton
            icon={ICONS.outline}
            label="Outline"
            isActive={selectedElement.outlineEnabled}
            onClick={() => onUpdate({ outlineEnabled: !selectedElement.outlineEnabled })}
        />
        {selectedElement.outlineEnabled && (
          <div className="flex items-center gap-2 ml-2 p-2 bg-gray-100 rounded-lg">
            <ColorInput value={selectedElement.outlineColor} onChange={outlineColor => onUpdate({ outlineColor })} title="Outline color" />
            <NumberInput value={selectedElement.outlineWidth} onChange={outlineWidth => onUpdate({ outlineWidth })} label="Width" min={0} />
          </div>
        )}
      </div>

      <div className="h-6 w-px bg-gray-300" />

      {/* SHADOW */}
      <div className="flex items-center gap-2">
        <StyleButton
            icon={ICONS.shadow}
            label="Shadow"
            isActive={selectedElement.shadowEnabled}
            onClick={() => onUpdate({ shadowEnabled: !selectedElement.shadowEnabled })}
        />
        {selectedElement.shadowEnabled && (
          <div className="flex items-end gap-2 ml-2 p-2 bg-gray-100 rounded-lg">
            <ColorInput value={selectedElement.shadowColor} onChange={shadowColor => onUpdate({ shadowColor })} title="Shadow color" />
            <NumberInput value={selectedElement.shadowOffsetX} onChange={shadowOffsetX => onUpdate({ shadowOffsetX })} label="X" />
            <NumberInput value={selectedElement.shadowOffsetY} onChange={shadowOffsetY => onUpdate({ shadowOffsetY })} label="Y" />
            <NumberInput value={selectedElement.shadowBlur} onChange={shadowBlur => onUpdate({ shadowBlur })} label="Blur" min={0} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TextToolbar;