export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];

    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    if (source === 'body') {
      req.body = result.data;
    } else if (req[source] && typeof req[source] === 'object') {
      Object.assign(req[source], result.data);
    } else {
      try {
        req[source] = result.data;
      } catch {
        // Fallback for read-only request properties
      }
    }
    next();
  };
};
