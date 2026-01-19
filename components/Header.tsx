
import React from 'react';

interface HeaderProps {
  activeTab: 'workspace' | 'gallery';
  setActiveTab: (tab: 'workspace' | 'gallery') => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('workspace')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <i className="fas fa-couch text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">AuraDesign</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">AI Spaces</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center space-x-8">
          <button 
            onClick={() => setActiveTab('workspace')}
            className={`text-sm font-medium transition-colors ${activeTab === 'workspace' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
          >
            Workspace
          </button>
          <button 
            onClick={() => setActiveTab('gallery')}
            className={`text-sm font-medium transition-colors ${activeTab === 'gallery' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
          >
            Gallery
          </button>
          <a href="#" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Tutorials</a>
        </nav>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
          Aura Pro
        </button>
      </div>
    </header>
  );
};

export default Header;
