import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const resetColor = '\x1b[0m';
    
    console.log(
      `${req.method} ${req.path} ${statusColor}${res.statusCode}${resetColor} ${duration}ms`
    );
  });
  
  next();
}

export function validateTileId(req: Request, res: Response, next: NextFunction) {
  const tileId = parseInt(req.params.id);
  
  if (isNaN(tileId) || tileId < 0 || tileId >= 100) {
    res.status(400).json({
      error: 'Invalid tile ID',
      message: 'Tile ID must be between 0 and 99',
    });
    return;
  }
  
  req.params.id = tileId.toString();
  next();
}

export function validateAddress(req: Request, res: Response, next: NextFunction) {
  const address = req.params.address;
  
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({
      error: 'Invalid address',
      message: 'Address must be a valid Ethereum address (0x...)',
    });
    return;
  }
  
  next();
}