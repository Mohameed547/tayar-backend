import express from 'express';
import * as controller from './auth.controller.js';
import validate from '../../shared/middleware/validate.js';
import * as schemas from './auth.validation.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authLimiter } from '../../shared/middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), controller.register);
router.post('/login', authLimiter, validate(schemas.login), controller.login);
router.post('/refresh', validate(schemas.refreshToken), controller.refresh);
router.post('/logout', authenticate, validate(schemas.refreshToken), controller.logout);

router.post('/otp/resend', authLimiter, validate(schemas.resendOtp), controller.resendOtp);
router.post('/otp/verify', authLimiter, validate(schemas.verifyOtp), controller.verifyOtp);

router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), controller.resetPassword);
router.post('/change-password', authenticate, validate(schemas.changePassword), controller.changePassword);

router.get('/me', authenticate, controller.getMe);

export default router;