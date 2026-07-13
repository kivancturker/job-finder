import { chromium } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import db from '../db/database';
import { CompanyRow, SearchConfigRow, SearchConfig } from '../types';
import { matchKeywords } from './filterEngine';
import { LlmService } from './llmService';

// Helper to check if URL looks like a job details link
function isJobUrl(url: string, text: string): boolean {
  const lowUrl = url.toLowerCase();
  const lowText = text.toLowerCase();

  // Exclude social media and unrelated sharing/navigation links
  if (
    lowUrl.includes('linkedin.com/share') ||
    lowUrl.includes('twitter.com') ||
    lowUrl.includes('facebook.com') ||
    lowUrl.includes('mailto:') ||
    lowUrl.includes('tel:') ||
    lowUrl.includes('javascript:') ||
    lowUrl === '#' ||
    lowUrl.includes('privacy') ||
    lowUrl.includes('cookies') ||
    lowUrl.includes('terms')
  ) {
    return false;
  }

  // Common job platforms to accept
  if (lowUrl.includes('lever.co') || lowUrl.includes('greenhouse.io') || lowUrl.includes('workable.com')) {
    return true;
  }

  // Text indicators (job listing buttons or titles)
  const textKeywords = ['apply', 'view job', 'details', 'position', 'engineer', 'developer', 'manager', 'lead', 'analyst', 'intern', 'architect'];
  const hasTextKeyword = textKeywords.some(kw => lowText.includes(kw));

  // URL path indicators
  const pathKeywords = ['/job', '/jobs', '/careers', '/careers/', '/vacancy', '/openings', '/position'];
  const hasPathKeyword = pathKeywords.some(kw => lowUrl.includes(kw));

  return hasPathKeyword || hasTextKeyword;
}

// Clean raw HTML to extract clean inner text content
function cleanHtmlText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, iframe, noscript, svg').remove();
  const text = $('body').text() || $.text();
  return text.replace(/\s+/g, ' ').trim();
}

// Scrape using Axios + Cheerio
async function scrapeWithCheerio(url: string, targetSelector: string | null): Promise<{ title: string; url: string }[]> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  });

  const $ = cheerio.load(response.data);
  const listings: { title: string; url: string }[] = [];
  const baseUri = new URL(url);

  const anchors = targetSelector 
    ? $(targetSelector).find('a') 
    : $('a');

  anchors.each((_, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().trim();
    if (href) {
      try {
        const absoluteUrl = new URL(href, baseUri.href).href;
        if (isJobUrl(absoluteUrl, text) && text.length > 2) {
          listings.push({
            title: text,
            url: absoluteUrl
          });
        }
      } catch {
        // Ignore parsing errors
      }
    }
  });

  return listings;
}

// Scrape using Playwright (Chromium)
async function scrapeWithPlaywright(url: string, targetSelector: string | null): Promise<{ title: string; url: string }[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    // 30 seconds limit to load the page
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait brief moment for dynamic client-side JS rendering/hydration
    await page.waitForTimeout(2000);
    
    const anchorData = await page.evaluate((selector) => {
      const elements = selector 
        ? Array.from(document.querySelectorAll(selector)).flatMap(el => Array.from(el.querySelectorAll('a')))
        : Array.from(document.querySelectorAll('a'));

      return elements.map(a => ({
        href: a.getAttribute('href'),
        text: a.innerText || a.textContent || ''
      }));
    }, targetSelector);

    const listings: { title: string; url: string }[] = [];
    const baseUri = new URL(url);

    for (const data of anchorData) {
      if (data.href) {
        try {
          const absoluteUrl = new URL(data.href, baseUri.href).href;
          const text = data.text.trim();
          if (isJobUrl(absoluteUrl, text) && text.length > 2) {
            listings.push({
              title: text,
              url: absoluteUrl
            });
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }

    return listings;
  } finally {
    await browser.close();
  }
}

// Fetch clean text of a job details page
async function fetchJobDetails(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    return cleanHtmlText(response.data);
  } catch (err) {
    console.log(`[ScraperService] Cheerio page fetch failed for ${url}. Trying Playwright...`);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      const bodyText = await page.evaluate(() => document.body.innerText || '');
      return bodyText.trim();
    } finally {
      await browser.close();
    }
  }
}

// Main logic to scrape a company and save listings
export async function scrapeCompany(companyId: number, searchConfigId: number): Promise<void> {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as CompanyRow | undefined;
  if (!company) {
    throw new Error(`Company with id ${companyId} not found`);
  }

  // Fetch and parse search config details
  const configRow = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(searchConfigId) as SearchConfigRow | undefined;
  if (!configRow) {
    throw new Error(`Search config with id ${searchConfigId} not found`);
  }
  const searchConfig: SearchConfig = {
    id: configRow.id,
    name: configRow.name,
    keywords: JSON.parse(configRow.keywords),
    negative_keywords: configRow.negative_keywords ? JSON.parse(configRow.negative_keywords) : null,
    min_experience: configRow.min_experience,
    target_countries: configRow.target_countries ? JSON.parse(configRow.target_countries) : null,
    created_at: configRow.created_at
  };

  console.log(`[ScraperService] Starting scrape for ${company.name} (${company.career_url})`);

  let listings: { title: string; url: string }[] = [];

  if (company.scraper_engine === 'cheerio') {
    try {
      listings = await scrapeWithCheerio(company.career_url, company.target_selector);
      console.log(`[ScraperService] Cheerio found ${listings.length} candidate links for ${company.name}`);
      
      // Fallback to Playwright if cheerio returned 0 links (since JS might be required)
      if (listings.length === 0) {
        console.log(`[ScraperService] 0 links found via Cheerio. Running Playwright fallback...`);
        listings = await scrapeWithPlaywright(company.career_url, company.target_selector);
        console.log(`[ScraperService] Playwright fallback found ${listings.length} links for ${company.name}`);
      }
    } catch (err: any) {
      console.warn(`[ScraperService] Cheerio failed: ${err.message}. Retrying with Playwright...`);
      listings = await scrapeWithPlaywright(company.career_url, company.target_selector);
    }
  } else {
    // Forced Playwright
    listings = await scrapeWithPlaywright(company.career_url, company.target_selector);
    console.log(`[ScraperService] Forced Playwright found ${listings.length} links for ${company.name}`);
  }

  // Deduplicate links on the page itself
  const uniqueListingsMap = new Map<string, string>();
  for (const item of listings) {
    uniqueListingsMap.set(item.url, item.title);
  }

  console.log(`[ScraperService] Deduplicated to ${uniqueListingsMap.size} unique candidate links for ${company.name}`);

  // Limit processing to maximum 20 new listings per company run to prevent API/resource exhaustion
  let processedCount = 0;
  const maxNewPostings = 20;

  const checkUrlStmt = db.prepare('SELECT id FROM job_postings WHERE url = ?');
  const insertJobStmt = db.prepare(`
    INSERT INTO job_postings (company_id, search_config_id, title, url, raw_text, is_relevant, ai_parsed, ai_summary, tech_stack, is_visited)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  for (const [url, title] of uniqueListingsMap.entries()) {
    if (processedCount >= maxNewPostings) {
      console.log(`[ScraperService] Reached maximum new postings limit (${maxNewPostings}) for ${company.name}`);
      break;
    }

    // 1. Deduplication check against DB
    const existing = checkUrlStmt.get(url);
    if (existing) {
      // URL exists, skip
      continue;
    }

    try {
      console.log(`[ScraperService] Scraping new job description: ${title} (${url})`);
      
      // 2. Fetch job description
      const rawText = await fetchJobDetails(url);
      
      if (!rawText || rawText.length < 50) {
        console.warn(`[ScraperService] Scraped text is empty or too short for ${url}, skipping`);
        continue;
      }

      // 3. Pre-Filter matching (positive keywords match)
      const passesFilter = matchKeywords(rawText, searchConfig.keywords);
      let isRelevant = 0;
      let aiParsed = 0;
      let aiSummary = null;
      let techStack = null;

      if (!passesFilter) {
        console.log(`[ScraperService] Job "${title}" failed keyword pre-filter. Skipping LLM.`);
        isRelevant = 0;
        aiParsed = 1;
        aiSummary = 'Pre-filtered: Positive keywords did not match';
      } else {
        console.log(`[ScraperService] Job "${title}" passed keyword pre-filter. Evaluating via LLM...`);
        try {
          const aiResult = await LlmService.analyzeJob(rawText, searchConfig, title, company.name);
          if (aiResult) {
            isRelevant = aiResult.is_relevant ? 1 : 0;
            aiParsed = 1;
            aiSummary = aiResult.ai_summary;
            techStack = JSON.stringify(aiResult.tech_stack);
          } else {
            // No active LLM configuration
            isRelevant = 1; // Temporarily mark as relevant since keyword match passed, but pending AI
            aiParsed = 0;
            aiSummary = 'Pending AI review';
          }
        } catch (llmErr: any) {
          console.error(`[ScraperService] LLM evaluation failed: ${llmErr.message}`);
          isRelevant = 1;
          aiParsed = 0;
          aiSummary = `Failed LLM analysis: ${llmErr.message}`;
        }
      }

      // 4. Insert into DB
      insertJobStmt.run(
        company.id, 
        searchConfigId, 
        title, 
        url, 
        rawText, 
        isRelevant, 
        aiParsed, 
        aiSummary, 
        techStack
      );
      processedCount++;

      // Be gentle, sleep briefly (e.g. 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err: any) {
      console.error(`[ScraperService] Failed to process job details for ${url}:`, err.message);
    }
  }

  console.log(`[ScraperService] Finished scrape for ${company.name}. Added ${processedCount} new job posting(s).`);
}
