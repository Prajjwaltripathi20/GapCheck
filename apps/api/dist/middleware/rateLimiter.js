"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalRateLimiter = exports.analysisRateLimiter = exports.authRateLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
function createRateLimiter(options) {
    const store = new Map();
    // Periodically purge expired records to prevent memory leak
    const purgeInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of store.entries()) {
            if (now > record.resetTime) {
                store.delete(key);
            }
        }
    }, Math.max(options.windowMs, 60000));
    if (purgeInterval.unref) {
        purgeInterval.unref();
    }
    return (req, res, next) => {
        // Skip rate limiting during automated test runs
        if (process.env.NODE_ENV === 'test' || process.env.SKIP_RATE_LIMIT === 'true') {
            next();
            return;
        }
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${options.keyPrefix || 'rl'}:${ip}`;
        const now = Date.now();
        const record = store.get(key);
        if (!record || now > record.resetTime) {
            store.set(key, { count: 1, resetTime: now + options.windowMs });
            res.setHeader('X-RateLimit-Limit', options.max);
            res.setHeader('X-RateLimit-Remaining', options.max - 1);
            next();
            return;
        }
        record.count++;
        const remaining = Math.max(0, options.max - record.count);
        res.setHeader('X-RateLimit-Limit', options.max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
        if (record.count > options.max) {
            res.status(429).json({
                error: 'TOO_MANY_REQUESTS',
                message: options.message || 'Too many requests. Please try again later.',
                retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
            });
            return;
        }
        next();
    };
}
// 30 auth requests per 15 minutes per IP (login / register)
exports.authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    keyPrefix: 'auth',
});
// 20 analysis creation requests per hour per IP
exports.analysisRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Analysis quota reached for this hour. Please try again shortly.',
    keyPrefix: 'analysis',
});
// 600 general requests per 15 minutes per IP
exports.generalRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 600,
    message: 'Too many requests. Please slow down.',
    keyPrefix: 'gen',
});
//# sourceMappingURL=rateLimiter.js.map