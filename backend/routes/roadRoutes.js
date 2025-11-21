const express = require('express');
const router = express.Router();
const controller = require('../controllers/roadController');

// GET /api/road/nearest?lat=&lng=
router.get('/nearest', controller.nearest);

module.exports = router;
