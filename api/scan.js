export const config = { regions: ['ams1'] };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, geo = 'NL' } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel' });

  const langMap = { NL: 'nl', DE: 'de', IT: 'it', ES: 'es', EN: 'en', FR: 'fr', SE: 'sv', NO: 'no', FI: 'fi' };
  const lang = langMap[geo] || 'en';

  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': `${lang}-${geo},${lang};q=0.9,en;q=0.8`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
    const html = await pageRes.text();

    // Strip scripts/styles/tags, take first 5000 chars of visible text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `This is text scraped from an online casino affiliate review page. Extract every casino brand name listed (usually in a top-10 or ranked list near the top of the page). Return ONLY a valid JSON array of casino name strings, nothing else. Example: ["Casino Name","Another Casino"]. If none found return [].

Text:
${text}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const content = claudeData.content?.[0]?.text?.trim() || '[]';
    let casinos = [];
    try {
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) casinos = JSON.parse(match[0]);
      casinos = casinos.filter(c => typeof c === 'string' && c.trim().length > 1).map(c => c.trim());
    } catch {}

    return res.status(200).json({ casinos, url, geo, scanned_at: new Date().toISOString() });

  } catch (err) {
    return res.status(500).json({ error: err.message, url });
  }
}
