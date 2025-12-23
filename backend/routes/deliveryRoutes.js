const express = require('express');
const router = express.Router();
const controller = require('../controllers/deliveryController');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validateRequest');
const {
  createSessionSchema,
  completeSessionSchema,
  sessionParamSchema,
  summaryQuerySchema
} = require('../validators/deliveryValidators');

router.post('/sessions', validateBody(createSessionSchema), controller.createSession);
router.patch('/sessions/:sessionId', validateParams(sessionParamSchema), validateBody(completeSessionSchema), controller.completeSession);
router.get('/summary', validateQuery(summaryQuerySchema), controller.summary);

module.exports = router;

