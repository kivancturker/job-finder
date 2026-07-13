import axios from 'axios';
import db from '../db/database';
import { LLMConfigRow, SearchConfig } from '../types';

export interface AIAnalysisResult {
  is_relevant: boolean;
  ai_summary: string;
  tech_stack: string[];
  min_experience: number;
}

// Robust JSON parser to handle markdown blocks or surrounding text
function extractAndParseJSON(text: string): AIAnalysisResult {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/s, '').trim();
  }

  // Find the JSON object boundary
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(cleaned);

  // Validate fields and cast types to match target format
  return {
    is_relevant: Boolean(parsed.is_relevant),
    ai_summary: typeof parsed.ai_summary === 'string' ? parsed.ai_summary : '',
    tech_stack: Array.isArray(parsed.tech_stack) ? parsed.tech_stack.map(String) : [],
    min_experience: typeof parsed.min_experience === 'number' ? parsed.min_experience : 0
  };
}

export class LlmService {
  private static getSystemPrompt(): string {
    return `You are an elite Technical Recruiter and Staff Software Engineer specialized in Deep Tech, Systems Engineering, and Database Internals.

Your task is to analyze raw, often messy, scraped job description HTML/text and extract precise structured data based on the user's specific search criteria. 

EXTRACTION RULES:
1. \`is_relevant\` (Boolean): Evaluate if the job aligns with the user's keywords and experience level. If the job heavily features the user's 'negative_keywords', set this to false. If it's a generic web-dev role but the user wants database internals, set this to false.
2. \`ai_summary\` (String): Write a maximum 2-sentence highly technical summary of the actual engineering challenges of the role. Ignore HR fluff. What is the core problem this person will solve?
3. \`tech_stack\` (Array of Strings): Extract all programming languages, databases, consensus algorithms (e.g., Raft, Paxos), and infrastructure tools mentioned. Keep terms standardized (e.g., "C++", not "C/C++").
4. \`min_experience\` (Number): Extract the absolute minimum years of experience required. If not stated, return 0.

OUTPUT FORMAT:
You must respond with ONLY a valid, minified JSON object. Do not wrap the response in markdown code blocks (no \`\`\`json). Do not include any conversational text before or after the JSON.

REQUIRED JSON SCHEMA:
{
  "is_relevant": boolean,
  "ai_summary": "string",
  "tech_stack": ["string"],
  "min_experience": number
}`;
  }

  private static formatUserPrompt(
    rawText: string,
    searchConfig: SearchConfig,
    jobTitle: string,
    companyName: string
  ): string {
    // Truncate raw job description text to avoid token overflows (approx 12,000 characters limit)
    const truncatedText = rawText.length > 12000 
      ? rawText.substring(0, 12000) + '\n... [truncated due to length] ...'
      : rawText;

    return `Target Search Strategy: "${searchConfig.name}"
- Positive Keywords (Match terms): ${JSON.stringify(searchConfig.keywords)}
- Negative Keywords (Exclude terms): ${JSON.stringify(searchConfig.negative_keywords || [])}
- Target Minimum Experience: ${searchConfig.min_experience} years
- Target Location/Countries: ${JSON.stringify(searchConfig.target_countries || [])}

Job Details:
- Company Name: ${companyName}
- Job Title: ${jobTitle}

Job Description Text:
${truncatedText}
`;
  }

  /**
   * Evaluates a job description against a search configuration using the active LLM setup.
   * Returns null if no active LLM configuration exists.
   */
  public static async analyzeJob(
    rawText: string,
    searchConfig: SearchConfig,
    jobTitle: string,
    companyName: string
  ): Promise<AIAnalysisResult | null> {
    // 1. Fetch active LLM configuration
    const config = db.prepare('SELECT * FROM llm_configs WHERE is_active = 1 LIMIT 1').get() as LLMConfigRow | undefined;
    if (!config) {
      console.warn('[LlmService] No active LLM configuration found in database. Skipping LLM analysis.');
      return null;
    }

    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.formatUserPrompt(rawText, searchConfig, jobTitle, companyName);

    console.log(`[LlmService] Analyzing job "${jobTitle}" via provider "${config.provider}" (${config.model_name})`);

    try {
      let responseText = '';

      if (config.provider === 'ollama') {
        const baseUrl = config.api_key || 'http://localhost:11434';
        const res = await axios.post(`${baseUrl}/api/chat`, {
          model: config.model_name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          options: {
            temperature: 0.1
          }
        }, { timeout: 45000 });
        responseText = res.data.message?.content || '';

      } else if (config.provider === 'openai') {
        if (!config.api_key) {
          throw new Error('API key is missing for OpenAI provider');
        }
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: config.model_name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }, {
          headers: { Authorization: `Bearer ${config.api_key}` },
          timeout: 30000
        });
        responseText = res.data.choices?.[0]?.message?.content || '';

      } else if (config.provider === 'anthropic') {
        if (!config.api_key) {
          throw new Error('API key is missing for Anthropic provider');
        }
        const res = await axios.post('https://api.anthropic.com/v1/messages', {
          model: config.model_name,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.1
        }, {
          headers: {
            'x-api-key': config.api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 30000
        });
      } else if (config.provider === 'openrouter') {
        if (!config.api_key) {
          throw new Error('API key is missing for OpenRouter provider');
        }
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: config.model_name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }, {
          headers: { 
            Authorization: `Bearer ${config.api_key}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'DeepTech Job Radar'
          },
          timeout: 45000
        });
        responseText = res.data.choices?.[0]?.message?.content || '';
      } else {
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
      }

      // Parse output
      if (!responseText) {
        throw new Error('Empty response content received from LLM');
      }

      return extractAndParseJSON(responseText);

    } catch (err: any) {
      console.error(`[LlmService] LLM API call failed: ${err.message}`);
      throw err;
    }
  }
}
