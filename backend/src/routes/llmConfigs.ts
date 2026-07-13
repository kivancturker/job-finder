import { Router, Request, Response } from 'express';
import db from '../db/database';
import { LLMConfigRow, ApiResponse, LLMConfig } from '../types';

const router = Router();

// Helper to map DB row to API model
const mapLLMConfig = (row: LLMConfigRow): LLMConfig => ({
  id: row.id,
  provider: row.provider,
  model_name: row.model_name,
  api_key: row.api_key,
  is_active: Boolean(row.is_active)
});

// Transaction to activate one configuration and deactivate all others
const activateConfigTransaction = db.transaction((id: number | string) => {
  db.prepare('UPDATE llm_configs SET is_active = 0').run();
  db.prepare('UPDATE llm_configs SET is_active = 1 WHERE id = ?').run(id);
});

// GET /api/llm_configs - Get all configurations
router.get('/', (req: Request, res: Response<ApiResponse<LLMConfig[]>>) => {
  try {
    const rows = db.prepare('SELECT * FROM llm_configs ORDER BY id DESC').all() as LLMConfigRow[];
    res.json({ success: true, data: rows.map(mapLLMConfig) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/llm_configs/active - Get the currently active configuration
router.get('/active', (req: Request, res: Response<ApiResponse<LLMConfig | null>>) => {
  try {
    const row = db.prepare('SELECT * FROM llm_configs WHERE is_active = 1 LIMIT 1').get() as LLMConfigRow | undefined;
    res.json({ success: true, data: row ? mapLLMConfig(row) : null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/llm_configs - Create a configuration
router.post('/', (req: Request, res: Response<ApiResponse<LLMConfig>>) => {
  try {
    const { provider, model_name, api_key, is_active } = req.body;

    if (!provider || !model_name) {
      return res.status(400).json({ success: false, error: 'Provider and model_name are required' });
    }

    if (provider !== 'ollama' && provider !== 'openai' && provider !== 'anthropic') {
      return res.status(400).json({ success: false, error: "Provider must be 'ollama', 'openai', or 'anthropic'" });
    }

    const activeInt = is_active ? 1 : 0;

    const stmt = db.prepare(
      'INSERT INTO llm_configs (provider, model_name, api_key, is_active) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(provider, model_name, api_key || null, activeInt);
    const newId = result.lastInsertRowid;

    if (activeInt === 1) {
      activateConfigTransaction(newId);
    }

    const newRow = db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(newId) as LLMConfigRow;
    res.status(201).json({ success: true, data: mapLLMConfig(newRow) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/llm_configs/:id - Update a configuration
router.put('/:id', (req: Request, res: Response<ApiResponse<LLMConfig>>) => {
  try {
    const { provider, model_name, api_key, is_active } = req.body;
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(id) as LLMConfigRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'LLM Configuration not found' });
    }

    if (!provider || !model_name) {
      return res.status(400).json({ success: false, error: 'Provider and model_name are required' });
    }

    if (provider !== 'ollama' && provider !== 'openai' && provider !== 'anthropic') {
      return res.status(400).json({ success: false, error: "Provider must be 'ollama', 'openai', or 'anthropic'" });
    }

    const activeInt = is_active ? 1 : 0;

    const stmt = db.prepare(
      'UPDATE llm_configs SET provider = ?, model_name = ?, api_key = ?, is_active = ? WHERE id = ?'
    );
    stmt.run(provider, model_name, api_key || null, activeInt, id);

    if (activeInt === 1) {
      activateConfigTransaction(id);
    }

    const updatedRow = db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(id) as LLMConfigRow;
    res.json({ success: true, data: mapLLMConfig(updatedRow) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/llm_configs/:id/activate - Manually activate a configuration
router.post('/:id/activate', (req: Request, res: Response<ApiResponse<LLMConfig>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(id) as LLMConfigRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'LLM Configuration not found' });
    }

    activateConfigTransaction(id);

    const updatedRow = db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(id) as LLMConfigRow;
    res.json({ success: true, data: mapLLMConfig(updatedRow) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/llm_configs/:id - Delete a configuration
router.delete('/:id', (req: Request, res: Response<ApiResponse<{ id: number }>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM llm_configs WHERE id = ?').get(id) as LLMConfigRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'LLM Configuration not found' });
    }

    db.prepare('DELETE FROM llm_configs WHERE id = ?').run(id);
    res.json({ success: true, data: { id: Number(id) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
