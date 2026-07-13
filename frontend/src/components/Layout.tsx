import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Settings, 
  Terminal, 
  Search, 
  Play, 
  Briefcase
} from 'lucide-react';
import StartSearchModal from './StartSearchModal';
import { api } from '../api';

export default function Layout() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Check backend connection health
    api.health.check()
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false));
  }, [location.pathname]); // Re-check on nav actions as a simple keep-alive

  const navItems = [
    { name: 'Companies', path: '/companies', icon: Building2 },
    { name: 'Task Queue', path: '/queue', icon: Terminal },
    { name: 'LLM Config', path: '/settings/llm', icon: Settings },
    { name: 'Job Search', path: '/search-configs', icon: Search },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] font-sans antialiased text-gray-100">
      {/* Left Sidebar */}
      <aside className="w-72 h-full flex flex-col bg-gray-950/80 border-r border-gray-900/80 glass-effect p-6 select-none shrink-0">
        
        {/* Brand Header */}
        <div className="flex flex-col gap-1 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 rounded-lg border border-indigo-500/20 text-indigo-400">
              <Briefcase size={22} className="stroke-[2.5]" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              DeepTech Radar
            </span>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-2 mt-2 px-1 text-xs">
            <span className="relative flex h-2 w-2">
              {isConnected === true && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected === true ? 'bg-emerald-500' : isConnected === false ? 'bg-rose-500' : 'bg-amber-500'
              }`}></span>
            </span>
            <span className="text-gray-500 font-medium">
              {isConnected === true ? 'Connected to local core' : isConnected === false ? 'Core offline' : 'Syncing local state...'}
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-grow flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                      : 'text-gray-400 border border-transparent hover:text-gray-200 hover:bg-gray-900/60'
                  }`
                }
              >
                <Icon size={18} className="stroke-[2]" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer Action */}
        <div className="mt-auto pt-6 border-t border-gray-900/60">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 shadow-[0_4px_24px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Play size={16} fill="currentColor" />
            <span>START JOB SEARCH</span>
          </button>
        </div>
      </aside>

      {/* Right Main Content Pane */}
      <main className="flex-grow h-full overflow-y-auto bg-[#090d16] relative">
        <Outlet />
      </main>

      {/* Start Job Search Dialog */}
      <StartSearchModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
