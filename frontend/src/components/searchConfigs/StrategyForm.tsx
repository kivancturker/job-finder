import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../api';

interface StrategyFormProps {
  onCancel: () => void;
  onSuccess: (id: number) => void;
}

export default function StrategyForm({ onCancel, onSuccess }: StrategyFormProps) {
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState('');
  const [minExperience, setMinExperience] = useState(0);
  const [targetCountries, setTargetCountries] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Strategy name is required');
      return;
    }
    if (!keywords.trim()) {
      setFormError('At least one keyword is required');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const kwArr = keywords.split(',').map((k) => k.trim()).filter((k) => k !== '');
    const negKwArr = negativeKeywords.split(',').map((k) => k.trim()).filter((k) => k !== '');
    const countriesArr = targetCountries.split(',').map((k) => k.trim()).filter((k) => k !== '');

    const payload = {
      name: name.trim(),
      keywords: kwArr,
      negative_keywords: negKwArr.length > 0 ? negKwArr : null,
      min_experience: Number(minExperience),
      target_countries: countriesArr.length > 0 ? countriesArr : null,
      custom_prompt: customPrompt.trim() ? customPrompt.trim() : null,
    };

    try {
      const data = await api.searchConfigs.create(payload);
      onSuccess(data.id);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="glass-effect rounded-2xl p-4 border border-gray-800/80 mb-6 space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-gray-900 pb-2">
        <span className="text-sm font-semibold text-white">Create Strategy</span>
        <button 
          onClick={onCancel} 
          className="text-xs text-gray-500 hover:text-gray-300"
          type="button"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {formError && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-1.5 items-start">
            <AlertCircle className="shrink-0 mt-0.5" size={13} />
            <span>{formError}</span>
          </div>
        )}

        {/* Name */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Strategy Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. C++ Engine Dev"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            disabled={formLoading}
          />
        </div>

        {/* Keywords */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Keywords (comma separated)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="C++, Rust, compiler"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            disabled={formLoading}
          />
        </div>

        {/* Negative Keywords */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Exclude Keywords (comma separated)</label>
          <input
            type="text"
            value={negativeKeywords}
            onChange={(e) => setNegativeKeywords(e.target.value)}
            placeholder="Manager, senior, web"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            disabled={formLoading}
          />
        </div>

        {/* Experience and Country */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Min Exp (Yrs)</label>
            <input
              type="number"
              min={0}
              value={minExperience}
              onChange={(e) => setMinExperience(Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              disabled={formLoading}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Countries (comma sep)</label>
            <input
              type="text"
              value={targetCountries}
              onChange={(e) => setTargetCountries(e.target.value)}
              placeholder="USA, Remote"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              disabled={formLoading}
            />
          </div>
        </div>

        {/* Custom Prompt */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Custom AI prompt / context (optional)</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. Look for roles focusing on storage engines or compiler design. Exclude software-only engineering jobs unless they are optimization software."
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 h-20 resize-none font-sans"
            disabled={formLoading}
          />
        </div>

        <button
          type="submit"
          disabled={formLoading}
          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
        >
          {formLoading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Create Strategy</span>
          )}
        </button>
      </form>
    </div>
  );
}
