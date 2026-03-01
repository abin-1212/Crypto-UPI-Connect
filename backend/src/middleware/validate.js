/**
 * ═══════════════════════════════════════════════════════════════
 *  CONVERGEX — Joi Validation Middleware
 * ═══════════════════════════════════════════════════════════════
 *
 *  Generic middleware factory for Joi schema validation.
 *  Usage: router.post("/route", validate(schema), handler)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Create a validation middleware for a given Joi schema.
 * @param {import('joi').Schema} schema — Joi schema to validate req.body against.
 */
export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message).join("; ");
    return res.status(400).json({
      success: false,
      message: `Validation error: ${messages}`,
      errors: error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    });
  }

  req.body = value; // Use sanitized values
  next();
};

export default validate;
