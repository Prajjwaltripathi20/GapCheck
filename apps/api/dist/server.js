"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const resume_1 = __importDefault(require("./routes/resume"));
const github_1 = __importDefault(require("./routes/github"));
const job_1 = __importDefault(require("./routes/job"));
const analysis_1 = __importDefault(require("./routes/analysis"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const rateLimiter_1 = require("./middleware/rateLimiter");
const db_1 = require("./db");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Security headers
app.use((0, helmet_1.default)());
// Production CORS configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const isDevOrTest = process.env.NODE_ENV !== 'production';
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Requests with no origin (e.g., mobile apps, curl, server-to-server)
        if (!origin)
            return callback(null, true);
        // In development or test, allow local origins
        if (isDevOrTest && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            return callback(null, true);
        }
        // Check configured allowed origins (including wildcards like *.vercel.app)
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed === origin)
                return true;
            if (allowed.includes('*')) {
                const pattern = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                return pattern.test(origin);
            }
            return false;
        });
        if (isAllowed) {
            return callback(null, true);
        }
        return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Request logging (sanitized, no sensitive credential dumps)
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (req) => req.url === '/api/health',
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint (for Render and uptime monitoring)
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'gapcheck-api',
    });
});
// Ensure database tables and schemas are ready before any API route executes
app.use(async (_req, _res, next) => {
    try {
        await (0, db_1.ensureDbReady)();
        next();
    }
    catch (err) {
        next(err);
    }
});
// Global API rate limiting
app.use('/api', rateLimiter_1.generalRateLimiter);
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/resume', resume_1.default);
app.use('/api/github', github_1.default);
app.use('/api/job', job_1.default);
app.use('/api/analysis', analysis_1.default);
app.use('/api/dashboard', dashboard_1.default);
// Production-safe Error handling
app.use((err, _req, res, _next) => {
    if (err.message === 'CORS_ORIGIN_NOT_ALLOWED') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'CORS origin not allowed' });
        return;
    }
    const isProd = process.env.NODE_ENV === 'production';
    const status = typeof err.status === 'number' ? err.status : 500;
    console.error('[API Error]', {
        status,
        message: err.message,
        code: err.code || 'UNHANDLED_ERROR',
    });
    res.status(status).json({
        error: isProd && status === 500 ? 'INTERNAL_ERROR' : (err.code || 'SERVER_ERROR'),
        message: isProd && status === 500
            ? 'An unexpected error occurred. Please try again.'
            : (err.message || 'Internal server error'),
    });
});
// Bind to 0.0.0.0 for container / cloud hosting platforms (Render, Railway, etc.)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GapCheck API running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map