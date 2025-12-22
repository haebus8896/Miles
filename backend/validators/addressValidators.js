const { z } = require('zod');

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const createAddressSchema = z.object({
  official_address: z.string().min(4),
  landmark: z.string().optional().default(''),
  locality: z.string().optional().default(''),
  city: z.string().optional().default(''),
  postal_code: z.string().optional().default(''),
  floor_no: z.number().int().min(-5).max(200).optional().default(0),
  flat_no: z.string().optional().default(''),
  instructions: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  door_photo: z.string().optional().default(''),
  polyline: z.array(latLngSchema).optional().default([]),
  source: latLngSchema.optional(),
  road_point: latLngSchema.optional(),
  destination_point: latLngSchema.optional(),
  owner_full_name: z.string().optional().default(''),
  owner_phone: z.string().optional().default('')
});

const updateAddressSchema = createAddressSchema.partial();

const proximityQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().optional().default(50)
});

const duplicateQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().optional().default(40)
});

const codeParamSchema = z.object({
  codeOrId: z.string()
});

const idParamSchema = z.object({
  id: z.string().length(24)
});

module.exports = {
  createAddressSchema,
  updateAddressSchema,
  proximityQuerySchema,
  duplicateQuerySchema,
  codeParamSchema,
  idParamSchema
};

