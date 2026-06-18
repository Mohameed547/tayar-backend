import Joi from 'joi';

const phonePattern = /^01[0125][0-9]{8}$/;

export const register = Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(phonePattern).required().messages({
        'string.pattern.base': 'Phone must be a valid Egyptian mobile number (e.g. 01012345678)',
    }),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string().valid('customer', 'driver', 'office').default('customer'),

    vehicleType: Joi.string().valid('motorcycle', 'car', 'van', 'truck').when('role', {
        is: 'driver',
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    plateNumber: Joi.string().when('role', { is: 'driver', then: Joi.required(), otherwise: Joi.optional() }),

    businessName: Joi.string().when('role', { is: 'office', then: Joi.required(), otherwise: Joi.optional() }),
    licenseNumber: Joi.string().when('role', { is: 'office', then: Joi.required(), otherwise: Joi.optional() }),
    officeAddress: Joi.string().when('role', { is: 'office', then: Joi.required(), otherwise: Joi.optional() }),
});

export const login = Joi.object({
    emailOrPhone: Joi.string().required(),
    password: Joi.string().required(),
});

export const refreshToken = Joi.object({
    refreshToken: Joi.string().required(),
});

export const verifyOtp = Joi.object({
    phone: Joi.string().pattern(phonePattern).required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

export const resendOtp = Joi.object({
    phone: Joi.string().pattern(phonePattern).required(),
});

export const forgotPassword = Joi.object({
    email: Joi.string().email().required(),
});

export const resetPassword = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
});

export const changePassword = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
});

export const verifyEmail = Joi.object({
    token: Joi.string().required(),
});