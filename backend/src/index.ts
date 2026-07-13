import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db/database'; // Import to run db initialization

import companiesRouter from './routes/companies';
import searchConfigsRouter from './routes/searchConfigs';
import llmConfigsRouter from './routes/llmConfigs';
import jobsRouter from './routes/jobs';

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

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'DeepTech Job Radar Backend' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
