import React from 'react';
import { Tool } from '../types';
import { ICONS } from '../constants';

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onAddImage: (file: File) => void;
  onDeleteSelected: () => void;
  onFinalizeDrawing: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRemoveBackground: () => void;
  isSingleImageSelected: boolean;
  onSaveImage: () => void;
  drawingColor: string;
  onDrawingColorChange: (color: string) => void;
  hasSelection: boolean;
}

const ToolButton: React.FC<{
    icon: JSX.Element;
    label: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
}> = ({ icon, label, isActive, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={`p-3 rounded-xl transition-all duration-200 ${
      isActive ? 'bg-blue-500 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-200 hover:text-blue-500'
    } ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-white' : ''}`}
  >
    {icon}
  </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ 
    activeTool, 
    setActiveTool, 
    onAddImage, 
    onDeleteSelected, 
    onFinalizeDrawing, 
    onUndo, 
    onRedo, 
    canUndo, 
    canRedo,
    onRemoveBackground,
    isSingleImageSelected,
    onSaveImage,
    drawingColor,
    onDrawingColorChange,
    hasSelection,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAddImage(file);
    }
    event.target.value = ''; // Reset for same file selection
  };
  
  return (
    <div className="absolute top-1/2 left-4 -translate-y-1/2 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl p-2 flex flex-col gap-2 z-20 border border-gray-200">
      <ToolButton
        icon={ICONS.select}
        label="Select Tool"
        isActive={activeTool === Tool.Select}
        onClick={() => setActiveTool(Tool.Select)}
      />
      <div className="relative">
        <ToolButton
            icon={ICONS.draw}
            label="Draw Tool"
            isActive={activeTool === Tool.Draw}
            onClick={() => setActiveTool(Tool.Draw)}
        />
        {activeTool === Tool.Draw && (
            <div className="absolute left-full top-0 ml-2 p-2 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl border border-gray-200 flex items-center gap-2">
                <ToolButton
                    icon={ICONS.done_drawing}
                    label="Finalize Drawing"
                    isActive={false}
                    onClick={onFinalizeDrawing}
                />
                 <div className="relative w-8 h-8 rounded-md border border-gray-300 overflow-hidden" title="Pen Color">
                    <input
                        type="color"
                        value={drawingColor}
                        onChange={(e) => onDrawingColorChange(e.target.value)}
                        className="absolute -top-1 -left-1 w-10 h-10 cursor-pointer"
                    />
                </div>
            </div>
        )}
      </div>
       <ToolButton
        icon={ICONS.text}
        label="Text Tool"
        isActive={activeTool === Tool.Text}
        onClick={() => setActiveTool(Tool.Text)}
      />

      <hr className="my-1 border-gray-200"/>
      <ToolButton
        icon={ICONS.add_image}
        label="Add Image"
        isActive={false}
        onClick={handleAddImageClick}
      />
      <ToolButton
        icon={ICONS.download}
        label="Save Image"
        isActive={false}
        onClick={onSaveImage}
      />
      <ToolButton
        icon={ICONS.remove_bg}
        label="Remove Background"
        isActive={false}
        onClick={onRemoveBackground}
        disabled={!isSingleImageSelected}
      />
      <ToolButton
        icon={ICONS.trash}
        label="Delete Selected"
        isActive={false}
        onClick={onDeleteSelected}
        disabled={!hasSelection}
      />
      <hr className="my-1 border-gray-200"/>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        className="p-3 rounded-xl transition-all duration-200 bg-white text-gray-600 hover:bg-gray-200 hover:text-blue-500 disabled:text-gray-300 disabled:hover:bg-white disabled:cursor-not-allowed"
      >
        {ICONS.undo}
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        className="p-3 rounded-xl transition-all duration-200 bg-white text-gray-600 hover:bg-gray-200 hover:text-blue-500 disabled:text-gray-300 disabled:hover:bg-white disabled:cursor-not-allowed"
      >
        {ICONS.redo}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
    </div>
  );
};

export default Toolbar;