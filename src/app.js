const express = require('express');

const healthRouter = require('./routes/health');
const matchesRouter = require('./routes/matches');
const standingsRouter = require('./routes/standings');

function createApp() {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/standings', standingsRouter);

  app.get('/', (req, res) => {
    res.json({
      service: 'soccer-scores-api',
      endpoints: ['/health', '/api/matches/:league', '/api/standings/:league'],
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Centralized error handler. Deliberately does not leak stack traces or
  // internal error details to the client - only logs them server-side.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status && err.status < 500 ? err.status : 502;
    res.status(status).json({ error: 'Upstream or internal error' });
  });

  return app;
}

module.exports = createApp;
