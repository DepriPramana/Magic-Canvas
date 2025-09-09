import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Moveable from 'react-moveable';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';
import AIAssistant from './components/AIAssistant';
import LayersPanel from './components/LayersPanel';
import TextToolbar from './components/TextToolbar';
import type { CanvasElement, ChatMessage, CanvasAreaHandle, Layer, CanvasGroup, CanvasImageElement, CanvasTextElement } from './types';
import { Tool } from './types';
import { generateImage, removeBackground } from './services/geminiService';

const useHistory = <T,>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = history[currentIndex];

  const setState = useCallback((action: React.SetStateAction<T>, immediate = false) => {
    const newState = typeof action === 'function'
      ? (action as (prevState: T) => T)(history[currentIndex])
      : action;
    
    if (JSON.stringify(newState) === JSON.stringify(history[currentIndex])) {
        return;
    }

    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { state, setState, undo, redo, canUndo, canRedo };
};

const initialLayers: Layer[] = [
  {
    id: 'initial-element-1',
    type: 'image',
    name: 'Astronaut',
    src: 'https://storage.googleapis.com/maker-media-posts/program-output/2024-07-25/119932170/0_1.png',
    x: 100,
    y: 150,
    width: 350,
    height: 350,
    rotation: 0,
    mimeType: 'image/png',
    visible: true,
  }
];

interface Rect { x: number; y: number; width: number; height: number; rotation: number; }

const App: React.FC = () => {
  const { 
    state: layers, 
    setState: setLayers, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<Layer[]>(initialLayers);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.Select);
  const [drawingColor, setDrawingColor] = useState<string>('#FF0000');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-message',
      role: 'system',
      content: "Welcome! Draw on the canvas and tell me what you'd like me to generate or edit."
    }
  ]);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [layersPanelHeight, setLayersPanelHeight] = useState(300);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<CanvasAreaHandle>(null);
  const moveableRef = useRef<Moveable>(null);
  const isResizingVertical = useRef(false);
  const isResizingHorizontal = useRef(false);

  const renderableElements = useMemo(() => layers.filter((l): l is CanvasElement => l.type === 'image' || l.type === 'text'), [layers]);
  const imageElements = useMemo(() => layers.filter((l): l is CanvasImageElement => l.type === 'image'), [layers]);

  const getDescendantIds = useCallback((layerId: string): string[] => {
    const descendants: string[] = [];
    const children = layers.filter(l => l.parentId === layerId);
    for (const child of children) {
        descendants.push(child.id);
        if (child.type === 'group') {
            descendants.push(...getDescendantIds(child.id));
        }
    }
    return descendants;
  }, [layers]);


  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      const idsToDelete = new Set(selectedIds);
      selectedIds.forEach(id => {
          getDescendantIds(id).forEach(descId => idsToDelete.add(descId));
      });
      setLayers(prev => prev.filter(l => !idsToDelete.has(l.id)));
      setSelectedIds([]);
    }
  }, [selectedIds, setLayers, getDescendantIds]);
  
  const clearDrawing = useCallback(() => {
    const event = new CustomEvent('clearDrawing');
    drawingCanvasRef.current?.dispatchEvent(event);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat) setIsShiftPressed(true);
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }

      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );

      if (e.key === 'Delete' && !isTyping) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, handleDeleteSelected]);

  const handleVerticalResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingVertical.current) {
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 320;
      const maxWidth = 600;
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    }
  }, []);
  const handleVerticalResizeMouseUp = useCallback(() => {
    isResizingVertical.current = false;
    document.removeEventListener('mousemove', handleVerticalResizeMouseMove);
    document.removeEventListener('mouseup', handleVerticalResizeMouseUp);
    document.body.style.cursor = 'default';
  }, [handleVerticalResizeMouseMove]);
  const handleVerticalResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingVertical.current = true;
    document.addEventListener('mousemove', handleVerticalResizeMouseMove);
    document.addEventListener('mouseup', handleVerticalResizeMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [handleVerticalResizeMouseMove, handleVerticalResizeMouseUp]);

  const handleHorizontalResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingHorizontal.current) {
      const sidebar = document.getElementById('right-sidebar');
      if (sidebar) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const newHeight = e.clientY - sidebarRect.top;
          const minHeight = 100;
          const maxHeight = sidebar.clientHeight - 200;
          setLayersPanelHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
      }
    }
  }, []);
  const handleHorizontalResizeMouseUp = useCallback(() => {
    isResizingHorizontal.current = false;
    document.removeEventListener('mousemove', handleHorizontalResizeMouseMove);
    document.removeEventListener('mouseup', handleHorizontalResizeMouseUp);
    document.body.style.cursor = 'default';
  }, [handleHorizontalResizeMouseMove]);
  const handleHorizontalResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingHorizontal.current = true;
    document.addEventListener('mousemove', handleHorizontalResizeMouseMove);
    document.addEventListener('mouseup', handleHorizontalResizeMouseUp);
    document.body.style.cursor = 'row-resize';
  }, [handleHorizontalResizeMouseMove, handleHorizontalResizeMouseUp]);
  
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  
  const handleAddImage = async (file: File) => {
    const base64 = await fileToBase64(file);
    const img = new Image();
    img.onload = () => {
        const newElement: CanvasImageElement = {
            id: `el-${Date.now()}`,
            type: 'image',
            name: file.name.split('.')[0] || 'New Image',
            src: base64,
            x: 50,
            y: 50,
            width: img.width > 400 ? 400 : img.width,
            height: img.height > 400 ? (img.height * 400 / img.width) : img.height,
            rotation: 0,
            mimeType: file.type,
            visible: true,
        };
        setLayers(prev => [newElement, ...prev]);
        setSelectedIds([newElement.id]);
    }
    img.src = base64;
  };

  const handleAddText = (x: number, y: number) => {
    const newTextElement: CanvasTextElement = {
      id: `el-${Date.now()}`,
      type: 'text',
      name: 'New Text',
      content: 'Your Text Here',
      x,
      y,
      width: 250,
      height: 48,
      rotation: 0,
      fontSize: 40,
      color: '#000000',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      visible: true,
      // Text Effects Defaults
      shadowEnabled: false,
      shadowColor: '#000000',
      shadowBlur: 5,
      shadowOffsetX: 5,
      shadowOffsetY: 5,
      outlineEnabled: false,
      outlineColor: '#ffffff',
      outlineWidth: 2,
      fillType: 'solid',
      gradientColors: ['#ff0000', '#0000ff'],
      gradientDirection: 'to right',
    };
    setLayers(prev => [newTextElement, ...prev]);
    setSelectedIds([newTextElement.id]);
    setActiveTool(Tool.Select);
  };
  
  const handleUpdateTextProps = (id: string, newProps: Partial<CanvasTextElement>) => {
    setLayers(prev => prev.map(l => {
        if (l.id === id && l.type === 'text') {
            return { ...l, ...newProps };
        }
        return l;
    }));
  };

  const handleSetActiveTool = (tool: Tool) => {
    if (tool !== Tool.Draw) {
      clearDrawing();
    }
    setActiveTool(tool);
  };

  const handleFinalizeDrawing = () => {
    const drawingData = canvasAreaRef.current?.getDrawingAsElement();
    if (drawingData) {
        const newElement: CanvasImageElement = {
            ...drawingData,
            name: 'Drawing',
            visible: true,
        };
        setLayers(prev => [newElement, ...prev]);
        setSelectedIds([newElement.id]);
        clearDrawing();
        setActiveTool(Tool.Select);
    }
  };

  const handleRemoveBackground = async () => {
    if (selectedIds.length !== 1) return;
    const selectedElement = layers.find((l): l is CanvasImageElement => l.id === selectedIds[0] && l.type === 'image');
    if (!selectedElement) return;

    setIsProcessing(true);
    setProcessingMessage('Removing background...');

    try {
      const resultImage = await removeBackground(selectedElement.src, selectedElement.mimeType);
      
      const updatedElement: CanvasImageElement = {
        ...selectedElement,
        src: resultImage,
        mimeType: 'image/png'
      };

      setLayers(prev => prev.map(l => l.id === selectedElement.id ? updatedElement : l));
      
      const successMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'system',
        content: `Successfully removed background for ${selectedElement.name}.`,
      };
      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'system',
        content: error instanceof Error ? error.message : "An unknown error occurred during background removal.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleSendMessage = async (prompt: string) => {
    const selectedElements = selectedIds
        .map(id => layers.find(l => l.id === id))
        .filter((l): l is CanvasImageElement => l !== undefined && l.type === 'image' && l.visible);

    if (isLoading || selectedElements.length === 0) return;

    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
        const generatedImageUrl = await generateImage(prompt, selectedElements);
      
        const newElement: CanvasImageElement = {
            id: `el-${Date.now()}`,
            type: 'image',
            name: prompt.substring(0, 20),
            src: generatedImageUrl,
            x: 100,
            y: 100,
            width: 350,
            height: 350,
            rotation: 0,
            mimeType: 'image/png',
            visible: true,
        };

        setLayers(prev => [newElement, ...prev]);
        setSelectedIds([newElement.id]);
        
        const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}-ai`,
            role: 'assistant',
            content: `Generated an image for: "${prompt}"`,
            images: [generatedImageUrl],
        };
        setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'system',
        content: error instanceof Error ? error.message : "An unknown error occurred.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      clearDrawing();
    }
  };

  const handleSaveImage = async () => {
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasContainer.offsetWidth;
    exportCanvas.height = canvasContainer.offsetHeight;
    const ctx = exportCanvas.getContext('2d');

    if (!ctx) return;

    // Set a background color like the canvas area
    ctx.fillStyle = '#f9fafb'; // bg-gray-50
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Get visible elements, sorted by their order in the layers array
    const visibleElements = layers
      .filter((l): l is CanvasElement => (l.type === 'image' || l.type === 'text') && l.visible)
      .reverse(); // Draw from bottom to top

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // For images from other domains
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    for (const el of visibleElements) {
      ctx.save();
      
      // Apply transformations (rotation around center)
      ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-(el.x + el.width / 2), -(el.y + el.height / 2));

      if (el.type === 'image') {
        try {
          const img = await loadImage(el.src);
          ctx.drawImage(img, el.x, el.y, el.width, el.height);
        } catch (error) {
          console.error(`Could not load image ${el.name}:`, error);
        }
      } else if (el.type === 'text') {
        ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const drawX = el.x + el.width / 2;
        const drawY = el.y + el.height / 2;
        
        // Shadow
        if (el.shadowEnabled) {
          ctx.shadowColor = el.shadowColor;
          ctx.shadowBlur = el.shadowBlur;
          ctx.shadowOffsetX = el.shadowOffsetX;
          ctx.shadowOffsetY = el.shadowOffsetY;
        }

        // Outline must be drawn before fill
        if (el.outlineEnabled) {
          ctx.strokeStyle = el.outlineColor;
          ctx.lineWidth = el.outlineWidth;
          ctx.strokeText(el.content, drawX, drawY);
        }

        // Fill (Solid or Gradient)
        if (el.fillType === 'solid') {
          ctx.fillStyle = el.color;
        } else {
          let x0=el.x, y0=el.y, x1=el.x, y1=el.y;
          switch (el.gradientDirection) {
              case 'to right': x1 += el.width; break;
              case 'to bottom': y1 += el.height; break;
              case 'to left': x0 += el.width; break;
              case 'to top': y0 += el.height; break;
              case 'to bottom right': x1 += el.width; y1 += el.height; break;
              case 'to top left': x0 += el.width; y0 += el.height; break;
          }
          const grad = ctx.createLinearGradient(x0, y0, x1, y1);
          grad.addColorStop(0, el.gradientColors[0]);
          grad.addColorStop(1, el.gradientColors[1]);
          ctx.fillStyle = grad;
        }
        
        ctx.fillText(el.content, drawX, drawY);
        
        // Reset shadow for the next element
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.restore();
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = 'magic-canvas-export.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };


  const handleToggleVisibility = (id: string) => {
    const idsToToggle = new Set([id, ...getDescendantIds(id)]);
    setLayers(prev => prev.map(l => {
        if (idsToToggle.has(l.id)) {
            if (l.id === id) {
                return { ...l, visible: !l.visible };
            }
        }
        return l;
    }));
  };
  
  const handleSelectLayer = (id: string, isShift: boolean) => {
    if (isShift) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    } else {
        setSelectedIds([id]);
    }
  };

  const handleReorderAndReparentLayers = (dragId: string, dropId: string, position: 'before' | 'after' | 'inside') => {
    setLayers(prev => {
        const layersById = new Map(prev.map(l => [l.id, l]));
        const draggedLayerOriginal = layersById.get(dragId);
        const dropLayer = layersById.get(dropId);

        if (!draggedLayerOriginal || !dropLayer) return prev;

        if (dropLayer.parentId === dragId || getDescendantIds(dragId).includes(dropId)) {
            return prev;
        }

        const newLayers = prev.filter(l => l.id !== dragId);
        const draggedLayer = { ...draggedLayerOriginal };
        
        const finalDropIndex = newLayers.findIndex(l => l.id === dropId);
        if (finalDropIndex === -1) return prev;

        if (position === 'inside') {
            draggedLayer.parentId = dropLayer.id;
            const children = newLayers.filter(l => l.parentId === dropLayer.id);
            if (children.length > 0) {
                const lastChildIndex = newLayers.findIndex(l => l.id === children[children.length - 1].id);
                newLayers.splice(lastChildIndex + 1, 0, draggedLayer);
            } else {
                newLayers.splice(finalDropIndex + 1, 0, draggedLayer);
            }
        } else {
            draggedLayer.parentId = dropLayer.parentId;
            const insertionIndex = position === 'before' ? finalDropIndex : finalDropIndex + 1;
            newLayers.splice(insertionIndex, 0, draggedLayer);
        }

        return newLayers;
    });
  };

  const handleRenameLayer = (id: string, newName: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
  };
  
  const handleToggleGroupExpanded = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id && l.type === 'group' ? { ...l, expanded: !l.expanded } : l));
  };

  const handleGroupSelection = () => {
    if (selectedIds.length < 1) return;
    
    const newGroupId = `group-${Date.now()}`;

    setLayers(prevLayers => {
        const newLayers = [...prevLayers];
        const topItemIndex = newLayers.findIndex(l => l.id === selectedIds[0]);

        const newGroup: CanvasGroup = {
            id: newGroupId,
            type: 'group',
            name: 'New Group',
            visible: true,
            expanded: true,
        };

        const selectedLayers = selectedIds.map(id => newLayers.find(l => l.id === id)).filter((l): l is Layer => !!l);
        const selectedIndices = selectedIds.map(id => newLayers.findIndex(l => l.id === id)).filter(i => i !== -1).sort((a,b) => b-a);

        selectedIndices.forEach(index => newLayers.splice(index, 1));
        
        const finalTopIndex = topItemIndex > newLayers.length ? newLayers.length : topItemIndex;
        newLayers.splice(finalTopIndex, 0, newGroup);
        
        selectedLayers.forEach((layer, index) => {
            newLayers.splice(finalTopIndex + 1 + index, 0, { ...layer, parentId: newGroup.id });
        });
        
        return newLayers;
    });

    setSelectedIds([newGroupId]);
  };
  
  const handleUngroupSelection = () => {
      const groupsToUngroup = selectedIds.filter(id => layers.find(l => l.id === id)?.type === 'group');
      if (groupsToUngroup.length === 0) return;

      const newSelection: string[] = [];
      setLayers(prevLayers => {
          let newLayers = [...prevLayers];
          groupsToUngroup.forEach(groupId => {
              newLayers = newLayers.map(l => {
                  if (l.parentId === groupId) {
                      newSelection.push(l.id);
                      // FIX: Create a copy of the layer and remove parentId.
                      // Using destructuring is safer for preserving discriminated union types.
                      const { parentId, ...rest } = l;
                      return rest;
                  }
                  return l;
              }).filter(l => l.id !== groupId);
          });
          return newLayers;
      });

      setSelectedIds(newSelection);
  };
  
  const handleElementUpdate = (id: string, newProps: Partial<CanvasElement>) => {
    setLayers(prev => prev.map(l => {
      if (l.id === id && (l.type === 'image' || l.type === 'text')) {
        return { ...l, ...newProps };
      }
      return l;
    }));
  };

 const handleGroupUpdate = (targets: readonly (HTMLElement | SVGElement)[], updateFn: (el: HTMLElement | SVGElement, index: number) => Partial<CanvasElement>) => {
    setLayers(prevLayers => {
        const newLayers = [...prevLayers];
        const updatedIds = new Set<string>();
        targets.forEach((t, i) => {
            const id = t.id;
            const index = newLayers.findIndex(l => l.id === id);
            if (index > -1 && !updatedIds.has(id)) {
                const layer = newLayers[index];
                if (layer.type === 'image' || layer.type === 'text') {
                    const updatedProps = updateFn(t, i);
                    newLayers[index] = { ...layer, ...updatedProps } as CanvasElement;
                }
                updatedIds.add(id);
            }
        });
        return newLayers;
    });
  };

  const selectedElementIds = useMemo(() => {
    const elementIds = new Set<string>();
    const layersById = new Map(layers.map(l => [l.id, l]));

    function addElementsFrom(layerId: string) {
        const layer = layersById.get(layerId);
        if (!layer) return;

        if (layer.type === 'image' || layer.type === 'text') {
            elementIds.add(layer.id);
        } else if (layer.type === 'group') {
            layers.forEach(l => {
                if (l.parentId === layer.id) {
                    addElementsFrom(l.id);
                }
            });
        }
    }
    selectedIds.forEach(id => addElementsFrom(id));
    return Array.from(elementIds);
  }, [selectedIds, layers]);

  const selectedTextElement = useMemo(() => {
    if (selectedIds.length === 1) {
        const selected = layers.find(l => l.id === selectedIds[0]);
        if (selected?.type === 'text') {
            return selected;
        }
    }
    return null;
  }, [selectedIds, layers]);
  
  return (
    <div className="h-screen w-screen flex flex-col font-sans overflow-hidden">
      <header className="p-3 border-b border-gray-200 bg-white flex-shrink-0 z-20">
        <h1 className="text-xl font-bold text-gray-800">Magic Canvas</h1>
        <p className="text-sm text-gray-500">Draw, point, and chat to generate images with AI</p>
      </header>
      <div className="flex flex-grow overflow-hidden">
        <main className="relative flex-grow h-full flex flex-col">
          {selectedTextElement && (
            <TextToolbar 
                selectedElement={selectedTextElement}
                onUpdate={(props) => handleUpdateTextProps(selectedTextElement.id, props)}
            />
          )}
          <div className="relative flex-grow h-full">
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 z-50 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <p className="text-white text-lg font-semibold">{processingMessage}</p>
              </div>
            )}
            <Toolbar 
              activeTool={activeTool} 
              setActiveTool={handleSetActiveTool} 
              onAddImage={handleAddImage}
              onDeleteSelected={handleDeleteSelected}
              onFinalizeDrawing={handleFinalizeDrawing}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onRemoveBackground={handleRemoveBackground}
              isSingleImageSelected={selectedIds.length === 1 && layers.find(l => l.id === selectedIds[0])?.type === 'image'}
              onSaveImage={handleSaveImage}
              drawingColor={drawingColor}
              onDrawingColorChange={setDrawingColor}
            />
            <CanvasArea
              ref={canvasAreaRef}
              moveableRef={moveableRef}
              layers={layers}
              elements={renderableElements}
              selectedElementIds={selectedElementIds}
              setSelectedIds={setSelectedIds}
              activeTool={activeTool}
              drawingCanvasRef={drawingCanvasRef}
              canvasContainerRef={canvasContainerRef}
              isShiftPressed={isShiftPressed}
              onAddText={handleAddText}
              onUpdateTextProps={handleUpdateTextProps}
              onElementUpdate={handleElementUpdate}
              onGroupUpdate={handleGroupUpdate}
              drawingColor={drawingColor}
            />
          </div>
        </main>
        <div 
          className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors duration-200 flex-shrink-0"
          onMouseDown={handleVerticalResizeMouseDown}
        />
        <aside id="right-sidebar" style={{ width: `${sidebarWidth}px` }} className="flex flex-col h-full bg-white border-l border-gray-200 shadow-lg flex-shrink-0">
            <LayersPanel
                height={layersPanelHeight}
                layers={layers}
                selectedIds={selectedIds}
                onToggleVisibility={handleToggleVisibility}
                onSelectLayer={handleSelectLayer}
                onReorderAndReparentLayers={handleReorderAndReparentLayers}
                onRenameLayer={handleRenameLayer}
                onToggleGroupExpanded={handleToggleGroupExpanded}
                onGroupSelection={handleGroupSelection}
                onUngroupSelection={handleUngroupSelection}
            />
            <div
                className="h-1.5 cursor-row-resize bg-gray-200 hover:bg-blue-400 transition-colors duration-200 flex-shrink-0"
                onMouseDown={handleHorizontalResizeMouseDown}
            />
            <AIAssistant 
                messages={messages} 
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                canvasElements={imageElements}
                selectedIds={selectedIds}
            />
        </aside>
      </div>
    </div>
  );
};

export default App;
