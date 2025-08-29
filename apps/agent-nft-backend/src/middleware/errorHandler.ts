import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types';
import logger from '@/utils/logger';

/**
 * Global error handler middleware
 */
export function errorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: ApiResponse = {
    success: false,
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
  };

  // Handle specific error types
  if (error.code === 'ECONNREFUSED') {
    response.message = 'Unable to connect to blockchain network';
  } else if (error.code === 'CALL_EXCEPTION') {
    response.message = 'Smart contract call failed';
  } else if (error.name === 'ValidationError') {
    response.error = 'Validation Error';
    response.message = error.message;
    return res.status(400).json(response);
  }

  res.status(500).json(response);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  const response: ApiResponse = {
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  };

  res.status(404).json(response);
}

/**
 * Async error wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}