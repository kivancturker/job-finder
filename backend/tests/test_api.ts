import { ApiResponse } from '../src/types';
import db from '../src/db/database';

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('🚀 Starting API Integration Tests...');

  try {
    // Clear out any stale data before starting
    db.prepare('DELETE FROM job_postings').run();
    db.prepare('DELETE FROM companies').run();
    db.prepare('DELETE FROM search_configs').run();
    db.prepare('DELETE FROM llm_configs').run();
    // 1. Test Companies CRUD
    console.log('\n--- Testing Companies ---');
    
    // Create Company
    const createCoRes = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Tech Inc',
        career_url: 'https://example.com/careers',
        scraper_engine: 'cheerio',
        target_selector: '.job-card'
      })
    });
    const coData = (await createCoRes.json()) as ApiResponse<any>;
    if (!createCoRes.ok || !coData.success) {
      throw new Error(`Failed to create company: ${coData.error}`);
    }
    const createdCo = coData.data;
    console.log('✅ Created company:', createdCo);

    // List Companies
    const listCoRes = await fetch(`${BASE_URL}/companies`);
    const listCoData = (await listCoRes.json()) as ApiResponse<any[]>;
    if (!listCoRes.ok || !listCoData.success || !listCoData.data?.length) {
      throw new Error(`Failed to list companies: ${listCoData.error}`);
    }
    console.log(`✅ Listed companies: Found ${listCoData.data.length} company(s)`);

    // Get Company
    const getCoRes = await fetch(`${BASE_URL}/companies/${createdCo.id}`);
    const getCoData = (await getCoRes.json()) as ApiResponse<any>;
    if (!getCoRes.ok || !getCoData.success) {
      throw new Error(`Failed to get company: ${getCoData.error}`);
    }
    console.log('✅ Retrieved company:', getCoData.data);

    // Update Company
    const updateCoRes = await fetch(`${BASE_URL}/companies/${createdCo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Tech Inc (Updated)',
        career_url: 'https://example.com/careers-new',
        scraper_engine: 'playwright',
        target_selector: '.job-card-new'
      })
    });
    const updateCoData = (await updateCoRes.json()) as ApiResponse<any>;
    if (!updateCoRes.ok || !updateCoData.success) {
      throw new Error(`Failed to update company: ${updateCoData.error}`);
    }
    console.log('✅ Updated company:', updateCoData.data);

    // 2. Test Search Configs CRUD
    console.log('\n--- Testing Search Configs ---');

    // Create Search Config
    const createSearchRes = await fetch(`${BASE_URL}/search_configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Database Architect',
        keywords: ['C++', 'SQLite', 'Raft'],
        negative_keywords: ['Frontend', 'React'],
        min_experience: 5,
        target_countries: ['Remote', 'Germany']
      })
    });
    const searchData = (await createSearchRes.json()) as ApiResponse<any>;
    if (!createSearchRes.ok || !searchData.success) {
      throw new Error(`Failed to create search config: ${searchData.error}`);
    }
    const createdSearch = searchData.data;
    console.log('✅ Created search config:', createdSearch);

    // List Search Configs
    const listSearchRes = await fetch(`${BASE_URL}/search_configs`);
    const listSearchData = (await listSearchRes.json()) as ApiResponse<any[]>;
    if (!listSearchRes.ok || !listSearchData.success || !listSearchData.data?.length) {
      throw new Error(`Failed to list search configs: ${listSearchData.error}`);
    }
    console.log(`✅ Listed search configs: Found ${listSearchData.data.length} config(s)`);

    // Get Search Config
    const getSearchRes = await fetch(`${BASE_URL}/search_configs/${createdSearch.id}`);
    const getSearchData = (await getSearchRes.json()) as ApiResponse<any>;
    if (!getSearchRes.ok || !getSearchData.success) {
      throw new Error(`Failed to get search config: ${getSearchData.error}`);
    }
    console.log('✅ Retrieved search config:', getSearchData.data);

    // Update Search Config
    const updateSearchRes = await fetch(`${BASE_URL}/search_configs/${createdSearch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Database Architect (Senior)',
        keywords: ['C++', 'SQLite', 'Paxos', 'Raft'],
        negative_keywords: ['Frontend', 'CSS'],
        min_experience: 8,
        target_countries: ['Remote']
      })
    });
    const updateSearchData = (await updateSearchRes.json()) as ApiResponse<any>;
    if (!updateSearchRes.ok || !updateSearchData.success) {
      throw new Error(`Failed to update search config: ${updateSearchData.error}`);
    }
    console.log('✅ Updated search config:', updateSearchData.data);

    // Test GET /api/search_configs/:id/jobs endpoint (should return empty array for now)
    const getJobsRes = await fetch(`${BASE_URL}/search_configs/${createdSearch.id}/jobs`);
    const getJobsData = (await getJobsRes.json()) as ApiResponse<any[]>;
    if (!getJobsRes.ok || !getJobsData.success) {
      throw new Error(`Failed to get jobs for search config: ${getJobsData.error}`);
    }
    console.log('✅ Retrieved jobs for search config (empty expected):', getJobsData.data);

    // 3. Test LLM Configs CRUD and Mutual Exclusion (Activation)
    console.log('\n--- Testing LLM Configs ---');

    // Create LLM Config 1 (Inactive)
    const createLlm1Res = await fetch(`${BASE_URL}/llm_configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'ollama',
        model_name: 'llama3',
        api_key: null,
        is_active: false
      })
    });
    const llm1Data = (await createLlm1Res.json()) as ApiResponse<any>;
    if (!createLlm1Res.ok || !llm1Data.success) {
      throw new Error(`Failed to create LLM config 1: ${llm1Data.error}`);
    }
    const llm1 = llm1Data.data;
    console.log('✅ Created LLM Config 1 (Ollama, Inactive):', llm1);

    // Create LLM Config 2 (Active)
    const createLlm2Res = await fetch(`${BASE_URL}/llm_configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        model_name: 'gpt-4o',
        api_key: 'sk-test12345',
        is_active: true
      })
    });
    const llm2Data = (await createLlm2Res.json()) as ApiResponse<any>;
    if (!createLlm2Res.ok || !llm2Data.success) {
      throw new Error(`Failed to create LLM config 2: ${llm2Data.error}`);
    }
    const llm2 = llm2Data.data;
    console.log('✅ Created LLM Config 2 (OpenAI, Active):', llm2);

    // Get Active Config (should be Config 2)
    const getActive1Res = await fetch(`${BASE_URL}/llm_configs/active`);
    const getActive1Data = (await getActive1Res.json()) as ApiResponse<any>;
    if (!getActive1Res.ok || !getActive1Data.success || !getActive1Data.data || getActive1Data.data.id !== llm2.id) {
      throw new Error(`Active config mismatch. Expected config 2. Got: ${JSON.stringify(getActive1Data.data)}`);
    }
    console.log('✅ Active config verified as Config 2:', getActive1Data.data);

    // Activate LLM Config 1 (Ollama)
    const activate1Res = await fetch(`${BASE_URL}/llm_configs/${llm1.id}/activate`, {
      method: 'POST'
    });
    const activate1Data = (await activate1Res.json()) as ApiResponse<any>;
    if (!activate1Res.ok || !activate1Data.success) {
      throw new Error(`Failed to activate config 1: ${activate1Data.error}`);
    }
    console.log('✅ Activated LLM Config 1');

    // Get Active Config (should now be Config 1)
    const getActive2Res = await fetch(`${BASE_URL}/llm_configs/active`);
    const getActive2Data = (await getActive2Res.json()) as ApiResponse<any>;
    if (!getActive2Res.ok || !getActive2Data.success || !getActive2Data.data || getActive2Data.data.id !== llm1.id) {
      throw new Error(`Active config mismatch. Expected config 1. Got: ${JSON.stringify(getActive2Data.data)}`);
    }
    console.log('✅ Active config verified as Config 1:', getActive2Data.data);

    // Cleanup Tests - Delete Created Resources
    console.log('\n--- Cleaning Up Resources ---');
    
    // Delete Company
    const delCoRes = await fetch(`${BASE_URL}/companies/${createdCo.id}`, { method: 'DELETE' });
    if (!delCoRes.ok) throw new Error('Failed to delete company');
    console.log('✅ Deleted company');

    // Delete Search Config
    const delSearchRes = await fetch(`${BASE_URL}/search_configs/${createdSearch.id}`, { method: 'DELETE' });
    if (!delSearchRes.ok) throw new Error('Failed to delete search config');
    console.log('✅ Deleted search config');

    // Delete LLM Configs
    const delLlm1Res = await fetch(`${BASE_URL}/llm_configs/${llm1.id}`, { method: 'DELETE' });
    const delLlm2Res = await fetch(`${BASE_URL}/llm_configs/${llm2.id}`, { method: 'DELETE' });
    if (!delLlm1Res.ok || !delLlm2Res.ok) throw new Error('Failed to delete LLM configs');
    console.log('✅ Deleted LLM configs');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error: any) {
    console.error('❌ Integration test failed:', error.message);
    process.exit(1);
  }
}

runTests();
