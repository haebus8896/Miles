const { z } = require('zod');

const profileBodySchema = z.object({
  full_name: z.string().min(3),
  phone: z.string().min(8),
  relation: z.string().optional().default('primary'),
  is_default: z.boolean().optional().default(false),
  otp_reference: z.string().uuid(),
  otp_code: z.string().min(4).max(6)
});

const addressParamSchema = z.object({
  addressId: z.string().length(24)
});

module.exports = {
  profileBodySchema,
  addressParamSchema
};

