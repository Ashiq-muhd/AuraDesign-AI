
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatBot from './components/ChatBot';
import { 
  analyzeRoom, 
  generateRedesign, 
  editImage, 
  generateRedesignWithLayout
} from './services/geminiService';
import { DesignState, RoomAnalysis, ElementPosition } from './types';

const INITIAL_SUGGESTIONS = [
  "Modern Sofa", "Potted Plants", "Ambient Lighting", "Wall Art", "Minimalist Shelving", 
  "Area Rug", "Statement Lamp", "Scandinavian Furniture", "Industrial Elements", "Bohemian Decor"
];

const SUGGESTIONS_BY_ROOM_TYPE: Record<string, string[]> = {
  "Living Room": ["Sectional Sofa", "Coffee Table", "TV Console", "Floor Lamp", "Indoor Palm", "Media Console", "Sheer Curtains", "Accent Chair"],
  "Bedroom": ["Tufted Bed Frame", "Bedside Table", "Floating Shelves", "Blackout Curtains", "Full-length Mirror", "Area Rug", "Reading Sconce"],
  "Kitchen": ["Marble Island", "Bar Stools", "Pendant Lights", "Under-cabinet Lighting", "Subway Backsplash", "Pot Rack", "Modern Faucet"],
  "Dining Room": ["Oak Dining Table", "Chandelier", "Sideboard", "Velvet Dining Chairs", "Table Runner", "Mirror Wall", "Bar Cart"],
  "Bathroom": ["Double Vanity", "LED Mirror", "Glass Shower Door", "Towel Warmer", "Freestanding Tub", "Floating Shelves", "Modern Sconce"],
  "Office": ["Standing Desk", "Ergonomic Chair", "Bookshelf", "Desk Organizer", "Task Lighting", "Acoustic Panels", "Whiteboard"],
  "Laundry Room": ["Built-in Sorting", "Folding Table", "Drying Rack", "Cabinet Storage", "Tile Floor", "Utility Sink"],
  "Entryway": ["Console Table", "Coat Rack", "Bench with Storage", "Statement Rug", "Key Organizer", "Round Mirror"]
};

interface GalleryItem {
  id: string;
  image: string;
  elements: string[];
  date: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'gallery'>('workspace');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  
  const [state, setState] = useState<DesignState>({
    originalImage: null,
    analyzedData: null,
    generatedImage: null,
    variants: [],
    isAnalyzing: false,
    isGenerating: false,
    isGeneratingVariants: false,
    selectedElements: [],
    elementImages: [],
    elementPositions: {},
    isArranging: false,
    historyPast: [],
    historyFuture: [],
  });

  const [availableElements, setAvailableElements] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [customElement, setCustomElement] = useState('');
  
  // States for Refinement and UI
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Scroll visibility states
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);
  const lastScrollY = useRef(0);

  const layoutContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine scroll direction
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsScrollingDown(true);
      } else {
        setIsScrollingDown(false);
      }
      
      // Determine if scrolled past initial view
      if (currentScrollY > 400) {
        setIsScrolledPastHero(true);
      } else {
        setIsScrolledPastHero(false);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const savedGallery = localStorage.getItem('aura_gallery');
    if (savedGallery) {
      try {
        setGallery(JSON.parse(savedGallery));
      } catch (e) {
        console.error("Failed to parse gallery", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_gallery', JSON.stringify(gallery));
  }, [gallery]);

  useEffect(() => {
    if (state.analyzedData?.roomType) {
      const roomType = state.analyzedData.roomType;
      const matchedKey = Object.keys(SUGGESTIONS_BY_ROOM_TYPE).find(key => 
        roomType.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(roomType.toLowerCase())
      );

      if (matchedKey) {
        const newSuggestions = SUGGESTIONS_BY_ROOM_TYPE[matchedKey];
        setAvailableElements(prev => {
          const uniqueSuggestions = new Set([...newSuggestions, ...state.selectedElements]);
          return Array.from(uniqueSuggestions);
        });
      }
    }
  }, [state.analyzedData?.roomType, state.selectedElements]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setState(prev => ({
          ...prev,
          originalImage: base64,
          analyzedData: null,
          generatedImage: null,
          variants: [],
          selectedElements: [],
          elementImages: [],
          elementPositions: {},
          isArranging: false,
          historyPast: [],
          historyFuture: []
        }));
        setAvailableElements(INITIAL_SUGGESTIONS);
        startAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleElementItemUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setState(prev => {
            const newIndex = prev.elementImages.length;
            const key = `Uploaded Item ${newIndex + 1}`;
            return {
              ...prev,
              elementImages: [...prev.elementImages, base64],
              elementPositions: {
                ...prev.elementPositions,
                [key]: { x: 45 + (newIndex * 2), y: 45 + (newIndex * 2) }
              }
            };
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeElementItem = (index: number) => {
    const keyToRemove = `Uploaded Item ${index + 1}`;
    setState(prev => {
      const newPositions = { ...prev.elementPositions };
      delete newPositions[keyToRemove];
      return {
        ...prev,
        elementImages: prev.elementImages.filter((_, i) => i !== index),
        elementPositions: newPositions
      };
    });
  };

  const startAnalysis = async (image: string) => {
    setState(prev => ({ ...prev, isAnalyzing: true }));
    try {
      const analysis = await analyzeRoom(image);
      setState(prev => ({ ...prev, analyzedData: analysis, isAnalyzing: false }));
    } catch (error) {
      console.error("Analysis failed", error);
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const pushToHistory = (newElements: string[]) => {
    setState(prev => ({
      ...prev,
      historyPast: [...prev.historyPast, prev.selectedElements],
      historyFuture: [],
      selectedElements: newElements
    }));
  };

  const toggleElement = (el: string) => {
    const isSelected = state.selectedElements.includes(el);
    const newElements = isSelected
      ? state.selectedElements.filter(i => i !== el)
      : [...state.selectedElements, el];
    
    // Manage position entry for spatial layout
    const newPositions = { ...state.elementPositions };
    if (!isSelected) {
      newPositions[el] = { x: 50, y: 50 }; // Default center
    } else {
      delete newPositions[el];
    }

    setState(prev => ({ ...prev, elementPositions: newPositions }));
    pushToHistory(newElements);
  };

  const addCustomElement = () => {
    const trimmed = customElement.trim();
    if (trimmed) {
      if (!availableElements.includes(trimmed)) {
        setAvailableElements(prev => [trimmed, ...prev]);
      }
      if (!state.selectedElements.includes(trimmed)) {
        const newElements = [...state.selectedElements, trimmed];
        const newPositions = { ...state.elementPositions, [trimmed]: { x: 50, y: 50 } };
        setState(prev => ({ ...prev, elementPositions: newPositions }));
        pushToHistory(newElements);
      }
      setCustomElement('');
    }
  };

  const undo = () => {
    if (state.historyPast.length === 0) return;
    const previous = state.historyPast[state.historyPast.length - 1];
    const newPast = state.historyPast.slice(0, state.historyPast.length - 1);
    
    setState(prev => ({
      ...prev,
      historyPast: newPast,
      historyFuture: [prev.selectedElements, ...prev.historyFuture],
      selectedElements: previous
    }));
  };

  const redo = () => {
    if (state.historyFuture.length === 0) return;
    const next = state.historyFuture[0];
    const newFuture = state.historyFuture.slice(1);
    
    setState(prev => ({
      ...prev,
      historyPast: [...prev.historyPast, prev.selectedElements],
      historyFuture: newFuture,
      selectedElements: next
    }));
  };

  const handleRedesign = async () => {
    if (!state.originalImage) return;
    if (state.selectedElements.length === 0 && state.elementImages.length === 0) return;
    
    setState(prev => ({ ...prev, isGenerating: true, variants: [], isArranging: false }));
    try {
      const redesignedImage = await generateRedesign(state.originalImage, state.selectedElements, state.elementImages);
      setState(prev => ({ ...prev, generatedImage: redesignedImage, isGenerating: false }));
    } catch (error) {
      console.error("Redesign failed", error);
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleApplyLayout = async () => {
    if (!state.originalImage || Object.keys(state.elementPositions).length === 0) return;
    
    setState(prev => ({ ...prev, isGenerating: true, variants: [], isArranging: false }));
    try {
      const redesignedImage = await generateRedesignWithLayout(state.originalImage, state.elementPositions, state.elementImages);
      setState(prev => ({ ...prev, generatedImage: redesignedImage, isGenerating: false }));
    } catch (error) {
      console.error("Layout redesign failed", error);
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleRefine = async () => {
    if (!state.generatedImage || !refinementPrompt.trim()) return;
    
    setIsRefining(true);
    try {
      const refinedImage = await editImage(state.generatedImage, refinementPrompt);
      setState(prev => ({ ...prev, generatedImage: refinedImage }));
      setRefinementPrompt('');
      setIsEditingMode(false);
    } catch (error) {
      console.error("Refinement failed", error);
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateVariants = async () => {
    if (!state.originalImage) return;
    
    setState(prev => ({ ...prev, isGeneratingVariants: true }));
    try {
      const hasPositions = Object.keys(state.elementPositions).length > 0;
      
      const variantPromises = [
        hasPositions 
          ? generateRedesignWithLayout(state.originalImage, state.elementPositions, state.elementImages, "slightly different perspective")
          : generateRedesign(state.originalImage, state.selectedElements, state.elementImages),
        hasPositions
          ? generateRedesignWithLayout(state.originalImage, state.elementPositions, state.elementImages, "alternative lighting setup")
          : generateRedesign(state.originalImage, state.selectedElements, state.elementImages),
        hasPositions
          ? generateRedesignWithLayout(state.originalImage, state.elementPositions, state.elementImages, "minimalist variation")
          : generateRedesign(state.originalImage, state.selectedElements, state.elementImages)
      ];
      
      const results = await Promise.all(variantPromises);
      setState(prev => ({ ...prev, variants: results, isGeneratingVariants: false }));
    } catch (error) {
      console.error("Variant generation failed", error);
      setState(prev => ({ ...prev, isGeneratingVariants: false }));
    }
  };

  const updateElementPosition = (name: string, x: number, y: number) => {
    setState(prev => ({
      ...prev,
      elementPositions: {
        ...prev.elementPositions,
        [name]: { x, y }
      }
    }));
  };

  const handleDrag = (e: React.MouseEvent | React.TouchEvent, name: string) => {
    if (!layoutContainerRef.current) return;
    
    const container = layoutContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = Math.max(0, Math.min(100, ((clientX - container.left) / container.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - container.top) / container.height) * 100));

    updateElementPosition(name, x, y);
  };

  const handleDownload = (imgUrl: string, fileName?: string) => {
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = fileName || `aura-redesign-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveToGallery = (image: string) => {
    const newItem: GalleryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      image: image,
      elements: [...state.selectedElements],
      date: new Date().toLocaleDateString(),
    };
    setGallery(prev => [newItem, ...prev]);
  };

  const removeFromGallery = (id: string) => {
    setGallery(prev => prev.filter(item => item.id !== id));
  };

  const renderGallery = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Your Design Gallery</h2>
          <p className="text-slate-500">Explore and manage your saved AI transformations.</p>
        </div>
        <button 
          onClick={() => setActiveTab('workspace')}
          className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center bg-indigo-50 px-4 py-2 rounded-xl transition-colors"
        >
          <i className="fas fa-plus mr-2"></i> Create New
        </button>
      </div>

      {gallery.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-images text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No designs saved yet</h3>
          <p className="text-slate-500 mb-8">Generated designs will appear here when you save them from the workspace.</p>
          <button 
            onClick={() => setActiveTab('workspace')}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md"
          >
            Start Designing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.map((item) => (
            <div key={item.id} className="group bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="aspect-video relative overflow-hidden">
                <img src={item.image} alt="Saved Design" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setPreviewImage(item.image)}
                      className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-indigo-600 hover:bg-white transition-all transform hover:scale-110"
                      title="Preview"
                    >
                      <i className="fas fa-search-plus"></i>
                    </button>
                    <button 
                      onClick={() => handleDownload(item.image)}
                      className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-indigo-600 hover:bg-white transition-all transform hover:scale-110"
                      title="Download"
                    >
                      <i className="fas fa-download"></i>
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromGallery(item.id)}
                    className="w-10 h-10 bg-red-500/90 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-all transform hover:scale-110"
                    title="Remove"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{item.date}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.elements.slice(0, 3).map((el, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{el}</span>
                  ))}
                  {item.elements.length > 3 && <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">+{item.elements.length - 3} more</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const canRedesign = state.originalImage && (state.selectedElements.length > 0 || state.elementImages.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        {activeTab === 'gallery' ? renderGallery() : (
          <>
            <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Left Column: Image Area */}
              <div className="lg:col-span-8 space-y-6">
                {!state.originalImage ? (
                  <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center h-[500px] flex flex-col items-center justify-center transition-all hover:border-indigo-400 hover:bg-indigo-50/30 group">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <i className="fas fa-cloud-upload-alt text-3xl"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Upload Room Photo</h3>
                    <p className="text-slate-500 mb-8 max-w-sm">Take a photo of your room to get AI organization tips and design transformations.</p>
                    <label className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold cursor-pointer hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                      Browse Files
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 overflow-hidden relative group">
                      <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="font-bold text-slate-800 flex items-center">
                          Workspace Viewer
                          {state.analyzedData?.roomType && (
                            <span className="ml-3 px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] uppercase font-bold rounded-full border border-indigo-100">
                              {state.analyzedData.roomType} Detected
                            </span>
                          )}
                        </h3>
                        <button 
                          onClick={() => setState(prev => ({...prev, originalImage: null, analyzedData: null, generatedImage: null, variants: [], isArranging: false, historyPast: [], historyFuture: []}))}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <i className="fas fa-trash-alt mr-2"></i>Clear
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <p className="text-xs font-bold text-slate-500 uppercase">Original Space</p>
                            <button 
                              onClick={() => setPreviewImage(state.originalImage!)}
                              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <i className="fas fa-expand mr-1"></i> Preview
                            </button>
                          </div>
                          <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 shadow-inner group/original relative">
                            <img src={state.originalImage} alt="Original" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/original:opacity-100 transition-opacity flex items-center justify-center">
                              <button onClick={() => setPreviewImage(state.originalImage!)} className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-indigo-600 shadow-lg hover:scale-110 transition-transform">
                                <i className="fas fa-search-plus text-lg"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <p className="text-xs font-bold text-indigo-500 uppercase">Redesigned Preview</p>
                            {state.generatedImage && (
                              <div className="flex space-x-3">
                                <button 
                                  onClick={() => setState(prev => ({ ...prev, isArranging: true }))}
                                  className={`text-xs font-bold flex items-center transition-colors text-indigo-600 hover:text-indigo-800`}
                                >
                                  <i className={`fas fa-hand-pointer mr-1`}></i> Arrange
                                </button>
                                <button 
                                  onClick={() => setIsEditingMode(!isEditingMode)}
                                  className={`text-xs font-bold flex items-center transition-colors ${isEditingMode ? 'text-indigo-800' : 'text-indigo-600 hover:text-indigo-800'}`}
                                >
                                  <i className={`fas ${isEditingMode ? 'fa-times' : 'fa-magic'} mr-1`}></i> {isEditingMode ? 'Cancel' : 'Refine'}
                                </button>
                                <button 
                                  onClick={() => saveToGallery(state.generatedImage!)}
                                  className="text-xs font-bold text-green-600 hover:text-green-800 flex items-center transition-colors"
                                >
                                  <i className="fas fa-save mr-1"></i> Save
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 border-2 border-indigo-100 flex items-center justify-center relative group/preview shadow-inner">
                            {state.isGenerating || isRefining ? (
                              <div className="text-center p-8 bg-white/80 backdrop-blur-sm absolute inset-0 z-20 flex flex-col items-center justify-center">
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-sm text-indigo-600 font-medium">{isRefining ? 'Applying your refinements...' : 'Aura is reimagining your space...'}</p>
                              </div>
                            ) : null}

                            {state.generatedImage ? (
                              <>
                                <img src={state.generatedImage} alt="Redesigned" className="w-full h-full object-cover animate-in fade-in duration-700" />
                                
                                {/* Edit Mode Overlay */}
                                {isEditingMode ? (
                                  <div className="absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px] p-6 flex flex-col justify-center animate-in fade-in duration-300">
                                    <div className="bg-white rounded-2xl p-4 shadow-2xl space-y-3">
                                      <p className="text-xs font-bold text-slate-500 uppercase">Specific Modification</p>
                                      <div className="flex space-x-2">
                                        <input 
                                          autoFocus
                                          type="text"
                                          value={refinementPrompt}
                                          onChange={(e) => setRefinementPrompt(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                          placeholder="e.g., 'Make the walls sage green'..."
                                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <button 
                                          onClick={handleRefine}
                                          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover/preview:opacity-100 transition-all">
                                    <button 
                                      onClick={() => setPreviewImage(state.generatedImage!)}
                                      className="bg-white/90 backdrop-blur-sm text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                                      title="Full Screen Preview"
                                    >
                                      <i className="fas fa-search-plus"></i>
                                    </button>
                                    <button 
                                      onClick={() => setState(prev => ({ ...prev, isArranging: true }))}
                                      className="bg-white/90 backdrop-blur-sm text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                                      title="Arrange Layout"
                                    >
                                      <i className="fas fa-hand-pointer"></i>
                                    </button>
                                    <button 
                                      onClick={() => setIsEditingMode(true)}
                                      className="bg-white/90 backdrop-blur-sm text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                                      title="Refine with specific prompt"
                                    >
                                      <i className="fas fa-magic"></i>
                                    </button>
                                    <button 
                                      onClick={() => saveToGallery(state.generatedImage!)}
                                      className="bg-white/90 backdrop-blur-sm text-green-600 w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                                      title="Save to Gallery"
                                    >
                                      <i className="fas fa-save"></i>
                                    </button>
                                    <button 
                                      onClick={() => handleDownload(state.generatedImage!)}
                                      className="bg-white/90 backdrop-blur-sm text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                                      title="Download Visualization"
                                    >
                                      <i className="fas fa-download"></i>
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-center text-slate-400 p-8">
                                <i className="fas fa-magic text-4xl mb-3 block opacity-20"></i>
                                <p className="text-sm">Select elements and click 'Reimagine'</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {state.generatedImage && (
                        <div className="mt-8 border-t border-slate-100 pt-6">
                          <div className="flex justify-between items-center mb-4 px-2">
                            <h4 className="font-bold text-slate-800 flex items-center">
                              <i className="fas fa-layer-group mr-2 text-indigo-600"></i>
                              Explore Variations
                            </h4>
                            {!state.isGeneratingVariants && state.variants.length === 0 && (
                              <button 
                                onClick={handleGenerateVariants}
                                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center group/btn"
                              >
                                <i className="fas fa-wand-sparkles mr-2 group-hover/btn:rotate-12 transition-transform"></i>
                                Generate 3 Variations
                              </button>
                            )}
                          </div>

                          {state.isGeneratingVariants ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="aspect-video bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden">
                                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                </div>
                              ))}
                            </div>
                          ) : state.variants.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-500">
                              {state.variants.map((v, i) => (
                                <div key={i} className="aspect-video rounded-2xl overflow-hidden bg-slate-100 relative group/variant shadow-sm border border-slate-100">
                                  <img src={v} alt={`Variant ${i+1}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/variant:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                    <button 
                                      onClick={() => setPreviewImage(v)}
                                      className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-600 hover:scale-110 transition-transform"
                                      title="Large Preview"
                                    >
                                      <i className="fas fa-search-plus text-xs"></i>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setState(prev => ({...prev, generatedImage: v}));
                                        setIsEditingMode(true);
                                      }}
                                      className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-indigo-600 hover:scale-110 transition-transform"
                                      title="Refine this version"
                                    >
                                      <i className="fas fa-magic text-xs"></i>
                                    </button>
                                    <button 
                                      onClick={() => saveToGallery(v)}
                                      className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-green-600 hover:scale-110 transition-transform"
                                      title="Save"
                                    >
                                      <i className="fas fa-save text-xs"></i>
                                    </button>
                                    <button 
                                      onClick={() => setState(prev => ({...prev, generatedImage: v}))}
                                      className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                                      title="Set as Main"
                                    >
                                      <i className="fas fa-expand-alt text-xs"></i>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {state.analyzedData && (
                      <div className="grid md:grid-cols-2 gap-4 mt-8">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 h-full">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center">
                            <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>Design Insights
                          </h4>
                          <div className="space-y-3">
                            <div className="p-3 bg-indigo-50 rounded-xl">
                              <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Current Style</p>
                              <p className="text-slate-700 text-sm font-medium">{state.analyzedData.style}</p>
                            </div>
                            <ul className="space-y-2">
                              {state.analyzedData.suggestions.map((s, i) => (
                                <li key={i} className="text-sm text-slate-600 flex items-start">
                                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 h-full">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center">
                            <i className="fas fa-box text-blue-500 mr-2"></i>Organization Tips
                          </h4>
                          <ul className="space-y-3">
                            {state.analyzedData.organizationTips.map((tip, i) => (
                              <li key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-700">
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Controls */}
              <div className="lg:col-span-4">
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 sticky top-24 overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
                  {/* Header Section */}
                  <div className="p-5 border-b border-slate-100 bg-white">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <i className="fas fa-sliders-h mr-2 text-indigo-600"></i>Design Studio
                      </h3>
                      <div className="flex space-x-1">
                        <button 
                          onClick={undo}
                          disabled={state.historyPast.length === 0}
                          title="Undo"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            state.historyPast.length === 0 ? 'text-slate-200' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <i className="fas fa-undo text-xs"></i>
                        </button>
                        <button 
                          onClick={redo}
                          disabled={state.historyFuture.length === 0}
                          title="Redo"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            state.historyFuture.length === 0 ? 'text-slate-200' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <i className="fas fa-redo text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Scrollable Content Section */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                    {/* User Specific Items */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Specific Items</label>
                        <label className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-indigo-100 transition-colors">
                          <i className="fas fa-upload mr-1"></i> Add
                          <input type="file" multiple className="hidden" accept="image/*" onChange={handleElementItemUpload} />
                        </label>
                      </div>
                      {state.elementImages.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {state.elementImages.map((img, idx) => (
                            <div key={idx} className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex-shrink-0 relative group overflow-hidden shadow-sm">
                              <img src={img} className="w-full h-full object-cover" alt="My Item" />
                              <button 
                                onClick={() => removeElementItem(idx)}
                                className="absolute inset-0 bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <i className="fas fa-times text-xs"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-400">Upload furniture photos to include them.</p>
                        </div>
                      )}
                    </div>

                    {/* Elements List */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Suggested Elements</label>
                      <div className="flex flex-wrap gap-1.5 mb-4 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                        {availableElements.map((el) => {
                          const isSelected = state.selectedElements.includes(el);
                          return (
                            <button
                              key={el}
                              onClick={() => toggleElement(el)}
                              className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all duration-200 flex items-center ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm font-semibold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                              }`}
                            >
                              {isSelected && <i className="fas fa-check mr-1.5 text-[9px]"></i>}
                              {el}
                            </button>
                          );
                        })}
                      </div>
                      
                      <div className="flex space-x-2">
                        <input 
                          type="text" 
                          value={customElement}
                          onChange={(e) => setCustomElement(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addCustomElement()}
                          placeholder="Add custom..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none focus:bg-white transition-all"
                        />
                        <button 
                          onClick={addCustomElement}
                          className="bg-slate-100 text-slate-600 w-8 h-8 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center"
                        >
                          <i className="fas fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Footer Action Section */}
                  <div className="p-5 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={handleRedesign}
                      disabled={!canRedesign || state.isGenerating}
                      className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl transition-all active:scale-[0.98] ${
                        !canRedesign || state.isGenerating
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                      }`}
                    >
                      <i className={`fas ${state.isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                      <span>{state.isGenerating ? 'Designing...' : 'Reimagine Space'}</span>
                    </button>
                    {state.isAnalyzing && (
                      <p className="text-[10px] text-center text-indigo-500 mt-2 font-bold animate-pulse">Aura is analyzing your room photo...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Aura Pro Tip - Hidden on scroll down */}
            <div 
              className={`mt-16 max-w-7xl mx-auto w-full px-4 transition-all duration-700 transform ${
                isScrollingDown && isScrolledPastHero ? 'opacity-0 translate-y-10 pointer-events-none scale-95' : 'opacity-100 translate-y-0 scale-100'
              }`}
            >
              <div className="bg-indigo-900 rounded-3xl p-8 text-white overflow-hidden relative shadow-2xl flex flex-col md:flex-row items-center justify-between">
                <div className="relative z-10 md:max-w-2xl text-center md:text-left">
                  <h4 className="font-bold mb-3 flex items-center justify-center md:justify-start text-indigo-200 uppercase tracking-widest text-xs">
                    <i className="fas fa-sparkles mr-2 text-indigo-300"></i>
                    Aura Pro Tip
                  </h4>
                  <p className="text-lg md:text-xl text-indigo-50 font-medium leading-relaxed italic">
                    "Lighting determines the mood. Match your suggested {state.analyzedData?.roomType || 'space'} with layered warm lighting for the best visual result."
                  </p>
                </div>
                <div className="mt-6 md:mt-0 relative z-10">
                  <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-2xl font-bold transition-all backdrop-blur-md">
                    Explore Lighting Guide
                  </button>
                </div>
                <i className="fas fa-quote-right absolute -bottom-8 -right-4 text-[160px] text-indigo-800 opacity-20 pointer-events-none"></i>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Spatial Layout Arrangement Modal */}
      {state.isArranging && state.originalImage && (
        <div 
          className="fixed inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-between p-4 md:p-6 animate-in fade-in duration-300"
        >
          <div className="w-full flex justify-between items-center mb-4 text-white px-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <i className="fas fa-hand-pointer text-lg"></i>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Arrange Your Space</h2>
                <p className="text-slate-400 text-xs hidden md:block">Drag the markers to the precise spot where you want each element</p>
              </div>
            </div>
            <button 
              onClick={() => setState(prev => ({ ...prev, isArranging: false }))}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-xl"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div 
            ref={layoutContainerRef}
            className="relative flex-1 w-full max-w-[95vw] md:max-w-[85vw] bg-black/40 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.2)] border border-white/5 flex items-center justify-center group/large-arrange"
          >
            <img 
              src={state.generatedImage || state.originalImage} 
              alt="Base for Arrangement" 
              className="w-full h-full object-contain pointer-events-none" 
            />
            
            <div className="absolute inset-0 z-10">
              {Object.keys(state.elementPositions).map((key) => {
                const pos = state.elementPositions[key];
                const isUserItem = key.startsWith('Uploaded Item');
                const userItemIndex = isUserItem ? parseInt(key.split(' ').pop() || '0') - 1 : -1;
                const userItemImage = isUserItem ? state.elementImages[userItemIndex] : null;

                return (
                  <div
                    key={key}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group/pin select-none"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onMouseDown={(e) => {
                      const handleMove = (ev: MouseEvent) => handleDrag(ev as any, key);
                      const handleUp = () => {
                        window.removeEventListener('mousemove', handleMove);
                        window.removeEventListener('mouseup', handleUp);
                      };
                      window.addEventListener('mousemove', handleMove);
                      window.addEventListener('mouseup', handleUp);
                    }}
                    onTouchStart={(e) => {
                      const handleMove = (ev: TouchEvent) => handleDrag(ev as any, key);
                      const handleUp = () => {
                        window.removeEventListener('touchmove', handleMove);
                        window.removeEventListener('touchend', handleUp);
                      };
                      window.addEventListener('touchmove', handleMove);
                      window.addEventListener('touchend', handleUp);
                    }}
                  >
                    <div className="bg-white text-indigo-700 text-[10px] md:text-xs font-black px-4 py-2 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-2 border-indigo-600 flex items-center whitespace-nowrap animate-in zoom-in-95 hover:bg-indigo-50 transition-colors">
                      {isUserItem && userItemImage ? (
                        <div className="w-6 h-6 rounded-md mr-2 overflow-hidden border border-slate-200">
                          <img src={userItemImage} className="w-full h-full object-cover" alt="Thumb" />
                        </div>
                      ) : (
                        <i className="fas fa-arrows-alt mr-2 opacity-50"></i>
                      )}
                      {key.toUpperCase()}
                    </div>
                    <div className="w-5 h-5 bg-indigo-600 rounded-full border-4 border-white shadow-lg mx-auto -mt-1 scale-100 group-hover/pin:scale-125 transition-transform duration-200"></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full py-6 flex justify-center space-x-6">
            <button 
              onClick={() => setState(prev => ({ ...prev, isArranging: false }))}
              className="px-8 py-3 rounded-2xl bg-white/5 text-slate-300 font-bold hover:bg-white/10 transition-all border border-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button 
              onClick={handleApplyLayout}
              className="px-12 py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] flex items-center active:scale-95 group/gen"
            >
              <i className="fas fa-wand-magic-sparkles mr-3 group-hover/gen:rotate-12 transition-transform"></i>
              Regenerate Layout
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {previewImage && !state.isArranging && (
        <div 
          className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white text-3xl hover:scale-110 transition-transform z-10"
            onClick={() => setPreviewImage(null)}
          >
            <i className="fas fa-times"></i>
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImage} 
              alt="Fullscreen Preview" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
            />
            <div className="absolute bottom-6 flex space-x-4">
              <button 
                onClick={() => handleDownload(previewImage)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-2 rounded-full border border-white/20 font-bold transition-all flex items-center"
              >
                <i className="fas fa-download mr-2"></i> Download Full Size
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatBot currentImage={state.originalImage || undefined} />
      
      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2 opacity-50">
            <i className="fas fa-couch text-indigo-600"></i>
            <span className="text-sm font-bold text-slate-900 tracking-tight">AuraDesign</span>
          </div>
          <p className="text-slate-400 text-xs">© 2024 AuraDesign AI. Transform your living experience.</p>
          <div className="flex space-x-6">
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><i className="fab fa-instagram"></i></a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><i className="fab fa-twitter"></i></a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><i className="fab fa-pinterest"></i></a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
