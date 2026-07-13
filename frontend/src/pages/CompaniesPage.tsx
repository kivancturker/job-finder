import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  Check, 
  X 
} from 'lucide-react';
import type { Company } from '../types';
import { api } from '../api';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.companies.list();
      setCompanies(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleDelete = async (id: number) => {
    setDeleteLoading(true);
    try {
      await api.companies.remove(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white">Tracked Companies</h1>
          <p className="text-gray-400 mt-1 text-sm">Websites being searched for active job opportunities.</p>
        </div>
        <button
          onClick={() => navigate('/companies/new')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.2)] font-semibold transition-all cursor-pointer text-sm"
        >
          <Plus size={16} />
          <span>Add Company</span>
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={36} />
          <span className="text-gray-400 text-sm">Loading tracked companies...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex gap-3 items-center max-w-xl mx-auto">
          <AlertCircle className="shrink-0" size={20} />
          <div className="flex-1">
            <span className="font-semibold">Error:</span> {error}
          </div>
          <button 
            onClick={fetchCompanies}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      ) : companies.length === 0 ? (
        <div className="glass-effect rounded-2xl p-12 border border-gray-800/80 text-center max-w-xl mx-auto mt-6">
          <div className="p-4 bg-gray-900/80 text-gray-500 rounded-2xl w-fit mx-auto mb-4 border border-gray-800">
            <Building2 size={32} />
          </div>
          <h3 className="text-lg font-semibold text-white">No Tracked Companies</h3>
          <p className="text-gray-400 mt-2 text-sm max-w-sm mx-auto">
            Get started by adding deep-tech companies whose career pages you want to monitor.
          </p>
          <button
            onClick={() => navigate('/companies/new')}
            className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            Add First Company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div 
              key={company.id}
              className="glass-effect rounded-2xl border border-gray-800/80 p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-gray-700/80 hover:shadow-2xl"
            >
              <div>
                {/* Card Title & Scraper Engine Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="font-display font-bold text-lg text-white tracking-tight line-clamp-1">
                    {company.name}
                  </h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                    company.scraper_engine === 'cheerio'
                      ? 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                      : 'bg-purple-600/10 border-purple-500/20 text-purple-400'
                  }`}>
                    {company.scraper_engine}
                  </span>
                </div>

                {/* Career Link */}
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Career Page URL
                    </label>
                    <a
                      href={company.career_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-indigo-400 text-sm font-medium transition-colors inline-flex items-center gap-1.5 break-all line-clamp-2"
                    >
                      <span>{company.career_url}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  </div>

                  {/* Custom Target Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Target Card Selector
                    </label>
                    {company.target_selector ? (
                      <code className="text-xs bg-gray-950 border border-gray-800 px-2 py-1 rounded text-indigo-300 font-mono select-all">
                        {company.target_selector}
                      </code>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Default fallback selector</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-900 pt-4 mt-auto flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Added {new Date(company.created_at).toLocaleDateString()}
                </span>
                
                <div className="flex items-center gap-2">
                  {deletingId === company.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-2 py-1">
                      <span className="text-xs text-rose-400 font-semibold px-1">Confirm delete?</span>
                      <button
                        onClick={() => handleDelete(company.id)}
                        disabled={deleteLoading}
                        className="p-1 hover:bg-rose-500 hover:text-white rounded-lg text-rose-400 transition-all cursor-pointer"
                        title="Yes, delete"
                      >
                        {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        disabled={deleteLoading}
                        className="p-1 hover:bg-gray-800 text-gray-400 rounded-lg transition-all cursor-pointer"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate(`/companies/edit/${company.id}`)}
                        className="p-2 hover:bg-gray-800 text-gray-400 hover:text-indigo-400 rounded-xl transition-all cursor-pointer"
                        title="Edit Company"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingId(company.id)}
                        className="p-2 hover:bg-rose-950/30 text-gray-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                        title="Delete Company"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
