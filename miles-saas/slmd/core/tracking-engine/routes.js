const express = require('express');
const router = express.Router();
const { startSession, pingLocation, getSession } = require('./trackingController');

router.post('/sessions', startSession);
router.get('/sessions/:session_id', getSession);
router.post('/ping', pingLocation);

module.exports = router;
