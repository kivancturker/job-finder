# Page: Job Description View
**Route:** `/jobs/:id`

## Layout & Functionality
- **Header:** Job Title + Company Name (with a hyperlink to the actual external job URL).
- **AI Insight Panel (Top):**
  - Visually distinct box (e.g., slightly different background color).
  - Displays the `ai_summary`.
  - Renders `tech_stack` items as pill-shaped UI tags.
- **Content Area (Bottom):** Renders the `raw_text` of the job description.
- **Action on Load:** When this component mounts, it immediately sends a PUT request to `/api/jobs/:id/visit` to set `is_visited = true`.
- **Back Button:** Return to the previous Search Config list.