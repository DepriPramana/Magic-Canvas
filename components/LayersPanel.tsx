import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import type { Layer, CanvasImageElement, CanvasTextElement, CanvasGroup } from '../types';
import { ICONS } from '../constants';

interface LayersPanelProps {
  layers: Layer[];
  selectedIds: string[];
  onToggleVisibility: (id: string) => void;
  onSelectLayer: (id: string, isShift: boolean) => void;
  onReorderAndReparentLayers: (dragId: string, dropId: string, position: 'before' | 'after' | 'inside') => void;
  onRenameLayer: (id: string, newName: string) => void;
  onToggleGroupExpanded: (id: string) => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  height: number;
}

// FIX: Changed HierarchicalLayer from an `interface` extending a union to a `type` intersection.
// An interface cannot extend a union type, and this was causing numerous downstream type errors.
type HierarchicalLayer = Layer & {
    depth: number;
};

const LayerItem: React.FC<{
    layer: HierarchicalLayer;
    isSelected: boolean;
    isDropTarget: boolean;
    onSelectLayer: (id: string, isShift: boolean) => void;
    onToggleVisibility: (id: string) => void;
    onToggleGroupExpanded: (id: string) => void;
    onRenameLayer: (id: string, newName: string) => void;
}> = ({ layer, isSelected, isDropTarget, ...props }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(layer.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    useEffect(() => {
        // Update local name if changed from parent
        setName(layer.name);
    }, [layer.name]);

    const handleRename = () => {
        if (name.trim() && name !== layer.name) {
            props.onRenameLayer(layer.id, name.trim());
        }
        setIsEditing(false);
    };

    const isGroup = layer.type === 'group';
    const isText = layer.type === 'text';

    const thumbnail = useMemo(() => {
        if (isGroup) {
            return <div className="text-gray-500">{ICONS.group}</div>;
        }
        if (isText) {
            return <div className="text-gray-500">{ICONS.text}</div>
        }
        // It must be an image element
        const imageLayer = layer as CanvasImageElement;
        return <img src={imageLayer.src} className="w-full h-full object-cover" alt="layer thumbnail"/>
    }, [layer]);


    return (
        <div
            onClick={(e) => props.onSelectLayer(layer.id, e.shiftKey)}
            onDoubleClick={() => setIsEditing(true)}
            className={`flex items-center gap-3 p-2 pr-3 rounded-lg cursor-pointer transition-all duration-150 ${
                isDropTarget ? 'bg-blue-200 ring-2 ring-blue-500 ring-inset' :
                isSelected ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-gray-100'
            } ${!layer.visible ? 'opacity-50' : ''}`}
            style={{ paddingLeft: `${layer.depth * 20 + 8}px` }}
        >
            {isGroup && (
                <button
                    onClick={(e) => { e.stopPropagation(); props.onToggleGroupExpanded(layer.id); }}
                    className="p-0 text-gray-500 hover:text-blue-500 rounded-full"
                    aria-label={(layer as CanvasGroup).expanded ? 'Collapse group' : 'Expand group'}
                >
                    {(layer as CanvasGroup).expanded ? ICONS.chevron_down : ICONS.chevron_right}
                </button>
            )}
            <div className="w-10 h-10 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center">
                {thumbnail}
            </div>
            <div className="text-sm text-gray-700 truncate flex-grow">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        onClick={e => e.stopPropagation()}
                        className="w-full p-0 border-none bg-transparent focus:ring-0"
                    />
                ) : (
                    <span>{layer.name}</span>
                )}
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); props.onToggleVisibility(layer.id); }}
                className="p-1 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-200 transition-colors"
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
            >
                {layer.visible ? ICONS.eye : ICONS.eye_off}
            </button>
        </div>
    );
};

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  selectedIds,
  onGroupSelection,
  onUngroupSelection,
  onReorderAndReparentLayers,
  height,
  ...rest
}) => {
  const dragId = useRef<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null);

  const canGroup = selectedIds.length > 1;
  const canUngroup = selectedIds.some(id => layers.find(l => l.id === id)?.type === 'group');

  const getDescendantIds = useCallback((startLayerId: string): string[] => {
    const allDescendants: string[] = [];
    function findChildren(parentId: string) {
        const children = layers.filter(l => l.parentId === parentId);
        for (const child of children) {
            allDescendants.push(child.id);
            if (child.type === 'group') {
                findChildren(child.id);
            }
        }
    }
    findChildren(startLayerId);
    return allDescendants;
  }, [layers]);

  const hierarchicalLayers = useMemo((): HierarchicalLayer[] => {
      const layersById = new Map(layers.map(l => [l.id, l]));
      const hierarchical: HierarchicalLayer[] = [];
      const processedIds = new Set<string>();

      const addLayerAndChildren = (layerId: string, depth: number) => {
          if (processedIds.has(layerId)) return;
          
          const layer = layersById.get(layerId);
          if (!layer) return;

          hierarchical.push({ ...layer, depth });
          processedIds.add(layer.id);

          if (layer.type === 'group' && layer.expanded) {
              layers.forEach(child => {
                  if (child.parentId === layer.id) {
                      addLayerAndChildren(child.id, depth + 1);
                  }
              });
          }
      };
      
      [...layers].reverse().forEach(layer => {
          if (!layer.parentId) {
            addLayerAndChildren(layer.id, 0);
          }
      });
      
      return hierarchical.reverse();
  }, [layers]);

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, dropTargetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = dragId.current;
    if (!draggedId || draggedId === dropTargetId) {
        setDropIndicator(null);
        return;
    }

    const dropTargetNode = e.currentTarget;
    const rect = dropTargetNode.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    
    const dropTargetLayer = layers.find(l => l.id === dropTargetId);
    if (!dropTargetLayer) return;

    let position: 'before' | 'after' | 'inside' = 'after';
    
    if (dropTargetLayer.type === 'group') {
        const threshold = rect.height * 0.25;
        if (dropY < threshold) {
            position = 'before';
        } else if (dropY > rect.height - threshold) {
            position = 'after';
        } else {
            position = 'inside';
        }
    } else {
         if (dropY < rect.height / 2) {
            position = 'before';
        } else {
            position = 'after';
        }
    }

    if (position === 'inside' && getDescendantIds(draggedId).includes(dropTargetId)) {
        setDropIndicator(null);
        return;
    }

    setDropIndicator({ id: dropTargetId, position });
  };
  
  const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropIndicator) {
        const draggedId = dragId.current;
        if (draggedId) {
            onReorderAndReparentLayers(draggedId, dropIndicator.id, dropIndicator.position);
        }
    }

    dragId.current = null;
    setDropIndicator(null);
  };

  const handleDragEnd = () => {
    dragId.current = null;
    setDropIndicator(null);
  };

  return (
    <div style={{ height: `${height}px` }} className="flex flex-col bg-white flex-shrink-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Layers</h2>
        <div className="flex items-center gap-2">
            <button 
                onClick={onGroupSelection}
                disabled={!canGroup}
                className="p-2 text-gray-600 hover:text-blue-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                aria-label="Group selected layers"
            >
                {ICONS.group}
            </button>
            <button 
                onClick={onUngroupSelection}
                disabled={!canUngroup}
                className="p-2 text-gray-600 hover:text-blue-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                aria-label="Ungroup selected layers"
            >
                {ICONS.ungroup}
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        <ul onDragEnd={handleDragEnd}>
          {[...hierarchicalLayers].reverse().map((layer) => (
            <li
              key={layer.id}
              draggable
              className="relative my-0.5"
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={() => setDropIndicator(null)}
              onDrop={handleDrop}
            >
                {dropIndicator?.id === layer.id && dropIndicator.position === 'before' && (
                    <div className="absolute -top-1 left-2 right-2 h-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
                )}
                <LayerItem 
                    layer={layer}
                    isSelected={selectedIds.includes(layer.id)}
                    isDropTarget={dropIndicator?.id === layer.id && dropIndicator.position === 'inside'}
                    {...rest}
                />
                {dropIndicator?.id === layer.id && dropIndicator.position === 'after' && (
                    <div className="absolute -bottom-1 left-2 right-2 h-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
                )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LayersPanel;
