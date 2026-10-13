// Cloudflare Worker API for admin requests. The Worker URL is public; protect list access with Cloudflare Access.
const REQUESTS_API_URL = 'https://contact-api.lachmanfrantisekk.workers.dev';

async function requestsApiPost(payload) {
  let response;
  try {
    response = await fetch(REQUESTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error('Nepodařilo se spojit s Cloudflare API. Zkontrolujte připojení a CORS nastavení Workeru.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Cloudflare API nevrátilo platnou JSON odpověď.'); }
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Cloudflare API vrátilo chybu HTTP ${response.status}.`);
  }
  return result.data;
}

const requestsApi = {
  list: () => requestsApiPost({ action: 'list' }),
  create: (message) => requestsApiPost({ action: 'create', message }),
};
