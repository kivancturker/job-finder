# System Architecture

## Data Flow
```text
[ React Frontend ] <---(SSE Stream)---> [ Express Backend Task Queue ]
        │                                         │
 (Click Start)                            [ SQLite Database ]
        │                                         │
        └───────(REST API)────────────────> [ Scraping Engine ]
                                                  ├── Axios + Cheerio
                                                  └── Playwright