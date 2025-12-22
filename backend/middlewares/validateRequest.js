const buildValidator =
  (schema, property = 'body') =>
    (req, res, next) => {
      console.log(`[VALIDATOR] Validating ${property}:`, req[property]);
      const result = schema.safeParse(req[property]);
      if (!result.success) {
        console.error('[VALIDATOR] Failure:', JSON.stringify(result.error.flatten(), null, 2));
        return res.status(400).json({
          error: 'Validation failed',
          details: result.error.flatten()
        });
      }
      req[property] = result.data;
      return next();
    };

module.exports = {
  validateBody: (schema) => buildValidator(schema, 'body'),
  validateQuery: (schema) => buildValidator(schema, 'query'),
  validateParams: (schema) => buildValidator(schema, 'params')
};

