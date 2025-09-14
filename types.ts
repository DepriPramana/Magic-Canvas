export interface CanvasImageElement {
  id: string;
  type: 'image';
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  mimeType: string;
  visible: boolean;
  parentId?: string;
}

export interface CanvasTextElement {
  id: string;
  type: 'text';
  name: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  align: 'left' | 'center' | 'right';
  visible: boolean;
  parentId?: string;
  // Text Effects
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  fillType: 'solid' | 'gradient';
  gradientColors: [string, string];
  gradientDirection: string;
}

export type CanvasElement = CanvasImageElement | CanvasTextElement;

export interface CanvasGroup {
  id:string;
  type: 'group';
  name: string;
  visible: boolean;
  expanded: boolean;
  parentId?: string;
}

export type Layer = CanvasElement | CanvasGroup;

export enum Tool {
  Select = 'select',
  Draw = 'draw',
  Text = 'text',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

export interface CanvasAreaHandle {
  getDrawingAsElement: () => Omit<CanvasImageElement, 'visible' | 'name' | 'parentId'> | null;
}