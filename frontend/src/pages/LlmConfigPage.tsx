import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Trash2, 
  Key, 
  Loader2, 
  Plus, 
  AlertCircle, 
  Cpu, 
  Check, 
  Settings 
} from 'lucide-react';
import type { LLMConfig } from '../types';
import { api } from '../api';

export default function LlmConfigPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [provider, setProvider] = useState<'ollama' | 'openai' | 'anthropic' | 'openrouter'>('ollama');
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Actions loading states
  const [actionId, setActionId] = useState<number | null>(null);

  // Test states for form
  const [formTestLoading, setFormTestLoading] = useState(false);
  const [formTestResult, setFormTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Test states for individual stored config cards
  const [cardTestStates, setCardTestStates] = useState<Record<number, { loading: boolean; success?: boolean; error?: string }>>({});


  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.llmConfigs.list();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Clear test results on input change
  useEffect(() => {
    setFormTestResult(null);
  }, [provider, modelName, apiKey]);

  const handleTestFormConnection = async () => {
    if (!modelName.trim()) {
      setError('Model Name is required to test connection.');
      return;
    }

    if (provider !== 'ollama' && !apiKey.trim()) {
      setError(`API Key is required for provider ${provider} to test connection.`);
      return;
    }

    setFormTestLoading(true);
    setFormTestResult(null);
    setError(null);

    try {
      const res = await api.llmConfigs.testConnection({
        provider,
        model_name: modelName.trim(),
        api_key: apiKey.trim() || null
      });
      setFormTestResult(res);
    } catch (err: any) {
      setFormTestResult({
        success: false,
        message: err.message || 'Connection test failed',
        details: err.message
      });
    } finally {
      setFormTestLoading(false);
    }
  };

  const handleTestCardConnection = async (id: number) => {
    setCardTestStates(prev => ({
      ...prev,
      [id]: { loading: true }
    }));

    try {
      const res = await api.llmConfigs.testConnectionSaved(id);
      setCardTestStates(prev => ({
        ...prev,
        [id]: {
          loading: false,
          success: res.success,
          error: res.success ? undefined : (res.details || res.message)
        }
      }));
    } catch (err: any) {
      setCardTestStates(prev => ({
        ...prev,
        [id]: {
          loading: false,
          success: false,
          error: err.message || 'Connection test failed'
        }
      }));
    }
  };


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) {
      setError('Model Name is required.');
      return;
    }

    if (provider !== 'ollama' && !apiKey.trim()) {
      setError(`API Key is required for provider ${provider}.`);
      return;
    }

    setFormLoading(true);
    setError(null);

    const payload = {
      provider,
      model_name: modelName.trim(),
      api_key: apiKey.trim() || null,
      is_active: isActive,
    };

    try {
      await api.llmConfigs.create(payload);
      setModelName('');
      setApiKey('');
      setIsActive(false);
      fetchConfigs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    setActionId(id);
    try {
      await api.llmConfigs.activate(id);
      // Toggle active status in local state
      setConfigs((prev) => 
        prev.map((c) => ({
          ...c,
          is_active: c.id === id,
        }))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this AI configuration?')) return;
    setActionId(id);
    try {
      await api.llmConfigs.remove(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold tracking-tight text-white">AI Provider Settings</h1>
        <p className="text-gray-400 mt-1 text-sm">Configure local or cloud LLM models to run job posting analysis and evaluations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Create Config Form */}
        <div className="glass-effect rounded-2xl p-6 border border-gray-800/80 shadow-xl space-y-5 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-gray-900 pb-3">
            <Settings size={18} className="text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">New Configuration</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex gap-2 items-start">
                <AlertCircle className="shrink-0 mt-0.5" size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Provider Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                AI Provider
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as any);
                  if (e.target.value === 'ollama' && !modelName) {
                    setModelName('llama3');
                  }
                }}
                disabled={formLoading}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="ollama">Ollama (Local / Offline)</option>
                <option value="openai">OpenAI (GPT Models)</option>
                <option value="anthropic">Anthropic (Claude Models)</option>
                <option value="openrouter">OpenRouter (Any cloud model)</option>
              </select>
            </div>

            {/* Model Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Model Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Cpu size={15} />
                </div>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder={provider === 'ollama' ? 'llama3' : provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022'}
                  disabled={formLoading}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* API Key */}
            {provider !== 'ollama' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  API Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Key size={15} />
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API credential key"
                    disabled={formLoading}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Active Checkbox */}
            <div className="flex items-center gap-2.5 pt-1.5">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={formLoading}
                className="h-4 w-4 bg-gray-950 border-gray-800 rounded text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
              />
              <label htmlFor="is-active" className="text-sm text-gray-300 font-medium select-none cursor-pointer">
                Set as active configuration
              </label>
            </div>

            {formTestResult && (
              <div className={`p-3 border rounded-xl text-xs flex gap-2 items-start animate-fadeIn ${
                formTestResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                <AlertCircle className="shrink-0 mt-0.5" size={14} />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold">
                    {formTestResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </div>
                  <div className="text-gray-300 select-text leading-relaxed font-mono text-[10px] whitespace-pre-wrap break-all">
                    {formTestResult.success 
                      ? `Model responded: "${formTestResult.message}"` 
                      : formTestResult.details || formTestResult.message}
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={handleTestFormConnection}
                disabled={formLoading || formTestLoading}
                className="py-3 px-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 disabled:opacity-50 text-gray-300 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {formTestLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-indigo-400" />
                    <span className="text-xs">Testing...</span>
                  </>
                ) : (
                  <span className="text-xs">Test Connection</span>
                )}
              </button>

              <button
                type="submit"
                disabled={formLoading || formTestLoading}
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold tracking-wide transition-all shadow-[0_4px_16px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {formLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span className="text-xs">Create Strategy</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Right Side: Configs List */}
        <div className="glass-effect rounded-2xl p-6 border border-gray-800/80 shadow-xl space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-gray-900 pb-3">
            <Sparkles size={18} className="text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Stored Providers</h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <span className="text-gray-400 text-sm">Syncing configurations...</span>
            </div>
          ) : configs.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-400 text-sm">No configurations found. Add a provider on the left to begin.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((cfg) => {
                const cardState = cardTestStates[cfg.id];
                return (
                  <div 
                    key={cfg.id}
                    className={`glass-effect rounded-xl border p-4.5 flex flex-col gap-3.5 transition-all duration-200 ${
                      cfg.is_active 
                        ? 'border-indigo-500/30 bg-indigo-950/10 shadow-[0_0_24px_rgba(99,102,241,0.05)]' 
                        : 'border-gray-800/80 hover:border-gray-700/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="flex items-start gap-4">
                        {/* Badge / Brand color symbol */}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                          cfg.provider === 'openai' 
                            ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400' 
                            : cfg.provider === 'anthropic' 
                              ? 'bg-amber-600/10 border-amber-500/20 text-amber-400' 
                              : cfg.provider === 'openrouter'
                                ? 'bg-violet-600/10 border-violet-500/20 text-violet-400'
                                : 'bg-slate-600/10 border-slate-500/20 text-slate-400'
                        }`}>
                          {cfg.provider}
                        </span>

                        <div>
                          <h3 className="font-semibold text-white text-base leading-tight">
                            {cfg.model_name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                            <Key size={12} />
                            <span>
                              {cfg.api_key ? `••••••••••••${cfg.api_key.slice(-4)}` : 'No API key needed (Local)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Connection Test Action */}
                        <button
                          onClick={() => handleTestCardConnection(cfg.id)}
                          disabled={actionId !== null || cardState?.loading}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1 border ${
                            cardState?.loading
                              ? 'bg-gray-950 border-gray-800 text-gray-400'
                              : cardState?.success
                                ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400'
                                : cardState?.success === false
                                  ? 'bg-rose-600/10 border-rose-500/20 text-rose-400 hover:bg-rose-950/30'
                                  : 'bg-gray-900 border-gray-800 hover:bg-gray-800 text-gray-300'
                          }`}
                          title="Test Connection"
                        >
                          {cardState?.loading ? (
                            <>
                              <Loader2 size={13} className="animate-spin text-indigo-400" />
                              <span>Testing...</span>
                            </>
                          ) : cardState?.success ? (
                            <>
                              <Check size={13} />
                              <span>Connected</span>
                            </>
                          ) : cardState?.success === false ? (
                            <span>Failed (Retry)</span>
                          ) : (
                            <span>Test API</span>
                          )}
                        </button>

                        {/* Status Display / Activate Action */}
                        {cfg.is_active ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg text-xs font-semibold animate-soft-pulse">
                            <Check size={13} strokeWidth={2.5} />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleActivate(cfg.id)}
                            disabled={actionId !== null}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                          >
                            {actionId === cfg.id ? <Loader2 size={13} className="animate-spin" /> : 'Activate'}
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(cfg.id)}
                          disabled={actionId !== null}
                          className="p-2 bg-gray-900/50 hover:bg-rose-950/30 text-gray-500 hover:text-rose-400 rounded-lg border border-gray-800/80 transition-colors cursor-pointer"
                          title="Delete configuration"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Test Error Panel */}
                    {cardState?.success === false && cardState.error && (
                      <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg text-xs text-rose-400/90 flex gap-2 items-start animate-fadeIn select-text">
                        <AlertCircle className="shrink-0 mt-0.5" size={13} />
                        <div className="flex-1">
                          <span className="font-semibold mr-1">Connection Error:</span>
                          <code className="text-[11px] leading-relaxed text-gray-300 font-mono break-all whitespace-pre-wrap">{cardState.error}</code>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
