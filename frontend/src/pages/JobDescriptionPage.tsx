import { useParams, useNavigate } from 'react-router-dom';

export default function JobDescriptionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors mb-2 inline-flex items-center gap-1"
        >
          &larr; Back to Results
        </button>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-white">Job Details</h1>
        <p className="text-gray-400 mt-1">Viewing details for job ID: {id}</p>
      </div>
      <div className="glass-effect rounded-xl p-6 border border-gray-800">
        <p className="text-gray-400">Job description details placeholder (Phase 5 implementation)</p>
      </div>
    </div>
  );
}
