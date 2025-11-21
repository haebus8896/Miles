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
app.use('/api/delivery', require('./routes/deliveryRoutes'));

// health
app.get('/', (req, res) => res.send({ ok: true, msg: 'Backend running' }));
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log('Server running on port', PORT));
