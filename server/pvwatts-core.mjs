// Shared NREL PVWatts v8 proxy logic, used by both:
//   - Vercel:  api/pvwatts.js
//   - Netlify: netlify/functions/pvwatts.mjs
// The API key is read from process.env.NREL_API_KEY on the server and never sent to the browser.

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });

/** @param {Request} req */
export async function handlePvWatts(req) {
  const key = process.env.NREL_API_KEY;
  if (!key) return json(501, { error: 'PVWatts is not configured (NREL_API_KEY is missing).' });

  const url = new URL(req.url);
  const num = (name, min, max) => {
    const raw = url.searchParams.get(name);
    if (raw === null || raw === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) && v >= min && v <= max ? v : null;
  };
  const lat = num('lat', -90, 90);
  const lon = num('lon', -180, 180);
  const cap = num('system_capacity', 0.05, 500000);
  const tilt = num('tilt', 0, 90) ?? 20;
  const azimuth = num('azimuth', 0, 360) ?? 180;
  if (lat === null || lon === null || cap === null) {
    return json(400, { error: 'lat, lon and system_capacity are required and must be valid numbers.' });
  }

  const params = new URLSearchParams({
    api_key: key,
    lat: String(lat),
    lon: String(lon),
    system_capacity: String(cap),
    tilt: String(tilt),
    azimuth: String(azimuth),
    module_type: '0',
    array_type: '1', // fixed roof mount
    losses: '14',
    timeframe: 'monthly',
  });

  // NSRDB covers the Americas and much of Asia; fall back to the international dataset.
  for (const dataset of ['nsrdb', 'intl']) {
    params.set('dataset', dataset);
    try {
      const res = await fetch(`https://developer.nrel.gov/api/pvwatts/v8.json?${params}`);
      const data = await res.json();
      if (res.ok && data?.outputs?.ac_monthly) {
        return json(200, {
          annual: data.outputs.ac_annual,
          monthly: data.outputs.ac_monthly,
          solradAnnual: data.outputs.solrad_annual,
          station: data.station_info?.city || data.station_info?.location || null,
          dataset,
        });
      }
      if (dataset === 'intl') {
        return json(502, { error: (data?.errors && data.errors.join('; ')) || 'PVWatts returned no data for this location.' });
      }
    } catch (err) {
      if (dataset === 'intl') return json(502, { error: `PVWatts request failed: ${err.message}` });
    }
  }
  return json(502, { error: 'PVWatts request failed.' });
}
