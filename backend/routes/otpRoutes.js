const express = require('express');
const router = express.Router();
const controller = require('../controllers/otpController');
const { validateBody } = require('../middlewares/validateRequest');
const { requestSchema, verifySchema } = require('../validators/otpValidators');

router.post('/request', validateBody(requestSchema), controller.requestOtp);
router.post('/verify', validateBody(verifySchema), controller.verifyOtpCode);

module.exports = router;

