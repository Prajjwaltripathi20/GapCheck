"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.generateToken = generateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is missing in production');
        }
        return 'dev-jwt-secret-proofcheck-2024';
    }
    return secret;
}
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const secret = getJwtSecret();
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (!decoded || !decoded.userId) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token payload.' });
            return;
        }
        req.userId = decoded.userId;
        next();
    }
    catch (err) {
        res.status(401).json({
            error: 'UNAUTHORIZED',
            message: err.name === 'TokenExpiredError'
                ? 'Your session has expired. Please log in again.'
                : 'Invalid or expired token. Please log in again.',
        });
    }
}
function generateToken(userId) {
    const secret = getJwtSecret();
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') });
}
//# sourceMappingURL=auth.js.map