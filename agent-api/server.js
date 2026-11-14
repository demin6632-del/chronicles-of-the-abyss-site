const http = require("node:http");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const SITE_ORIGIN = "https://demin6632-del.github.io";
const ALLOWED_HOSTS = new Set([
  "docs.godotengine.org",
  "godotengine.org",
  "docs.github.com",
  "developer.mozilla.org"
]);
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const requests = new Map();

function send(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
  });
  res.end(JSON.stringify(data));
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim().slice(0, 500);
}

function allowedUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    const hostAllowed = [...ALLOWED_HOSTS].some(host => url.hostname === host || url.hostname.endsWith("." + host));
    if (!hostAllowed) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function unwrapBingUrl(raw) {
  try {
    const link = new URL(raw, "https://www.bing.com");
    if (link.hostname.endsWith("bing.com") && link.pathname.startsWith("/ck/a")) {
      const encoded = link.searchParams.get("u") || "";
      if (encoded.startsWith("a1")) {
        const decoded = Buffer.from(encoded.slice(2), "base64url").toString("utf8");
        if (decoded.startsWith("https://")) return decoded;
      }
    }
    return link.href;
  } catch {
    return raw;
  }
}

function rateLimited() {
  // A shared service-wide limit avoids trusting caller-controlled forwarding
  // headers for client identity. It protects the free search backend from
  // bursts; it is intentionally not presented as per-user throttling.
  const now = Date.now();
  const entry = requests.get("global") || { start: now, count: 0 };
  if (now - entry.start > WINDOW_MS) {
    entry.start = now;
    entry.count = 0;
  }
  entry.count++;
  requests.set("global", entry);
  return entry.count > MAX_REQUESTS * 6;
}

async function fetchSearchPage(endpoint, provider) {
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; PixelSurvivalResearch/1.2; +https://demin6632-del.github.io/chronicles-of-the-abyss-site/)",
      "accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(provider + ": HTTP " + response.status);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error(provider + ": response too large");
  return html;
}

function extractBing(html) {
  const results = [];
  for (const match of html.matchAll(/<h2\b[^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/h2>/gi)) {
    const href = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = allowedUrl(unwrapBingUrl(href.replace(/&amp;/g, "&")));
    if (!url) continue;
    const title = cleanText(match[2]);
    if (!title) continue;
    results.push({ title, url, snippet: "" });
    if (results.length >= 8) break;
  }
  return results;
}

function extractGoogle(html) {
  const results = [];
  for (const heading of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const before = html.slice(Math.max(0, heading.index - 2500), heading.index);
    const anchors = [...before.matchAll(/<a\b([^>]*)>/gi)];
    const attrs = anchors.at(-1)?.[1] || "";
    let href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    href = href.replace(/&amp;/g, "&");
    try {
      const link = new URL(href, "https://www.google.com");
      if (link.hostname === "www.google.com" && link.pathname === "/url") {
        href = link.searchParams.get("q") || link.searchParams.get("url") || "";
      }
    } catch { continue; }
    const url = allowedUrl(href);
    if (!url) continue;
    const title = cleanText(heading[1]);
    if (!title) continue;
    results.push({ title, url, snippet: "" });
    if (results.length >= 8) break;
  }
  return results;
}

function extractDuckDuckGo(html) {
  const anchors = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)];
  const results = [];
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i][0];
    const openingTag = anchor.match(/^<a\b[^>]*>/i)?.[0] || "";
    const classMatch = openingTag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
    if (!classMatch || !classMatch[1].split(/\s+/).includes("result__a")) continue;
    const hrefMatch = openingTag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    let raw = hrefMatch[1].replace(/&amp;/g, "&");
    try {
      const wrapped = new URL(raw, "https://html.duckduckgo.com");
      raw = wrapped.searchParams.get("uddg") || wrapped.href;
    } catch { continue; }
    const url = allowedUrl(raw);
    if (!url) continue;
    const titleMatch = anchor.match(/^<a\b[^>]*>([\s\S]*?)<\/a>$/i);
    const nextResult = html.indexOf('class="result__a"', anchors[i + 1]?.index ?? html.length);
    const offset = anchors[i].index || 0;
    const snippetArea = html.slice(offset + anchor.length, nextResult > -1 ? nextResult : offset + anchor.length + 1800);
    const snippetMatch = snippetArea.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    results.push({ title: cleanText(titleMatch?.[1] || ""), url, snippet: cleanText(snippetMatch?.[1] || "") });
    if (results.length >= 8) break;
  }
  return results;
}

async function search(query) {
  const scopedQuery = query + " (site:docs.godotengine.org OR site:docs.github.com OR site:developer.mozilla.org OR site:godotengine.org)";
  const providers = [
    {
      name: "Bing",
      url: () => {
        const endpoint = new URL("https://www.bing.com/search");
        endpoint.searchParams.set("q", scopedQuery);
        return endpoint;
      },
      parse: extractBing
    },
    {
      name: "Google",
      url: () => {
        const endpoint = new URL("https://www.google.com/search");
        endpoint.searchParams.set("q", scopedQuery);
        return endpoint;
      },
      parse: extractGoogle
    },
    {
      name: "DuckDuckGo",
      url: () => {
        const endpoint = new URL("https://html.duckduckgo.com/html/");
        endpoint.searchParams.set("q", scopedQuery);
        return endpoint;
      },
      parse: extractDuckDuckGo
    }
  ];

  const failures = [];
  for (const provider of providers) {
    try {
      const html = await fetchSearchPage(provider.url(), provider.name);
      const results = provider.parse(html);
      if (results.length) return results;
      const pageTitle = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "no title").slice(0, 80);
      console.warn("Search provider returned no allowed results:", provider.name, "html_bytes=" + html.length, "title=" + pageTitle);
      failures.push(provider.name + ": no allowed results");
    } catch (error) {
      // Log only provider and error type; never log the user's search query.
      console.warn("Search provider failed:", provider.name, error.name || "Error");
      failures.push(provider.name + ": unavailable");
    }
  }
  throw new Error("Бесплатные поисковики временно недоступны или не вернули подходящие официальные страницы. Попробуй позже.");
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== SITE_ORIGIN) {
    return send(res, 403, { error: "Недопустимый источник запроса." });
  }

  res.setHeader("access-control-allow-origin", SITE_ORIGIN);
  res.setHeader("vary", "Origin");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") {
    return send(res, 200, {
      ok: true,
      service: "pixelsurvival-research",
      mode: "web-search-only"
    });
  }
  if (url.pathname !== "/api/search" || req.method !== "GET") {
    return send(res, 404, { error: "Маршрут не найден." });
  }

  if (rateLimited()) {
    return send(res, 429, { error: "Сервис получил слишком много запросов. Попробуй через минуту." });
  }

  const query = (url.searchParams.get("q") || "").trim();
  if (query.length < 3 || query.length > 160) {
    return send(res, 400, { error: "Запрос должен содержать от 3 до 160 символов." });
  }
  if (/[<>\u0000-\u001f]/.test(query)) {
    return send(res, 400, { error: "Запрос содержит недопустимые символы." });
  }

  try {
    const results = await search(query);
    return send(res, 200, {
      query,
      results,
      note: "Это результаты поиска, а не сгенерированный ИИ-ответ. Проверяй содержание первоисточника."
    });
  } catch (error) {
    return send(res, 502, { error: error.message || "Не удалось выполнить поиск." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("PixelSurvival research server listening on " + PORT);
});
