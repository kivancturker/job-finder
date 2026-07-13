
export default function CompaniesPage() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-display font-semibold tracking-tight text-white">Tracked Companies</h1>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg font-medium transition-all">
          Add New Company
        </button>
      </div>
      <div className="glass-effect rounded-xl p-6 border border-gray-800">
        <p className="text-gray-400">Companies list view placeholder (Phase 5 implementation)</p>
      </div>
    </div>
  );
}
