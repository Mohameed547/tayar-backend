import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';

export function issueTokenPair(payload) {
    const accessToken = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, ENV.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
}

export function verifyRefreshToken(token) {
    return jwt.verify(token, ENV.JWT_REFRESH_SECRET);
}