const express = require('express');
const router = express.Router();
const { createRider, getRiders, updateStatus } = require('./riderController');

router.post('/', createRider);
router.get('/', getRiders);
router.patch('/:code/status', updateStatus);

module.exports = router;
