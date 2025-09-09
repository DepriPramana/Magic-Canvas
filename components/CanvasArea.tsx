import React, { useRef, useState, useEffect, useImperativeHandle } from 'react';
import Moveable from 'react-moveable';
import type { CanvasElement, CanvasAreaHandle, Layer, CanvasTextElement, CanvasImageElement } from '../types';
import { Tool } from '../types';

interface CanvasAreaProps {
  layers: Layer[];
  elements: CanvasElement[];
  selectedElementIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeTool: Tool;
  drawingCanvasRef: React.RefObject<HTMLCanvasElement>;
  canvasContainerRef: React.RefObject<HTMLDivElement>;
  isShiftPressed: boolean;
  onAddText: (x: number, y: number) => void;
  onUpdateTextProps: (id: string, props: Partial<CanvasTextElement>) => void;
  onElementUpdate: (id: string, props: Partial<CanvasElement>) => void;
  onGroupUpdate: (targets: readonly (HTMLElement | SVGElement)[], updateFn: (el: HTMLElement | SVGElement, index: number) => Partial<CanvasElement>) => void;
  moveableRef: React.RefObject<Moveable>;
  drawingColor: string;
}

interface DrawingState {
  paths: { points: { x: number; y: number }[] }[];
}

const getDrawingBounds = (paths: { points: { x: number; y: number }[] }[]) => {
    if (paths.length === 0 || paths.every(p => p.points.length < 2)) {
        return null;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach(path => {
        path.points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width < 0 || height < 0 || minX === Infinity) return null;

    return { x: minX, y: minY, width, height };
}

const calculateFontSizeFromHeight = (height: number): number => {
    // This ratio ensures the font size is small enough to fit within the
    // element's height, accounting for line-height and character descenders.
    // It's consistent with the logic in the TextToolbar.
    const FONT_SIZE_TO_HEIGHT_RATIO = 1.2;
    return Math.max(1, height / FONT_SIZE_TO_HEIGHT_RATIO);
};

const CanvasArea = React.forwardRef<CanvasAreaHandle, CanvasAreaProps>(({
  layers,
  elements,
  selectedElementIds,
  setSelectedIds,
  activeTool,
  drawingCanvasRef,
  canvasContainerRef,
  isShiftPressed,
  onAddText,
  onUpdateTextProps,
  onElementUpdate,
  onGroupUpdate,
  moveableRef,
  drawingColor,
}, ref) => {
  const [drawingState, setDrawingState] = useState<DrawingState>({ paths: [] });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<{ points: { x: number; y: number }[] }>({ points: [] });

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasContainerRef]);
  
  useEffect(() => {
    if (activeTool !== Tool.Select) {
        setEditingTextId(null);
    }
  }, [activeTool]);


  const redrawAllPaths = (paths: { points: { x: number; y: number }[] }[]) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    paths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    redrawAllPaths(drawingState.paths);
  }, [drawingState.paths, canvasSize, drawingColor]);

  
  useImperativeHandle(ref, () => ({
    getDrawingAsElement: () => {
        const bounds = getDrawingBounds(drawingState.paths);
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
        
        const padding = 10;
        const finalWidth = bounds.width + padding * 2;
        const finalHeight = bounds.height + padding * 2;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = finalWidth;
        tempCanvas.height = finalHeight;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return null;

        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        drawingState.paths.forEach(path => {
            if (path.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(path.points[0].x - bounds.x + padding, path.points[0].y - bounds.y + padding);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x - bounds.x + padding, path.points[i].y - bounds.y + padding);
            }
            ctx.stroke();
        });
        
        const newElement: Omit<CanvasImageElement, 'visible' | 'name' | 'parentId'> = {
            id: `el-${Date.now()}`,
            type: 'image',
            src: tempCanvas.toDataURL(),
            x: bounds.x - padding,
            y: bounds.y - padding,
            width: finalWidth,
            height: finalHeight,
            rotation: 0,
            mimeType: 'image/png',
        };

        return newElement;
    }
  }));


  useEffect(() => {
    const handleClear = () => {
        setDrawingState({ paths: [] });
    };
    
    const canvas = drawingCanvasRef.current;
    canvas?.addEventListener('clearDrawing', handleClear);

    return () => {
        canvas?.removeEventListener('clearDrawing', handleClear);
    };
  }, [drawingCanvasRef]);


  const getTarget = () => {
    const visibleSelectedElements = elements.filter(el => selectedElementIds.includes(el.id) && el.visible);
    return visibleSelectedElements.map(el => document.getElementById(el.id)).filter(Boolean) as HTMLElement[];
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    if (activeTool === Tool.Select) {
        if (target.id === 'canvas-area' || target.classList.contains('canvas-bg')) {
          setSelectedIds([]);
        } else {
          const elementNode = target.closest('.canvas-element');
          const elementId = elementNode?.id;
          const element = elementId ? elements.find(el => el.id === elementId) : undefined;
          
          if (elementId && element?.visible) {
            if (e.shiftKey) {
              setSelectedIds(prev => prev.includes(elementId) ? prev.filter(id => id !== elementId) : [...prev, elementId]);
            } else {
              if (!selectedElementIds.includes(elementId)) {
                setSelectedIds([elementId]);
              }
            }
          }
        }
    } else if (activeTool === Tool.Text) {
        if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            onAddText(e.clientX - rect.left, e.clientY - rect.top);
        }
    }
  };

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const rect = drawingCanvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPathRef.current = { points: [{ x, y }] };
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const points = currentPathRef.current.points;
    if (points.length === 0) return;
    const lastPoint = points[points.length - 1];

    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    points.push({ x, y });
  };

  const handleDrawEnd = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (currentPathRef.current.points.length > 1) {
          const newPath = { points: [...currentPathRef.current.points] };
          setDrawingState(prev => ({
              paths: [...prev.paths, newPath]
          }));
      }
      currentPathRef.current = { points: [] };
    }
  };

  return (
    <div
      id="canvas-area"
      ref={canvasContainerRef}
      className="relative w-full h-full bg-gray-50 overflow-hidden select-none"
      onMouseDown={handleCanvasMouseDown}
      style={{ cursor: activeTool === Tool.Text ? 'text' : 'default' }}
    >
        <div className="absolute inset-0 canvas-bg" style={{
            backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 0)',
            backgroundSize: '20px 20px',
        }}/>
      <canvas
        ref={drawingCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute top-0 left-0"
        style={{ pointerEvents: activeTool === Tool.Draw ? 'auto' : 'none', zIndex: 10 }}
        onMouseDown={handleDrawStart}
        onMouseMove={handleDrawMove}
        onMouseUp={handleDrawEnd}
        onMouseLeave={handleDrawEnd}
      />
      
      {elements.filter(el => el.visible).map((el, index) => {
        const commonStyle: React.CSSProperties = {
            left: `${el.x}px`,
            top: `${el.y}px`,
            width: `${el.width}px`,
            height: `${el.height}px`,
            transform: `rotate(${el.rotation}deg)`,
            zIndex: index + 1,
        };

        if (el.type === 'image') {
            return (
                <img
                  key={el.id}
                  id={el.id}
                  src={el.src}
                  className="canvas-element absolute cursor-grab"
                  style={commonStyle}
                  alt="canvas element"
                />
            );
        }

        if (el.type === 'text') {
            const isEditing = editingTextId === el.id;
            const textStyles: React.CSSProperties = {
                fontSize: `${el.fontSize}px`,
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle,
                textDecoration: el.textDecoration,
                lineHeight: 1.1,
            };
            if (el.shadowEnabled) {
                textStyles.textShadow = `${el.shadowOffsetX}px ${el.shadowOffsetY}px ${el.shadowBlur}px ${el.shadowColor}`;
            }
            if (el.outlineEnabled) {
                (textStyles as any).WebkitTextStroke = `${el.outlineWidth}px ${el.outlineColor}`;
                (textStyles as any).textStroke = `${el.outlineWidth}px ${el.outlineColor}`;
            }

            if (el.fillType === 'solid') {
                textStyles.color = el.color;
            } else {
                textStyles.background = `linear-gradient(${el.gradientDirection}, ${el.gradientColors[0]}, ${el.gradientColors[1]})`;
                textStyles.WebkitBackgroundClip = 'text';
                textStyles.backgroundClip = 'text';
                textStyles.color = 'transparent';
            }

            return (
                <div
                    key={el.id}
                    id={el.id}
                    className="canvas-element absolute flex justify-center cursor-grab"
                    style={commonStyle}
                    onDoubleClick={() => {
                        if (activeTool === Tool.Select) {
                            setEditingTextId(el.id);
                        }
                    }}
                >
                    <div
                      contentEditable={isEditing}
                      suppressContentEditableWarning={true}
                      onBlur={(e) => {
                          onUpdateTextProps(el.id, { content: e.currentTarget.innerText });
                          setEditingTextId(null);
                      }}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                          }
                      }}
                      className={`w-full h-full px-1 box-border break-words ${isEditing ? 'ring-2 ring-blue-500 focus:outline-none' : ''}`}
                      style={textStyles}
                    >
                      {el.content}
                    </div>
                </div>
            )
        }
        return null;
      })}

      {activeTool === Tool.Select && (
        <Moveable
          ref={moveableRef}
          target={getTarget()}
          draggable={true}
          resizable={true}
          rotatable={true}
          keepRatio={isShiftPressed}
          throttleDrag={1}
          throttleResize={1}
          throttleRotate={1}

          onDrag={({ target, left, top }) => {
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
          }}
          onDragGroup={({ events }) => {
            events.forEach(ev => {
              ev.target.style.left = `${ev.left}px`;
              ev.target.style.top = `${ev.top}px`;
            });
          }}
          onDragEnd={({ target }) => onElementUpdate(target.id, { x: parseFloat(target.style.left), y: parseFloat(target.style.top) })}
          onDragGroupEnd={({ targets }) => onGroupUpdate(targets, t => ({ x: parseFloat(t.style.left), y: parseFloat(t.style.top) }))}
          
          onResize={({ target, width, height, drag }) => {
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            const el = elements.find(e => e.id === target.id);
            if (el?.type === 'text') {
                target.querySelector('div')!.style.fontSize = `${calculateFontSizeFromHeight(height)}px`;
            }
            target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px) rotate(${el?.rotation || 0}deg)`;
          }}
          onResizeGroup={({ events }) => {
            events.forEach(ev => {
              ev.target.style.width = `${ev.width}px`;
              ev.target.style.height = `${ev.height}px`;
              const el = elements.find(e => e.id === ev.target.id);
               if (el?.type === 'text') {
                    (ev.target as HTMLElement).querySelector('div')!.style.fontSize = `${calculateFontSizeFromHeight(ev.height)}px`;
               }
              ev.target.style.transform = `translate(${ev.drag.beforeTranslate[0]}px, ${ev.drag.beforeTranslate[1]}px) rotate(${el?.rotation || 0}deg)`;
            });
          }}
          onResizeEnd={e => {
            // FIX: The `lastEvent` can be an `OnResizeStart` event, which doesn't have `width`, `height`, or `drag` with position data.
            // Add a type guard to ensure we are handling an `OnResize` event before accessing these properties.
            if (e.lastEvent && 'width' in e.lastEvent && 'height' in e.lastEvent && 'drag' in e.lastEvent) {
              const el = elements.find(el => el.id === e.target.id);
              if (!el) return;
              
              const newProps: Partial<CanvasElement> = {
                  width: e.lastEvent.width,
                  height: e.lastEvent.height,
                  x: e.lastEvent.drag.left,
                  y: e.lastEvent.drag.top,
              };
              if (el.type === 'text') {
                  (newProps as Partial<CanvasTextElement>).fontSize = calculateFontSizeFromHeight(e.lastEvent.height);
              }
  
              e.target.style.transform = `rotate(${el?.rotation || 0}deg)`;
              onElementUpdate(e.target.id, newProps);
            }
          }}
          onResizeGroupEnd={({ targets, events }) => {
            targets.forEach(t => {
                const el = elements.find(e => e.id === t.id);
                t.style.transform = `rotate(${el?.rotation || 0}deg)`;
            });
            onGroupUpdate(targets, (t, i) => {
                 const el = elements.find(e => e.id === t.id);
                 if (!events[i]?.drag) return {};
                 const newProps: Partial<CanvasElement> = {
                     width: events[i].width,
                     height: events[i].height,
                     x: events[i].drag.left,
                     y: events[i].drag.top,
                 };
                 if (el?.type === 'text') {
                     (newProps as Partial<CanvasTextElement>).fontSize = calculateFontSizeFromHeight(events[i].height);
                 }
                 return newProps;
            });
          }}

          onRotate={({ target, transform }) => {
            target.style.transform = transform;
          }}
          onRotateGroup={({ events }) => {
            events.forEach(ev => {
                ev.target.style.transform = ev.transform;
            });
          }}
          onRotateEnd={({ target }) => {
            const rotationMatch = target.style.transform.match(/rotate\(([^)]+)deg\)/);
            const rotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;
            onElementUpdate(target.id, { rotation });
          }}
          onRotateGroupEnd={({ targets }) => {
            onGroupUpdate(targets, t => {
                 const rotationMatch = t.style.transform.match(/rotate\(([^)]+)deg\)/);
                 return { rotation: rotationMatch ? parseFloat(rotationMatch[1]) : 0 };
            });
          }}
        />
      )}
    </div>
  );
});

export default CanvasArea;
