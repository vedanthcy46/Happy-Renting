const app = require('./backend/server');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log('Listening on port', port);
  try {
    const res = await fetch(\`http://127.0.0.1:\${port}/api/v2/admin/settings\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionEnabled: true })
    });
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Body:', body);
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    process.exit(0);
  }
});
