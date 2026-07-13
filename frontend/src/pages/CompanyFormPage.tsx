import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  Building2, 
  Link, 
  Cpu, 
  Tag 
} from 'lucide-react';
import type { Company, ApiResponse } from '../types';

export default function CompanyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;

  const [name, setName] = useState('');
  const [careerUrl, setCareerUrl] = useState('');
  const [scraperEngine, setScraperEngine] = useState<'cheerio' | 'playwright'>('cheerio');
  const [targetSelector, setTargetSelector] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) {
      const fetchCompany = async () => {
        setFetching(true);
        setError(null);
        try {
          const response = await fetch(`/api/companies/${id}`);
          const result: ApiResponse<Company> = await response.json();
          if (result.success && result.data) {
            setName(result.data.name);
            setCareerUrl(result.data.career_url);
            setScraperEngine(result.data.scraper_engine);
            setTargetSelector(result.data.target_selector || '');
          } else {
            throw new Error(result.error || 'Failed to load company details');
          }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setFetching(false);
        }
      };
      fetchCompany();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !careerUrl.trim()) {
      setError('Company name and Career page URL are required.');
      return;
    }

    // URL verification
    try {
      new URL(careerUrl.trim());
    } catch {
      setError('Please enter a valid career page URL (must include http:// or https://).');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      career_url: careerUrl.trim(),
      scraper_engine: scraperEngine,
      target_selector: targetSelector.trim() || null,
    };

    try {
      const url = isEdit ? `/api/companies/${id}` : '/api/companies';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse<Company> = await response.json();

      if (result.success) {
        navigate('/companies');
      } else {
        throw new Error(result.error || 'Failed to save company');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      {/* Back link */}
      <div className="mb-6">
        <button 
          onClick={() => navigate('/companies')}
          className="text-gray-400 hover:text-white transition-colors mb-2 inline-flex items-center gap-1.5 cursor-pointer text-sm font-medium"
        >
          <ArrowLeft size={16} />
          <span>Back to Companies</span>
        </button>
        <h1 className="text-3xl font-display font-bold tracking-tight text-white">
          {isEdit ? 'Edit Company Details' : 'Add New Company'}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {isEdit ? 'Update configurations for scraping this career page.' : 'Register a new deep-tech company career page for the scraper queue.'}
        </p>
      </div>

      {fetching ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <span className="text-gray-400 text-sm">Fetching company details...</span>
        </div>
      ) : (
        <div className="glass-effect rounded-2xl p-6 border border-gray-800/80 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex gap-2.5 items-start">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Company Name */}
            <div className="space-y-2">
              <label htmlFor="company-name" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Building2 size={16} />
                </div>
                <input
                  type="text"
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. OpenAI"
                  disabled={loading}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Career Page URL */}
            <div className="space-y-2">
              <label htmlFor="career-url" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Career Page URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Link size={16} />
                </div>
                <input
                  type="text"
                  id="career-url"
                  value={careerUrl}
                  onChange={(e) => setCareerUrl(e.target.value)}
                  placeholder="https://company.com/careers"
                  disabled={loading}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <span className="block text-xs text-gray-500 mt-1">
                The target website URL where job listings are rendered.
              </span>
            </div>

            {/* Scraper Engine Select */}
            <div className="space-y-2">
              <label htmlFor="scraper-engine" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Scraper Engine Tier
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Cpu size={16} />
                </div>
                <select
                  id="scraper-engine"
                  value={scraperEngine}
                  onChange={(e) => setScraperEngine(e.target.value as 'cheerio' | 'playwright')}
                  disabled={loading}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="cheerio">Cheerio (Fast, static HTML extraction)</option>
                  <option value="playwright">Playwright (Fallback, handles JavaScript-rendered listings)</option>
                </select>
              </div>
            </div>

            {/* Target Selector */}
            <div className="space-y-2">
              <label htmlFor="target-selector" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Custom CSS Selector (Optional override)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Tag size={16} />
                </div>
                <input
                  type="text"
                  id="target-selector"
                  value={targetSelector}
                  onChange={(e) => setTargetSelector(e.target.value)}
                  placeholder="e.g. div.job-card or a[href*='/jobs/']"
                  disabled={loading}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
              <span className="block text-xs text-gray-500 mt-1">
                If the page renders complex markup, specify the container CSS selector matching individual job link cards.
              </span>
            </div>

            {/* Buttons */}
            <div className="pt-4 flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/companies')}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold tracking-wide transition-all shadow-[0_4px_16px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEdit ? 'Update Company' : 'Register Company'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
