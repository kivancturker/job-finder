import mockServer from './test_scraper_server';
import db from '../src/db/database';
import { ApiResponse } from '../src/types';

const API_BASE_URL = 'http://localhost:3001/api';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runQueueTests() {
  console.log('🚀 Starting Scraper Engine & Queue Integration Tests...');

  try {
    // 1. Create a search configuration to trigger search against
    const configRes = await fetch(`${API_BASE_URL}/search_configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Systems Internal Eng',
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
    // StaticTech (Cheerio)
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
    if (!company1Res.ok || !co1Data.success) {
      throw new Error(`Failed to create StaticTech: ${co1Data.error}`);
    }
    const company1 = co1Data.data;
    console.log('✅ Created company StaticTech (Cheerio):', company1);

    // DynoTech (Playwright fallback - we config it as Cheerio to test fallback, or forced Playwright)
    const company2Res = await fetch(`${API_BASE_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'DynoTech Inc',
        career_url: 'http://localhost:4000/careers-dynamic',
        scraper_engine: 'cheerio' // Will return 0 links via cheerio, triggering playwright fallback!
      })
    });
    const co2Data = (await company2Res.json()) as ApiResponse<any>;
    if (!company2Res.ok || !co2Data.success) {
      throw new Error(`Failed to create DynoTech: ${co2Data.error}`);
    }
    const company2 = co2Data.data;
    console.log('✅ Created company DynoTech (Cheerio fallback to Playwright):', company2);

    // 3. Trigger /api/run-search
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
    console.log('✅ /api/run-search responded with tasks:', runData.data.tasks);

    // 4. Poll queue state until all completed
    console.log('\n--- Monitoring Queue Progress (Sequential Execution) ---');
    let allFinished = false;
    let attempts = 0;
    while (!allFinished && attempts < 30) {
      await delay(2000);
      const queueRes = await fetch(`${API_BASE_URL}/run-search/queue`);
      const queueData = (await queueRes.json()) as ApiResponse<any>;
      if (!queueRes.ok || !queueData.success) {
        throw new Error('Failed to fetch queue state');
      }

      const tasks = queueData.data.tasks;
      console.log(`Polling queue (attempt ${attempts + 1}):`);
      for (const t of tasks) {
        console.log(`  - Task [${t.id}] for ${t.companyName}: status=${t.status}`);
      }

      const activeOrPending = tasks.some((t: any) => t.status === 'pending' || t.status === 'processing');
      if (!activeOrPending && tasks.length > 0) {
        allFinished = true;
      }
      attempts++;
    }

    if (!allFinished) {
      throw new Error('Timeout waiting for scraping queue tasks to complete.');
    }

    // 5. Verify database contents
    console.log('\n--- Verifying Scraped Job Postings in DB ---');
    const jobPostings = db.prepare('SELECT * FROM job_postings').all() as any[];
    console.log(`Found ${jobPostings.length} job postings in database:`);
    for (const job of jobPostings) {
      console.log(`  - Title: "${job.title}"`);
      console.log(`    URL: ${job.url}`);
      console.log(`    Raw Text Length: ${job.raw_text?.length} chars`);
      console.log(`    Preview: "${job.raw_text?.substring(0, 100)}..."`);
    }

    // Assert that we found the 4 expected jobs:
    // 2 from StaticTech (Systems Engineer, Database Developer)
    // 2 from DynoTech (Storage Expert, Database Intern)
    const titles = jobPostings.map(j => j.title.toLowerCase());
    const expectedTitles = ['systems engineer', 'database developer', 'storage expert', 'database intern'];
    for (const title of expectedTitles) {
      const match = titles.some(t => t.includes(title));
      if (!match) {
        throw new Error(`Assert failed: Expected job title containing "${title}" was not found!`);
      }
    }
    console.log('✅ All expected job postings scraped and saved successfully!');

    // 6. Test Deduplication Check
    console.log('\n--- Testing URL Deduplication ---');
    const dbCountBefore = db.prepare('SELECT COUNT(*) as count FROM job_postings').get() as { count: number };
    
    console.log('Triggering run-search again...');
    const rerunRes = await fetch(`${API_BASE_URL}/run-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_config_id: searchConfigId })
    });
    if (!rerunRes.ok) throw new Error('Failed to trigger rerun');

    // Wait for queue processing to complete
    console.log('Waiting for rerun queue to finish...');
    allFinished = false;
    attempts = 0;
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

    const dbCountAfter = db.prepare('SELECT COUNT(*) as count FROM job_postings').get() as { count: number };
    console.log(`Job postings count before rerun: ${dbCountBefore.count}`);
    console.log(`Job postings count after rerun:  ${dbCountAfter.count}`);
    
    if (dbCountBefore.count !== dbCountAfter.count) {
      throw new Error('Deduplication failed! New rows were added for identical job URLs.');
    }
    console.log('✅ Deduplication check verified! No duplicates inserted.');

    // 7. Cleanup
    console.log('\n--- Cleaning Up Resources ---');
    db.prepare('DELETE FROM job_postings').run();
    db.prepare('DELETE FROM companies WHERE id IN (?, ?)').run(company1.id, company2.id);
    db.prepare('DELETE FROM search_configs WHERE id = ?').run(searchConfigId);
    console.log('✅ SQLite database cleared.');

    console.log('\n🎉 ALL SCRAPER & QUEUE TESTS PASSED! 🎉');
  } catch (error: any) {
    console.error('❌ Scraper/Queue Integration Test Failed:', error.message);
    process.exit(1);
  } finally {
    mockServer.close(() => {
      console.log('Closed mock scraper server.');
      process.exit(0);
    });
  }
}

runQueueTests();
