import { chromium } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import db from '../db/database';
import { CompanyRow, SearchConfigRow, SearchConfig } from '../types';
import { mapSearchConfig } from '../mappers';
import { USER_AGENT, MAX_NEW_POSTINGS_PER_RUN, SCRAPE_DELAY_MS } from '../constants';
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
      'User-Agent': USER_AGENT
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
      'User-Agent': USER_AGENT
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
        'User-Agent': USER_AGENT
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
// Main logic to scrape a company and save listings
export async function scrapeCompany(
  companyId: number, 
  searchConfigId: number, 
  onLog?: (msg: string) => void
): Promise<void> {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as CompanyRow | undefined;
  if (!company) {
    throw new Error(`Company with id ${companyId} not found`);
  }

  // Fetch and parse search config details
  const configRow = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(searchConfigId) as SearchConfigRow | undefined;
  if (!configRow) {
    throw new Error(`Search config with id ${searchConfigId} not found`);
  }
  const searchConfig = mapSearchConfig(configRow);

  const log = (msg: string) => {
    console.log(msg);
    if (onLog) {
      onLog(msg);
    }
  };

  const logWarn = (msg: string) => {
    console.warn(msg);
    if (onLog) {
      onLog(`[WARN] ${msg}`);
    }
  };

  const logError = (msg: string) => {
    console.error(msg);
    if (onLog) {
      onLog(`[ERROR] ${msg}`);
    }
  };

  log(`Starting scrape for ${company.name} (${company.career_url})`);

  let listings: { title: string; url: string }[] = [];

  if (company.scraper_engine === 'cheerio') {
    try {
      listings = await scrapeWithCheerio(company.career_url, company.target_selector);
      log(`Cheerio found ${listings.length} candidate links for ${company.name}`);
      
      // Fallback to Playwright if cheerio returned 0 links (since JS might be required)
      if (listings.length === 0) {
        log(`0 links found via Cheerio. Running Playwright fallback...`);
        listings = await scrapeWithPlaywright(company.career_url, company.target_selector);
        log(`Playwright fallback found ${listings.length} links for ${company.name}`);
      }
    } catch (err: any) {
      logWarn(`Cheerio failed: ${err.message}. Retrying with Playwright...`);
      listings = await scrapeWithPlaywright(company.career_url, company.target_selector);
    }
  } else {
    // Forced Playwright
    listings = await scrapeWithPlaywright(company.career_url, company.target_selector);
    log(`Forced Playwright found ${listings.length} links for ${company.name}`);
  }

  // Deduplicate links on the page itself
  const uniqueListingsMap = new Map<string, string>();
  for (const item of listings) {
    uniqueListingsMap.set(item.url, item.title);
  }

  log(`Deduplicated to ${uniqueListingsMap.size} unique candidate links for ${company.name}`);

  // Limit processing to maximum postings limit per company run to prevent API/resource exhaustion
  let processedCount = 0;
  const maxNewPostings = MAX_NEW_POSTINGS_PER_RUN;

  const checkUrlStmt = db.prepare('SELECT id FROM job_postings WHERE url = ?');
  const insertJobStmt = db.prepare(`
    INSERT INTO job_postings (company_id, search_config_id, title, url, raw_text, is_relevant, ai_parsed, ai_summary, tech_stack, is_visited)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  for (const [url, title] of uniqueListingsMap.entries()) {
    if (processedCount >= maxNewPostings) {
      log(`Reached maximum new postings limit (${maxNewPostings}) for ${company.name}`);
      break;
    }

    // 1. Deduplication check against DB
    const existing = checkUrlStmt.get(url);
    if (existing) {
      // URL exists, skip
      continue;
    }

    try {
      log(`Scraping new job description: ${title} (${url})`);
      
      // 2. Fetch job description
      const rawText = await fetchJobDetails(url);
      
      if (!rawText || rawText.length < 50) {
        logWarn(`Scraped text is empty or too short for ${url}, skipping`);
        continue;
      }

      // 3. Pre-Filter matching (positive keywords match)
      const passesFilter = matchKeywords(rawText, searchConfig.keywords);
      let isRelevant = 0;
      let aiParsed = 0;
      let aiSummary = null;
      let techStack = null;

      if (!passesFilter) {
        log(`Job "${title}" failed keyword pre-filter. Skipping LLM.`);
        isRelevant = 0;
        aiParsed = 1;
        aiSummary = 'Pre-filtered: Positive keywords did not match';
      } else {
        log(`Job "${title}" passed keyword pre-filter. Evaluating via LLM...`);
        try {
          const aiResult = await LlmService.analyzeJob(rawText, searchConfig, title, company.name);
          if (aiResult) {
            isRelevant = aiResult.is_relevant ? 1 : 0;
            aiParsed = 1;
            aiSummary = aiResult.ai_summary;
            techStack = JSON.stringify(aiResult.tech_stack);
            log(`LLM analysis complete for "${title}". Fit: ${aiResult.is_relevant ? 'RELEVANT' : 'IRRELEVANT'}`);
          } else {
            // No active LLM configuration
            isRelevant = 1; // Temporarily mark as relevant since keyword match passed, but pending AI
            aiParsed = 0;
            aiSummary = 'Pending AI review';
            logWarn(`No active LLM config. Job "${title}" marked as pending AI review.`);
          }
        } catch (llmErr: any) {
          logError(`LLM evaluation failed: ${llmErr.message}`);
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
      await new Promise(resolve => setTimeout(resolve, SCRAPE_DELAY_MS));
    } catch (err: any) {
      logError(`Failed to process job details for ${url}: ${err.message}`);
    }
  }

  log(`Finished scrape for ${company.name}. Added ${processedCount} new job posting(s).`);
}
