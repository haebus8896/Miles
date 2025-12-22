const express = require('express');
const router = express.Router();
const { createPolyline, getPolylines, createRoad, getNearbyRoads } = require('./polylineController');

router.post('/', createPolyline);
router.get('/', getPolylines);

// Road sub-resource
router.post('/roads', createRoad);
router.get('/roads', getNearbyRoads);

module.exports = router;
