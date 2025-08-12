const axios = require('axios');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { origin, destination } = req.query || {};
  if (!origin || !destination) return res.status(400).json({ error: 'origin, destination required' });
  try {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'KAKAO_REST_API_KEY not configured' });
    const url = `https://apis-navi.kakaomobility.com/v1/directions`;
    const [originLng, originLat] = origin.split(',');
    const [destLng, destLat] = destination.split(',');
    const response = await axios.get(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      params: {
        origin: `${originLng},${originLat}`,
        destination: `${destLng},${destLat}`,
        priority: 'RECOMMEND',
        road_details: true,
      },
    });
    return res.json(response.data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


