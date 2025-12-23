const { z } = require('zod');

const createSessionSchema = z.object({
  address_code: z.string().min(5),
  delivery_partner_id: z.string().min(3),
  mode: z.enum(['SMART_NAV', 'GOOGLE_ONLY']).optional().default('SMART_NAV')
});

const completeSessionSchema = z.object({
  metrics: z
    .object({
      duration_seconds: z.number().nonnegative().optional(),
      customer_calls: z.number().nonnegative().optional(),
      wrong_lane_attempts: z.number().nonnegative().optional(),
      distance_meters: z.number().nonnegative().optional()
    })
    .optional()
    .default({}),
  notes: z.string().optional()
});

const sessionParamSchema = z.object({
  sessionId: z.string().length(24)
});

const summaryQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).optional().default(7)
});

module.exports = {
  createSessionSchema,
  completeSessionSchema,
  sessionParamSchema,
  summaryQuerySchema
};

