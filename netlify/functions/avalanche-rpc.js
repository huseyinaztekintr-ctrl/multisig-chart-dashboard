// Simple Netlify function to proxy Avalanche JSON-RPC requests and add CORS headers.
// Configure the target RPC URL via the AVALANCHE_RPC_URL env var in Netlify settings
// (recommended to use a provider with an API key like QuickNode/Chainstack to avoid rate limits).

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const TARGET_RPC = process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';

exports.handler = async function (event) {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      },
      body: JSON.stringify({ error: 'Only POST allowed' }),
    };
  }

  try {
    const resp = await fetch(TARGET_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: event.body,
      // pass-through caching headers could be added here
    });

    const text = await resp.text();

    // Mirror the status and body, but always add CORS headers
    return {
      statusCode: resp.status,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Content-Type': resp.headers.get('content-type') || 'application/json',
      },
      body: text,
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Proxy error', details: String(err) }),
    };
  }
};
