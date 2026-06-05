const endpoint = process.env.HEALTH_URL || 'http://localhost:8080/health';

fetch(endpoint)
  .then(async res => {
    const body = await res.json().catch(() => null);
    console.log(JSON.stringify({
      ok: res.ok,
      statusCode: res.status,
      endpoint,
      body
    }, null, 2));
    process.exit(res.ok ? 0 : 1);
  })
  .catch(error => {
    console.log(JSON.stringify({
      ok: false,
      endpoint,
      error: error.message || String(error)
    }, null, 2));
    process.exit(1);
  });