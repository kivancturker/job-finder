import axios from 'axios';
import db from '../db/database';
import { LLMConfigRow, SearchConfig } from '../types';
import { LLM_TIMEOUT_MS, RAW_TEXT_TRUNCATION_LIMIT } from '../constants';

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
  private static getSystemPrompt(customPrompt?: string | null): string {
    const customInstructions = customPrompt 
      ? `\n\nCRITICAL EVALUATION GUIDANCE (Strictly follow these custom rules provided by the user):\n${customPrompt}\n`
      : '';

    return `You are an elite Technical Recruiter and Specialist helping evaluate job descriptions.

Your task is to analyze raw, often messy, scraped job description HTML/text and extract precise structured data based on the user's specific search criteria. 
${customInstructions}
EXTRACTION RULES:
1. \`is_relevant\` (Boolean): Evaluate if the job aligns with the user's keywords, target strategy, and custom criteria. If a user provided custom rules, follow them strictly to determine if the job is relevant. If the job heavily features the user's 'negative_keywords', set this to false.
2. \`ai_summary\` (String): Write a maximum 2-sentence highly technical summary of the actual engineering challenges of the role. Ignore HR fluff. What is the core problem this person will solve?
3. \`tech_stack\` (Array of Strings): Extract all programming languages, databases, specialized systems, tools, frameworks, and key skills mentioned. Keep terms standardized.
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
    // Truncate raw job description text to avoid token overflows
    const truncatedText = rawText.length > RAW_TEXT_TRUNCATION_LIMIT 
      ? rawText.substring(0, RAW_TEXT_TRUNCATION_LIMIT) + '\n... [truncated due to length] ...'
      : rawText;

    const customPromptPart = searchConfig.custom_prompt
      ? `- Custom AI Evaluation Prompt/Context: ${searchConfig.custom_prompt}\n`
      : '';

    return `Target Search Strategy: "${searchConfig.name}"
- Positive Keywords (Match terms): ${JSON.stringify(searchConfig.keywords)}
- Negative Keywords (Exclude terms): ${JSON.stringify(searchConfig.negative_keywords || [])}
- Target Minimum Experience: ${searchConfig.min_experience} years
- Target Location/Countries: ${JSON.stringify(searchConfig.target_countries || [])}
${customPromptPart}
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

    const systemPrompt = this.getSystemPrompt(searchConfig.custom_prompt);
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
        }, { timeout: LLM_TIMEOUT_MS.ollama });
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
          timeout: LLM_TIMEOUT_MS.openai
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
          timeout: LLM_TIMEOUT_MS.anthropic
        });
        responseText = res.data?.content?.[0]?.text || '';
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
          timeout: LLM_TIMEOUT_MS.openrouter
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

  /**
   * Tests the connection to an LLM provider using the supplied credentials and model.
   * Returns a promise with status details and any error responses.
   */
  public static async testConnection(
    provider: string,
    modelName: string,
    apiKey: string | null
  ): Promise<{ success: boolean; message: string; details?: string }> {
    const testPrompt = 'Respond with exactly the word "success" and nothing else.';
    const timeoutMs = 15000; // 15 seconds timeout for testing

    try {
      let responseText = '';

      if (provider === 'ollama') {
        const baseUrl = apiKey || 'http://localhost:11434';
        const res = await axios.post(`${baseUrl}/api/chat`, {
          model: modelName,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          stream: false,
          options: {
            temperature: 0.1
          }
        }, { timeout: timeoutMs });
        responseText = res.data.message?.content || '';

      } else if (provider === 'openai') {
        if (!apiKey) {
          throw new Error('API key is missing for OpenAI provider');
        }
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: modelName,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1000
        }, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: timeoutMs
        });
        responseText = res.data.choices?.[0]?.message?.content || '';

      } else if (provider === 'anthropic') {
        if (!apiKey) {
          throw new Error('API key is missing for Anthropic provider');
        }
        const res = await axios.post('https://api.anthropic.com/v1/messages', {
          model: modelName,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.1
        }, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: timeoutMs
        });
        responseText = res.data?.content?.[0]?.text || '';

      } else if (provider === 'openrouter') {
        if (!apiKey) {
          throw new Error('API key is missing for OpenRouter provider');
        }
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: modelName,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1000
        }, {
          headers: { 
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'DeepTech Job Radar'
          },
          timeout: timeoutMs
        });
        responseText = res.data.choices?.[0]?.message?.content || '';
      } else {
        throw new Error(`Unsupported LLM provider: ${provider}`);
      }

      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response received from LLM');
      }

      return {
        success: true,
        message: responseText.trim()
      };

    } catch (err: any) {
      let details = err.message;
      if (err.response) {
        const status = err.response.status;
        const data = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data;
        details = `API error (HTTP ${status}): ${data}`;
      } else if (err.request) {
        details = 'No response received from the server. Check host network connectivity or provider settings.';
      }
      return {
        success: false,
        message: err.message || 'Connection failed',
        details
      };
    }
  }
}

