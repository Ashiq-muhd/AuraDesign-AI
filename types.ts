
export interface RoomAnalysis {
  roomType: string;
  style: string;
  elements: string[];
  suggestions: string[];
  organizationTips: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  imageUrl?: string;
}

export interface ElementPosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface DesignState {
  originalImage: string | null;
  analyzedData: RoomAnalysis | null;
  generatedImage: string | null;
  variants: string[];
  isAnalyzing: boolean;
  isGenerating: boolean;
  isGeneratingVariants: boolean;
  selectedElements: string[];
  elementImages: string[]; // Base64 strings of user's own items
  elementPositions: Record<string, ElementPosition>;
  isArranging: boolean;
  historyPast: string[][];
  historyFuture: string[][];
}
