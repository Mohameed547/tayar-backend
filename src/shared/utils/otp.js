import crypto from 'crypto';

export function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

export function getOtpExpiry() {
    return new Date(Date.now() + 1 * 60 * 1000);
}

export function verifyOtp(otp, hashedOtp, expiryDate) {
    if (new Date() > new Date(expiryDate)) {
        return { valid: false, reason: 'expired' };
    }
    const currentHash = hashOtp(otp);
    if (currentHash !== hashedOtp) {
        return { valid: false, reason: 'invalid' };
    }
    return { valid: true };
}
