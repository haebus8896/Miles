const { z } = require('zod');

const requestSchema = z.object({
  phone: z.string().min(8)
});

const verifySchema = z.object({
  reference: z.string().uuid(),
  otp: z.string().min(4).max(6)
});

module.exports = {
  requestSchema,
  verifySchema
};

