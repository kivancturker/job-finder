# Page: Job Search Configurations
**Route:** `/search-configs`

## Layout & Functionality
- **Header:** "Search Strategies" + "Create Strategy" button.
- **Top Section:** List of existing strategies (e.g., "DB Internals", "Junior React").
- **Form Section (When Creating/Editing):**
  - `Strategy Name` (Text).
  - `Keywords` (Tag input or comma-separated list).
  - `Negative Keywords` (Tag input, optional).
  - `Minimum Experience` (Number).
- **Bottom Section (Results):** When a user selects a strategy from the top list, the bottom half of the page displays a table of all `job_postings` linked to this `search_config_id`.
  - **Unread Indicator:** Rows where `is_visited == false` must have a bold font and a blue dot indicator.
  - **On Click:** Clicking a job row routes the right pane to the Job Description Page.