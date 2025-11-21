const { issueOtp, verifyOtp } = require('../services/otpService');

exports.requestOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }
  const payload = await issueOtp(phone);
  res.status(201).json(payload);
};

exports.verifyOtpCode = async (req, res) => {
  const { reference, otp } = req.body;
  if (!reference || !otp) {
    return res.status(400).json({ error: 'reference and otp are required' });
  }
  const result = await verifyOtp(reference, otp);
  res.json(result);
};

