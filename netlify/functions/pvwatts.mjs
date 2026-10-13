// Netlify Function: proxies NREL PVWatts v8 so the API key stays server-side.
// Set NREL_API_KEY in Netlify → Site configuration → Environment variables.
// Reached at /api/pvwatts via the redirect in netlify.toml.
import { handlePvWatts } from '../../server/pvwatts-core.mjs';

export default (req) => handlePvWatts(req);
