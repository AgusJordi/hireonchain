import Joi from "joi";

const schemas = {
  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .required()
      .messages({
        "string.alphanum": "Username can only contain alphanumeric characters",
        "string.min": "Username must be at least 3 characters",
        "string.max": "Username must not exceed 30 characters",
        "any.required": "Username is required",
      }),

    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
      }),

    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters",
        "string.pattern.base":
          "Password must contain uppercase, lowercase, number, and special character",
        "any.required": "Password is required",
      }),

    walletAddress: Joi.string()
      .length(44)
      .alphanum()
      .required()
      .messages({
        "string.length": "Invalid Solana wallet address format",
        "any.required": "Wallet address is required",
      }),

    role: Joi.string()
      .valid("client", "freelancer")
      .default("client")
      .messages({
        "any.only": "Role must be either client or freelancer",
      }),

    skills: Joi.array()
      .items(Joi.string().trim())
      .optional()
      .messages({
        "array.base": "Skills must be an array",
      }),

    bio: Joi.string()
      .max(500)
      .empty("")
      .optional()
      .messages({
        "string.max": "Bio must not exceed 500 characters",
      }),
  }).unknown(false),

  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
      }),

    password: Joi.string()
      .required()
      .messages({
        "any.required": "Password is required",
      }),
  }).unknown(false),
};

export const validateRegister = (req, res, next) => {
  const { error, value } = schemas.register.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = {};
    error.details.forEach((detail) => {
      errors[detail.path[0]] = detail.message;
    });
    return res.status(400).json({ message: "Validation error", errors });
  }

  req.body = value;
  next();
};

export const validateLogin = (req, res, next) => {
  const { error, value } = schemas.login.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = {};
    error.details.forEach((detail) => {
      errors[detail.path[0]] = detail.message;
    });
    return res.status(400).json({ message: "Validation error", errors });
  }

  req.body = value;
  next();
};