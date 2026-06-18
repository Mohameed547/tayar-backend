import ApiError from '../utils/ApiError.js';

/**
 * Generic Joi validation middleware.
 * Usage: router.post('/', validate(someJoiSchema), controller.create)
 *
 * `source` lets the same helper validate body, params, or query —
 * e.g. validate(schema, "params") for route param checks.
 */
export const validate = (schema, source = "body") => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const message = error.details.map((d) => d.message).join(", ");
            return next(new ApiError(400, message));
        }

        req[source] = value;
        return next();
    };
};

export default validate;
