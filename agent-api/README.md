# PixelSurvival Internet Research (prototype)

This isolated service provides web search results from DuckDuckGo HTML, filtered to a small allowlist of official technical sources:
- Godot documentation and official site
- GitHub documentation and official Godot docs repository
- MDN Web Docs

It does not generate AI answers, execute downloaded code, crawl arbitrary URLs, or write to the game repository. Saved links/notes are stored in the visitor's browser by the separate static page.

## Render
- Root directory: `agent-api`
- Runtime: Node
- Build command: `npm install` (no third-party packages)
- Start command: `npm start`
- Health check: `/health`

Set `SITE_ORIGIN` only if the Pages origin changes. The service currently allows exactly `https://demin6632-del.github.io`.
