/**
 * Express application wiring (MVC): routes -> controllers -> services -> repositories.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { registerObservers } = require('./services/EventBus');
const db = require('./config/db');

const env = require('./config/env');

const app = express();

// A hosting platform terminates TLS at its own load balancer and forwards the
// request over plain HTTP, so without this every client appears to be the
// proxy and req.secure is always false. One hop, because trusting an
// unspecified number of hops would let a client forge its own address by
// sending its own X-Forwarded-For header.
if (env.isProduction) app.set('trust proxy', 1);

// The front end is served by this same process, so in production the browser
// is already on the right origin and no cross-origin access is needed. Leaving
// CORS wide open there would let any website on the internet make authenticated
// calls against this API from a visitor's browser. Locally it stays open, which
// is what allows the front end to be opened straight from the file system while
// developing.
app.use(cors(
  env.isProduction
    ? { origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean) }
    : {}
));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple request log — useful during the demo.
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Serve the front end from /public
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.get('/health', async (_req, res) => {
  let database = false;
  try { database = await db.healthCheck(); } catch { database = false; }
  res.json({ status: database ? 'ok' : 'degraded', database, time: new Date().toISOString() });
});

app.use('/api', apiRoutes);

app.use('/api', notFound);
app.use(errorHandler);

registerObservers();

module.exports = app;
