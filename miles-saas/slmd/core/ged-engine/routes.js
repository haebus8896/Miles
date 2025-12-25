const express = require('express');
const router = express.Router();
const { createRule, evaluateEntry, getDecisions } = require('./gedController');

router.post('/rules', createRule);
router.post('/evaluate', evaluateEntry);
router.get('/decisions', getDecisions);

module.exports = router;
