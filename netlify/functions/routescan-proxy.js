// Netlify function to proxy RoutesScan API requests and add CORS headers
// This helps avoid CORS and potential 429 rate limiting issues

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const ROUTESCAN_BASE_URL = 'https://api.routescan.io';

exports.handler = async function (event) {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      },
      body: JSON.stringify({ error: 'Only GET allowed' }),
    };
  }

  try {
    // Extract the path from query params or path
    const path = event.queryStringParameters?.path || '';
    if (!path) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing path parameter' }),
      };
    }

    // Build the full RoutesScan URL
    const url = `${ROUTESCAN_BASE_URL}${path}`;
    
    // Forward query parameters (except our internal 'path' param)
    const queryParams = new URLSearchParams();
    Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
      if (key !== 'path') {
        queryParams.append(key, value);
      }
    });

    const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

    const resp = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Netlify-Function-Proxy/1.0',
      },
    });

    const text = await resp.text();

    return {
      statusCode: resp.status,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Content-Type': resp.headers.get('content-type') || 'application/json',
      },
      body: text,
    };
  } catch (err) {
    console.error('RoutesScan proxy error:', err);
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