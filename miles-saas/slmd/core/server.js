require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const tenantMiddleware = require('./middlewares/tenantMiddleware');

// Connect to Database
connectDB();

const app = express();

// Global Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Tenant Context Middleware (Applied globally or per-route)
app.use(tenantMiddleware);

// Routes
app.use('/api/auth', require('./api/auth/routes'));
app.use('/api/addresses', require('./address-engine/routes'));
app.use('/api/polylines', require('./polyline-engine/routes'));

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'miles-core',
        tenant: req.tenant ? req.tenant.slug : 'global'
    });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Miles Core Engine running on port ${PORT}`);
});
