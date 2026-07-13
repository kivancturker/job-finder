import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Play, Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface StartSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import type { SearchConfig } from '../types';
import { api } from '../api';

export default function StartSearchModal({ isOpen, onClose }: StartSearchModalProps) {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFetching(true);
      setError(null);
      api.searchConfigs.list()
        .then((data) => {
          setConfigs(data);
          if (data.length > 0) {
            setSelectedConfigId(data[0].id);
          }
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfigId) return;

    setLoading(true);
    setError(null);

    try {
      await api.runSearch.start(selectedConfigId);

      onClose();
      navigate('/queue');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-800/80 shadow-2xl transition-all p-6 text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles size={18} className="stroke-[2.5]" />
            <h3 className="text-lg font-display font-semibold text-white">Start New Job Search</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Fetching loading spinner */}
        {fetching ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-gray-400 text-sm">Loading strategies...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Error box */}
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex gap-2.5 items-start">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{error}</span>
              </div>
            )}

            {configs.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-gray-400 text-sm mb-4">No search configurations found. You need to create a strategy first.</p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/search-configs');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all"
                >
                  Create Strategy
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="strategy" className="block text-xs font-semibold text-gray-400 tracking-wider uppercase">
                    Select Search Strategy
                  </label>
                  <select
                    id="strategy"
                    value={selectedConfigId}
                    onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                    disabled={loading}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {configs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name} ({config.keywords.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedConfigId}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span>Starting...</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" />
                        <span>Run Search</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
