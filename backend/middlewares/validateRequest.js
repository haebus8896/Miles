const buildValidator =
  (schema, property = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
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

