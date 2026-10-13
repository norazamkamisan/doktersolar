// Vercel Function: GET /api/pvwatts?lat=..&lon=..&system_capacity=..&tilt=..&azimuth=..
// Set NREL_API_KEY in Vercel → Project → Settings → Environment Variables.
import { handlePvWatts } from '../server/pvwatts-core.mjs';

export function GET(request) {
  return handlePvWatts(request);
}
