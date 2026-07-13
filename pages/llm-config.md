# Page: LLM Configuration
**Route:** `/settings/llm`

## Layout & Functionality
- **Header:** "AI Provider Settings".
- **Provider Selection:** Radio buttons or dropdown (Local Ollama vs. OpenAI vs. Anthropic).
- **Dynamic Fields:**
  - If *Ollama* is selected: Show "Base URL" (default `http://localhost:11434`) and "Model Name" (e.g., `llama3`).
  - If *OpenAI* is selected: Show "API Key" (password masked input) and "Model Name" (dropdown: `gpt-4o`, `gpt-4o-mini`).
- **Actions:** "Save Configuration" button.
- Only the currently saved configuration is marked as `is_active = true` in the DB.