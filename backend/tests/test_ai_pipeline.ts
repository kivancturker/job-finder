import express from 'express';
import mockScraperServer from './test_scraper_server';
import db from '../src/db/database';
import { ApiResponse } from '../src/types';

const API_BASE_URL = 'http://localhost:3001/api';

// Create a local mock LLM server (representing Ollama chat endpoint)
const mockLlmApp = express();
mockLlmApp.use(express.json());

mockLlmApp.post('/api/chat', (req, res) => {
  const { messages } = req.body;
  const userMessage = messages.find((m: any) => m.role === 'user')?.content || '';
  
  console.log(`[MockLLM] Received analysis request.`);

  let content = '';

  if (userMessage.includes('Systems Engineer')) {
    content = JSON.stringify({
      is_relevant: true,
      ai_summary: 'C++ database systems engineering role.',
      tech_stack: ['C++', 'SQLite'],
      min_experience: 3
    });
  } else if (userMessage.includes('Database Developer')) {
    content = JSON.stringify({
      is_relevant: true,
      ai_summary: 'Database internals development using SQL and Raft.',
      tech_stack: ['SQL', 'Raft'],
      min_experience: 4
    });
  } else if (userMessage.includes('Storage Expert')) {
    content = JSON.stringify({
      is_relevant: true,
      ai_summary: 'Distributed systems storage formats using Paxos.',
      tech_stack: ['C++', 'Paxos'],
      min_experience: 6
    });
  } else if (userMessage.includes('Database Intern')) {
    content = JSON.stringify({
      is_relevant: true,
      ai_summary: 'Internship focusing on systems programming and SQLite optimization.',
      tech_stack: ['C++', 'SQLite', 'Git'],
      min_experience: 0
    });
  } else {
    // Default fallback
    content = JSON.stringify({
      is_relevant: false,
      ai_summary: 'Unmatched job details.',
      tech_stack: [],
      min_experience: 0
    });
  }

  res.json({
    message: {
      role: 'assistant',
      content: content
    }
  });
});

const mockLlmServer = mockLlmApp.listen(5001, () => {
  console.log('Mock LLM Server running at http://localhost:5001');
});

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAIPipelineTests() {
  console.log('\n🚀 Starting AI Evaluation Pipeline Integration Tests...');

  try {
    // Clear out any stale data before starting
    db.prepare('DELETE FROM job_postings').run();
    db.prepare('DELETE FROM companies').run();
    db.prepare('DELETE FROM search_configs').run();

    // 1. Create a search configuration to trigger search against
    const configRes = await fetch(`${API_BASE_URL}/search_configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Systems AI Search',
        keywords: ['C++', 'SQLite', 'Raft', 'Paxos'],
        negative_keywords: ['Frontend'],
        min_experience: 2,
        target_countries: ['Remote']
      })
    });
    const configData = (await configRes.json()) as ApiResponse<any>;
    if (!configRes.ok || !configData.success) {
      throw new Error(`Failed to create search config: ${configData.error}`);
    }
    const searchConfigId = configData.data.id;
    console.log(`✅ Created test search config (ID: ${searchConfigId})`);

    // 2. Create mock companies
    const company1Res = await fetch(`${API_BASE_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'StaticTech Inc',
        career_url: 'http://localhost:4000/careers-static',
        scraper_engine: 'cheerio'
      })
    });
    const co1Data = (await company1Res.json()) as ApiResponse<any>;
    const company1 = co1Data.data;
    console.log('✅ Created StaticTech:', company1);

    const company2Res = await fetch(`${API_BASE_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'DynoTech Inc',
        career_url: 'http://localhost:4000/careers-dynamic',
        scraper_engine: 'cheerio'
      })
    });
    const co2Data = (await company2Res.json()) as ApiResponse<any>;
    const company2 = co2Data.data;
    console.log('✅ Created DynoTech (fallback to Playwright):', company2);

    // 3. Create active LLM configuration mapping to mock server (port 5000)
    const llmRes = await fetch(`${API_BASE_URL}/llm_configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'ollama',
        model_name: 'llama3',
        api_key: 'http://localhost:5001', // Our mock LLM server URL
        is_active: true
      })
    });
    const llmData = (await llmRes.json()) as ApiResponse<any>;
    if (!llmRes.ok || !llmData.success) {
      throw new Error(`Failed to create LLM config: ${llmData.error}`);
    }
    const llmConfigId = llmData.data.id;
    console.log(`✅ Created Active LLM Config pointing to Mock LLM Server (ID: ${llmConfigId})`);

    // 4. Trigger run search
    console.log('\n--- Triggering Run Search ---');
    const runRes = await fetch(`${API_BASE_URL}/run-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_config_id: searchConfigId })
    });
    const runData = (await runRes.json()) as ApiResponse<any>;
    if (!runRes.ok || !runData.success) {
      throw new Error(`Failed to run search: ${runData.error}`);
    }

    // 5. Poll queue state until all completed
    console.log('\n--- Monitoring Queue Progress ---');
    let allFinished = false;
    let attempts = 0;
    while (!allFinished && attempts < 30) {
      await delay(2000);
      const queueRes = await fetch(`${API_BASE_URL}/run-search/queue`);
      const queueData = (await queueRes.json()) as ApiResponse<any>;
      const tasks = queueData.data.tasks;
      const activeOrPending = tasks.some((t: any) => t.status === 'pending' || t.status === 'processing');
      if (!activeOrPending && tasks.length > 0) {
        allFinished = true;
      }
      attempts++;
    }

    if (!allFinished) {
      throw new Error('Timeout waiting for scraping queue tasks to complete.');
    }

    // 6. Verify database contents (pre-filter and LLM evaluations)
    console.log('\n--- Verifying Database Evaluations ---');
    const jobPostings = db.prepare('SELECT * FROM job_postings').all() as any[];
    console.log(`Found ${jobPostings.length} job postings in SQLite:`);
    
    let preFilteredCount = 0;
    let llmParsedCount = 0;

    for (const job of jobPostings) {
      console.log(`\nJob Posting Details:`);
      console.log(`  - Title: "${job.title}"`);
      console.log(`  - URL: ${job.url}`);
      console.log(`  - is_relevant: ${job.is_relevant} (represented as ${Boolean(job.is_relevant)})`);
      console.log(`  - ai_parsed: ${job.ai_parsed}`);
      console.log(`  - ai_summary: "${job.ai_summary}"`);
      console.log(`  - tech_stack: "${job.tech_stack}"`);

      if (job.title.includes('React Developer')) {
        // Assert: React Dev failed pre-filter
        if (job.is_relevant !== 0 || job.ai_parsed !== 1 || !job.ai_summary.includes('Pre-filtered')) {
          throw new Error('Assert failed: React Developer should have been bypassed/pre-filtered!');
        }
        preFilteredCount++;
        console.log('  👉 Verified: React Developer bypassed the LLM (Pre-filtered correctly)');
      } else {
        // Assert: Other jobs passed pre-filter and evaluated by LLM
        if (job.is_relevant !== 1 || job.ai_parsed !== 1 || !job.tech_stack) {
          throw new Error(`Assert failed: Job "${job.title}" was not evaluated correctly by LLM!`);
        }
        llmParsedCount++;
        console.log('  👉 Verified: Evaluated correctly by the Mock LLM');
      }
    }

    if (preFilteredCount !== 1 || llmParsedCount !== 4) {
      throw new Error(`Assert failed: Expected 1 pre-filtered and 4 LLM-parsed jobs. Got: ${preFilteredCount} and ${llmParsedCount}`);
    }
    console.log('\n✅ SQLite database verification passed! Pre-filters and LLM updates are correct.');

    // 7. Test the individual POST /api/jobs/:id/evaluate endpoint
    console.log('\n--- Testing Individual Job Re-evaluation Endpoint ---');
    const firstLlmJob = jobPostings.find(j => !j.title.includes('React Developer'));
    
    // Clear out LLM fields for this job to simulate a pending/re-evaluation state
    db.prepare('UPDATE job_postings SET is_relevant = 0, ai_parsed = 0, ai_summary = NULL, tech_stack = NULL WHERE id = ?').run(firstLlmJob.id);
    
    // Call the endpoint
    const evaluateRes = await fetch(`${API_BASE_URL}/jobs/${firstLlmJob.id}/evaluate`, {
      method: 'POST'
    });
    const evaluateData = (await evaluateRes.json()) as ApiResponse<any>;
    if (!evaluateRes.ok || !evaluateData.success) {
      throw new Error(`POST /api/jobs/:id/evaluate failed: ${evaluateData.error}`);
    }

    const reEvaluatedJob = evaluateData.data;
    console.log('✅ Endpoint returned re-evaluated job:', reEvaluatedJob);
    if (!reEvaluatedJob.ai_parsed || !reEvaluatedJob.is_relevant || !reEvaluatedJob.tech_stack) {
      throw new Error('Assert failed: Re-evaluation endpoint did not update LLM parsed data fields!');
    }
    console.log('✅ Re-evaluation endpoint verified successfully!');

    // 8. Cleanup
    console.log('\n--- Cleaning Up Resources ---');
    db.prepare('DELETE FROM job_postings').run();
    db.prepare('DELETE FROM companies WHERE id IN (?, ?)').run(company1.id, company2.id);
    db.prepare('DELETE FROM search_configs WHERE id = ?').run(searchConfigId);
    db.prepare('DELETE FROM llm_configs WHERE id = ?').run(llmConfigId);
    console.log('✅ SQLite database cleared.');

    console.log('\n🎉 ALL PIPELINE TESTS PASSED! 🎉');
  } catch (error: any) {
    console.error('❌ AI Pipeline Integration Test Failed:', error.message);
    process.exit(1);
  } finally {
    mockScraperServer.close(() => {
      mockLlmServer.close(() => {
        console.log('Closed mock scraper and LLM servers.');
        process.exit(0);
      });
    });
  }
}

runAIPipelineTests();
