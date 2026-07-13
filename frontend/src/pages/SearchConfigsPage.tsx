import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import type { SearchConfig, JobPosting } from '../types';
import { api } from '../api';
import StrategyForm from '../components/searchConfigs/StrategyForm';
import StrategyList from '../components/searchConfigs/StrategyList';
import MatchingJobsList from '../components/searchConfigs/MatchingJobsList';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorAlert from '../components/ui/ErrorAlert';

export default function SearchConfigsPage() {
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SearchConfig | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  // Fetch all search configurations
  const fetchConfigs = async (autoSelectId?: number) => {
    setLoadingConfigs(true);
    setError(null);
    try {
      const data = await api.searchConfigs.list();
      setConfigs(data);
      if (data.length > 0) {
        const selectTarget = autoSelectId 
          ? data.find(c => c.id === autoSelectId) || data[0] 
          : data[0];
        setSelectedConfig(selectTarget);
      } else {
        setSelectedConfig(null);
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
      const data = await api.searchConfigs.getJobs(configId);
      setJobs(data);
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

  const handleDeleteStrategy = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this search strategy?')) return;
    setActionId(id);
    try {
      await api.searchConfigs.remove(id);
      const remaining = configs.filter((c) => c.id !== id);
      setConfigs(remaining);
      if (selectedConfig?.id === id) {
        setSelectedConfig(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* LEFT COLUMN: Search Strategies Panel */}
      <div className="w-80 border-r border-gray-900 bg-gray-950/40 p-6 flex flex-col shrink-0 overflow-y-auto scrollbar-thin">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Search Filters</span>
            <h2 className="text-lg font-display font-bold text-white tracking-tight mt-0.5">Strategies</h2>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 flex items-center justify-center"
              title="Create New Strategy"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {showForm && (
          <StrategyForm 
            onCancel={() => setShowForm(false)} 
            onSuccess={(newId) => {
              setShowForm(false);
              fetchConfigs(newId);
            }} 
          />
        )}

        {error && <ErrorAlert message={error} onRetry={fetchConfigs} />}

        {loadingConfigs ? (
          <LoadingSpinner text="Loading strategies..." />
        ) : (
          <StrategyList
            configs={configs}
            selectedId={selectedConfig?.id}
            onSelect={setSelectedConfig}
            onDelete={handleDeleteStrategy}
            actionId={actionId}
          />
        )}
      </div>

      {/* RIGHT COLUMN: Detail / Matching Job Postings */}
      <div className="flex-grow h-full flex flex-col bg-[#090d16]/40 overflow-hidden">
        {selectedConfig ? (
          <MatchingJobsList
            selectedConfig={selectedConfig}
            jobs={jobs}
            loadingJobs={loadingJobs}
          />
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
