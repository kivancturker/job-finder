import { useParams, useNavigate } from 'react-router-dom';

export default function CompanyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== undefined;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/companies')}
          className="text-gray-400 hover:text-white transition-colors mb-2 inline-flex items-center gap-1"
        >
          &larr; Back to Companies
        </button>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-white">
          {isEdit ? 'Edit Company Details' : 'Add New Company'}
        </h1>
      </div>
      <div className="glass-effect rounded-xl p-6 border border-gray-800">
        <p className="text-gray-400">Company form placeholder (Phase 5 implementation)</p>
      </div>
    </div>
  );
}
