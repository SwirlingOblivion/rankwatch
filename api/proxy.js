export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path, debug, ahrefs, keywords, country = 'us' } = req.query;
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

  // ── Ahrefs proxy ──────────────────────────────────────────
  if (ahrefs === '1') {
    try {
      const token = authHeader.replace('Bearer ', '');
      // Correct endpoint: /v3/keywords-explorer/metrics
      // select=volume,difficulty — difficulty costs 10 units/row, volume costs 1 unit/row
      const url = `https://api.ahrefs.com/v3/keywords-explorer/metrics?select=keyword,volume,difficulty&keywords=${encodeURIComponent(keywords)}&country=${country}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text, raw: text.substring(0,500) }; }
      return res.status(response.status).json(data);
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── AccuRanker proxy ──────────────────────────────────────
  if (!path) return res.status(400).json({ error: 'Missing path' });

  try {
    const url = `https://app.accuranker.com${decodeURIComponent(path)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { data = { error: text, status: response.status }; }

    if (debug === '1') {
      const sample = data.results ? data.results[0] : (Array.isArray(data) ? data[0] : data);
      return res.status(200).json({ fields: sample ? Object.keys(sample) : [], sample });
    }

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
