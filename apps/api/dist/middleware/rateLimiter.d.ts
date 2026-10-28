import { Request, Response, NextFunction } from 'express';
export declare function createRateLimiter(options: {
    windowMs: number;
    max: number;
    message?: string;
    keyPrefix?: string;
}): (req: Request, res: Response, next: NextFunction) => void;
export declare const authRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const analysisRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const generalRateLimiter: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rateLimiter.d.ts.map