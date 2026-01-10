require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  })
);
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('dev'));
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} | Origin: ${req.headers.origin}`);
  next();
});
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500
  })
);

// connect db
connectDB();

// routes
app.use('/api/addresses', require('./routes/addressRoutes'));
app.use('/api/roads', require('./routes/roadRoutes'));
app.use('/api/profiles', require('./routes/profileRoutes'));
app.use('/api/otp', require('./routes/otpRoutes'));
app.use('/api/residence', require('./routes/residenceRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/delivery', require('./routes/deliveryRoutes'));

// GED & Tracking Backport
const gedController = require('./controllers/gedController');
const trackingController = require('./controllers/trackingController');

app.post('/api/ged/rules', gedController.createRule);
app.post('/api/ged/evaluate', gedController.evaluateEntry);
app.post('/api/tracking/sessions', trackingController.startSession);
app.post('/api/tracking/ping', trackingController.pingLocation);

// health
app.get('/', (req, res) => res.send({ ok: true, msg: 'Backend running' }));
app.get('/api/health', (req, res) => res.send({ status: 'ok', uptime: process.uptime() }));
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port', PORT));
