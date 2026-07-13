import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  Code, 
  AlignLeft 
} from 'lucide-react';
import type { JobPosting } from '../types';
import { api } from '../api';

export default function JobDescriptionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // AI evaluation states
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Mark job as visited and fetch its details
  useEffect(() => {
    if (!id) return;

    const initializeJob = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Mark as visited
        api.jobs.markVisited(id).catch((err) => 
          console.error('Failed to mark job as visited:', err)
        );

        // 2. Fetch details
        const data = await api.jobs.get(id);
        setJob(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeJob();
  }, [id]);

  const handleEvaluate = async () => {
    if (!id) return;

    setEvaluating(true);
    setEvalError(null);

    try {
      const data = await api.jobs.evaluate(id);
      setJob(data);
    } catch (err: any) {
      setEvalError(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors mb-2 inline-flex items-center gap-1.5 cursor-pointer text-sm font-medium"
        >
          <ArrowLeft size={16} />
          <span>Back to Results</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={36} />
          <span className="text-gray-400 text-sm">Loading job description...</span>
        </div>
      ) : error || !job ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex gap-3 items-center">
          <AlertCircle className="shrink-0" size={20} />
          <div className="flex-1">
            <span className="font-semibold">Error:</span> {error || 'Job posting not found'}
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Header Card */}
          <div className="glass-effect rounded-2xl p-6 border border-gray-800/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight leading-tight">
                {job.title}
              </h1>
              <p className="text-indigo-400 font-semibold text-lg mt-1">
                {job.company_name || 'Unknown Company'}
              </p>
              <div className="text-xs text-gray-500 mt-2 font-medium">
                Scraped on {new Date(job.created_at).toLocaleString()}
              </div>
            </div>
            
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.2)] font-semibold transition-all cursor-pointer text-sm shrink-0 md:self-center self-start"
            >
              <span>View Original Listing</span>
              <ExternalLink size={15} />
            </a>
          </div>

          {/* AI Analysis Pane */}
          <div className="glass-effect rounded-2xl border border-gray-800/80 p-6 shadow-xl relative overflow-hidden">
            {/* Ambient background glow for AI section */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-2 border-b border-gray-900 pb-4 mb-4">
              <Sparkles size={18} className="text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">AI Copilot Analysis</h2>
            </div>

            {evaluating ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-gray-400 text-sm">AI is parsing and evaluating the job text...</span>
              </div>
            ) : job.ai_parsed ? (
              <div className="space-y-5">
                {/* Relevance & Experience Status */}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Evaluation Status:</span>
                    {job.is_relevant ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold">
                        <CheckCircle2 size={14} />
                        <span>Relevant Fit</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold">
                        <XCircle size={14} />
                        <span>Irrelevant Position</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Required Experience:</span>
                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs font-mono font-bold">
                      {job.min_experience > 0 ? `${job.min_experience}+ years` : 'Not specified / Entry'}
                    </span>
                  </div>
                </div>

                {/* AI Summary */}
                {job.ai_summary && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Summary</h3>
                    <div className="p-4 bg-gray-950/60 border border-gray-900 rounded-xl text-sm leading-relaxed text-gray-300 font-medium">
                      {job.ai_summary}
                    </div>
                  </div>
                )}

                {/* Tech Stack Tags */}
                {job.tech_stack && job.tech_stack.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Code size={13} className="text-indigo-400" />
                      <span>Extracted Tech Stack</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {job.tech_stack.map((tech, i) => (
                        <span 
                          key={i} 
                          className="text-xs px-3 py-1 bg-indigo-500/10 text-indigo-300 font-mono font-medium rounded-lg border border-indigo-500/10"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center space-y-4">
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  This job posting has not been processed through the AI pipeline yet. Click below to analyze it.
                </p>
                {evalError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-2 items-start max-w-md mx-auto">
                    <AlertCircle className="shrink-0 mt-0.5" size={14} />
                    <span>{evalError}</span>
                  </div>
                )}
                <button
                  onClick={handleEvaluate}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <Cpu size={16} />
                  <span>Analyze Description with AI</span>
                </button>
              </div>
            )}
          </div>

          {/* Raw Text Description Pane */}
          <div className="glass-effect rounded-2xl border border-gray-800/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-900 pb-4">
              <AlignLeft size={18} className="text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Full Job Description</h2>
            </div>
            
            <div className="p-6 bg-gray-950/80 border border-gray-900 rounded-xl max-h-[500px] overflow-y-auto font-sans text-sm text-gray-300 leading-relaxed whitespace-pre-wrap select-text scrollbar-thin">
              {job.raw_text}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
