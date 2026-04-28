export default async function handler(req, res) {
  // Allow requests from your Vercel app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path, debug } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

  try {
    const url = `https://app.accuranker.com${decodeURIComponent(path)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      }
    });

    const data = await response.json();

    // Debug mode: return first keyword's raw fields so we can inspect them
    if (debug === '1') {
      const sample = data.results ? data.results[0] : (Array.isArray(data) ? data[0] : data);
      return res.status(200).json({ 
        fields: sample ? Object.keys(sample) : [],
        sample: sample
      });
    }

    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
