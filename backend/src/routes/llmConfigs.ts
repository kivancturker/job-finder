import { Router, Request, Response } from 'express';
import db from '../db/database';
import { LLMConfigRow, ApiResponse, LLMConfig } from '../types';
import { mapLLMConfig } from '../mappers';
import { validateLlmProvider } from '../utils/validators';

const router = Router();

// Transaction to activate one configuration and deactivate all others
const activateConfigTransaction = db.transaction((id: number | string) => {
  db.prepare('UPDATE llm_configs SET is_active = 0').run();
  db.prepare('UPDATE llm_configs SET is_active = 1 WHERE id = ?').run(id);
});

// Transaction to atomically create configuration and optional activation
const createConfigTransaction = db.transaction((provider: string, model_name: string, api_key: string | null, activeInt: number) => {
  const result = db.prepare(
    'INSERT INTO llm_configs (provider, model_name, api_key, is_active) VALUES (?, ?, ?, 0)'
  ).run(provider, model_name, api_key);
  const newId = Number(result.lastInsertRowid);
  if (activeInt === 1) {
    db.prepare('UPDATE llm_configs SET is_active = 0').run();
    db.prepare('UPDATE llm_configs SET is_active = 1 WHERE id = ?').run(newId);
  }
  return newId;
});

// Transaction to atomically update configuration and optional activation
const updateConfigTransaction = db.transaction((provider: string, model_name: string, api_key: string | null, activeInt: number, id: number | string) => {
  db.prepare(
    'UPDATE llm_configs SET provider = ?, model_name = ?, api_key = ?, is_active = 0 WHERE id = ?'
  ).run(provider, model_name, api_key, id);
  if (activeInt === 1) {
    db.prepare('UPDATE llm_configs SET is_active = 0').run();
    db.prepare('UPDATE llm_configs SET is_active = 1 WHERE id = ?').run(id);
  }
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

    try {
      validateLlmProvider(provider);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const activeInt = is_active ? 1 : 0;

    const newId = createConfigTransaction(provider, model_name, api_key || null, activeInt);

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

    try {
      validateLlmProvider(provider);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const activeInt = is_active ? 1 : 0;

    updateConfigTransaction(provider, model_name, api_key || null, activeInt, id);

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
