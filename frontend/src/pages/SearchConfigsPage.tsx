import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  Briefcase, 
  Search,
  CheckCircle,
  HelpCircle,
  XCircle
} from 'lucide-react';
import type { SearchConfig, JobPosting, ApiResponse } from '../types';

export default function SearchConfigsPage() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SearchConfig | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  
  // Page load and action states
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState('');
  const [minExperience, setMinExperience] = useState<number>(0);
  const [targetCountries, setTargetCountries] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch all search configurations
  const fetchConfigs = async (autoSelectId?: number) => {
    setLoadingConfigs(true);
    setError(null);
    try {
      const response = await fetch('/api/search_configs');
      const result: ApiResponse<SearchConfig[]> = await response.json();
      if (result.success && result.data) {
        setConfigs(result.data);
        // Set selected config
        if (result.data.length > 0) {
          const selectTarget = autoSelectId 
            ? result.data.find(c => c.id === autoSelectId) || result.data[0] 
            : result.data[0];
          setSelectedConfig(selectTarget);
        } else {
          setSelectedConfig(null);
        }
      } else {
        throw new Error(result.error || 'Failed to fetch search strategies');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Fetch job postings matching selected strategy
  const fetchJobs = async (configId: number) => {
    setLoadingJobs(true);
    try {
      const response = await fetch(`/api/search_configs/${configId}/jobs`);
      const result: ApiResponse<JobPosting[]> = await response.json();
      if (result.success && result.data) {
        setJobs(result.data);
      } else {
        throw new Error(result.error || 'Failed to load matching jobs');
      }
    } catch (err: any) {
      console.error(err);
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      fetchJobs(selectedConfig.id);
    } else {
      setJobs([]);
    }
  }, [selectedConfig]);

  const handleCreateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Strategy name is required.');
      return;
    }

    const kwArr = keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (kwArr.length === 0) {
      setFormError('At least one search keyword is required.');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const negKwArr = negativeKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const countriesArr = targetCountries.split(',').map(c => c.trim()).filter(Boolean);

    const payload = {
      name: name.trim(),
      keywords: kwArr,
      negative_keywords: negKwArr.length > 0 ? negKwArr : null,
      min_experience: Number(minExperience),
      target_countries: countriesArr.length > 0 ? countriesArr : null,
    };

    try {
      const response = await fetch('/api/search_configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse<SearchConfig> = await response.json();

      if (result.success && result.data) {
        // Reset form
        setName('');
        setKeywords('');
        setNegativeKeywords('');
        setMinExperience(0);
        setTargetCountries('');
        setShowForm(false);
        // Refresh list and select the new config
        fetchConfigs(result.data.id);
      } else {
        throw new Error(result.error || 'Failed to create search strategy');
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteStrategy = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this search strategy?')) return;
    setActionId(id);
    try {
      const response = await fetch(`/api/search_configs/${id}`, {
        method: 'DELETE',
      });
      const result: ApiResponse<{ id: number }> = await response.json();
      if (result.success) {
        // If deleted selected config, select another one or null
        const remaining = configs.filter((c) => c.id !== id);
        setConfigs(remaining);
        if (selectedConfig?.id === id) {
          setSelectedConfig(remaining.length > 0 ? remaining[0] : null);
        }
      } else {
        throw new Error(result.error || 'Failed to delete strategy');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      
      {/* LEFT COLUMN: Master / Strategies list & creation */}
      <div className="w-96 h-full flex flex-col border-r border-gray-900 bg-gray-950/20 shrink-0 overflow-y-auto p-6 scrollbar-thin">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-white">Strategies</h1>
            <p className="text-gray-400 text-xs mt-0.5">Define your job hunting filters.</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="p-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all cursor-pointer"
              title="Create new strategy"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Strategy Creation Form */}
        {showForm && (
          <div className="glass-effect rounded-2xl p-4 border border-gray-800/80 mb-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-gray-900 pb-2">
              <span className="text-sm font-semibold text-white">Create Strategy</span>
              <button 
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }} 
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateStrategy} className="space-y-3.5">
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
        )}

        {/* Master List */}
        {error ? (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-1.5 items-start mb-4">
            <AlertCircle className="shrink-0 mt-0.5" size={14} />
            <span>{error}</span>
          </div>
        ) : loadingConfigs ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="animate-spin text-indigo-500" size={24} />
            <span className="text-gray-500 text-xs">Loading strategies...</span>
          </div>
        ) : configs.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-500 text-xs">No strategies defined yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                onClick={() => setSelectedConfig(config)}
                className={`glass-effect rounded-xl p-4 border transition-all cursor-pointer relative group flex flex-col justify-between ${
                  selectedConfig?.id === config.id
                    ? 'border-indigo-500/35 bg-indigo-950/10 shadow-lg'
                    : 'border-gray-800/80 hover:border-gray-700/80'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-white text-sm line-clamp-1 leading-tight">
                      {config.name}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteStrategy(config.id, e)}
                      disabled={actionId !== null}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-950/20 text-gray-500 hover:text-rose-400 rounded transition-all cursor-pointer shrink-0"
                      title="Delete strategy"
                    >
                      {actionId === config.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {config.keywords.map((kw, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/10">
                        {kw}
                      </span>
                    ))}
                    {config.negative_keywords?.map((nkw, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400/80 font-medium border border-rose-500/10 line-through decoration-rose-500/40">
                        {nkw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-gray-900/60 pt-2 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{config.min_experience}+ Yrs</span>
                    {config.target_countries && config.target_countries.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={9} />
                        <span className="truncate max-w-[100px]">{config.target_countries.join(', ')}</span>
                      </span>
                    )}
                  </div>
                  <ArrowRight size={10} className={`transition-transform duration-200 ${selectedConfig?.id === config.id ? 'translate-x-1 text-indigo-400' : 'text-gray-600'}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Detail / Matching Job Postings */}
      <div className="flex-grow h-full flex flex-col bg-[#090d16]/40 overflow-hidden">
        {selectedConfig ? (
          <div className="h-full flex flex-col overflow-hidden">
            
            {/* Strategy Title Header */}
            <div className="p-6 border-b border-gray-900 shrink-0 bg-gray-950/20 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Matched Results</span>
                <h2 className="text-xl font-display font-bold text-white tracking-tight leading-tight mt-0.5">
                  {selectedConfig.name}
                </h2>
              </div>
              <div className="text-xs text-gray-400 font-medium">
                {jobs.length} jobs matched this strategy
              </div>
            </div>

            {/* Jobs List container */}
            <div className="flex-grow overflow-y-auto p-6 scrollbar-thin">
              {loadingJobs ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                  <span className="text-gray-400 text-sm">Matching jobs...</span>
                </div>
              ) : jobs.length === 0 ? (
                <div className="glass-effect rounded-2xl p-12 border border-gray-800/80 text-center max-w-xl mx-auto mt-6">
                  <div className="p-3 bg-gray-900/80 text-gray-500 rounded-2xl w-fit mx-auto mb-4 border border-gray-800">
                    <Search size={24} />
                  </div>
                  <h3 className="text-base font-semibold text-white">No Matched Jobs Found</h3>
                  <p className="text-gray-400 mt-2 text-sm max-w-sm mx-auto">
                    Try starting a new search scrape job for this strategy from the sidebar action "START JOB SEARCH".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className={`glass-effect rounded-xl border p-4.5 transition-all cursor-pointer duration-200 hover:-translate-x-1 hover:border-gray-700 hover:shadow-lg flex items-start gap-4 ${
                        job.is_visited ? 'border-gray-900/85 bg-gray-950/20' : 'border-gray-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
                      }`}
                    >
                      {/* Unvisited blue indicator dot */}
                      {!job.is_visited && (
                        <span className="relative flex h-2 w-2 mt-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Title & Date */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                          <h3 className={`font-semibold text-sm truncate pr-2 leading-snug ${job.is_visited ? 'text-gray-400' : 'text-white'}`}>
                            {job.title}
                          </h3>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0 font-medium">
                            <Calendar size={11} />
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Company */}
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-indigo-400 font-semibold">
                          <Briefcase size={12} />
                          <span>{job.company_name || 'Unknown Company'}</span>
                        </div>

                        {/* Tech tags preview if available */}
                        {job.tech_stack && job.tech_stack.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {job.tech_stack.slice(0, 5).map((tech, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800 font-mono">
                                {tech}
                              </span>
                            ))}
                            {job.tech_stack.length > 5 && (
                              <span className="text-[9px] px-1 text-gray-500 self-center">
                                +{job.tech_stack.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* AI parsed / relevance badge */}
                      <div className="shrink-0">
                        {job.ai_parsed ? (
                          job.is_relevant ? (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              <CheckCircle size={11} />
                              <span>Relevant</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400/80 text-[10px] font-bold">
                              <XCircle size={11} />
                              <span>Irrelevant</span>
                            </span>
                          )
                        ) : (
                          job.is_relevant ? (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                              <HelpCircle size={11} />
                              <span>Pre-Match</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-800/80 border border-gray-800 text-gray-500 text-[10px] font-bold">
                              <XCircle size={11} />
                              <span>Discarded</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="p-4 bg-gray-950/60 rounded-3xl border border-gray-900 text-gray-600 mb-4 animate-soft-pulse">
              <Search size={36} />
            </div>
            <h3 className="text-lg font-semibold text-white">Select Search Strategy</h3>
            <p className="text-gray-400 mt-2 text-sm max-w-sm">
              Please select a search strategy on the left panel to list its parsed job description findings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
