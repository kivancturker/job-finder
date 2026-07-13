import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db/database'; // Import to run db initialization

import companiesRouter from './routes/companies';
import searchConfigsRouter from './routes/searchConfigs';
import llmConfigsRouter from './routes/llmConfigs';
import jobsRouter from './routes/jobs';
import runSearchRouter from './routes/runSearch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/companies', companiesRouter);
app.use('/api/search_configs', searchConfigsRouter);
app.use('/api/llm_configs', llmConfigsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/run-search', runSearchRouter);

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'DeepTech Job Radar Backend' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Global error handler middleware
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
