import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Briefcase, CheckCircle, HelpCircle, XCircle, Search } from 'lucide-react';
import type { JobPosting, SearchConfig } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

interface MatchingJobsListProps {
  selectedConfig: SearchConfig;
  jobs: JobPosting[];
  loadingJobs: boolean;
}

export default function MatchingJobsList({
  selectedConfig,
  jobs,
  loadingJobs
}: MatchingJobsListProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'relevant' | 'pre-match' | 'irrelevant'>('all');

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'relevant') return job.ai_parsed && job.is_relevant;
    if (filter === 'pre-match') return !job.ai_parsed && job.is_relevant;
    if (filter === 'irrelevant') return !job.is_relevant;
    return true;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Strategy Title Header */}
      <div className="p-6 border-b border-gray-900 shrink-0 bg-gray-950/20 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Matched Results</span>
          <h2 className="text-xl font-display font-bold text-white tracking-tight leading-tight mt-0.5">
            {selectedConfig.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-900 text-[10px]">
            {(['all', 'relevant', 'pre-match', 'irrelevant'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-2 py-1 rounded capitalize font-medium transition-all ${
                  filter === opt ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium ml-2">
            {filteredJobs.length} jobs shown
          </span>
        </div>
      </div>

      {/* Jobs List container */}
      <div className="flex-grow overflow-y-auto p-6 scrollbar-thin">
        {loadingJobs ? (
          <LoadingSpinner text="Matching jobs..." />
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No Matched Jobs Found"
            description="No jobs match your current filter selection, or you haven't run a scrape job for this strategy yet."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.map((job) => (
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
  );
}
