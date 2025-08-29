import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '@/types';
import logger from '@/utils/logger';

// Common validation schemas
const agentCapabilitySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  input: Joi.string().optional(),
  output: Joi.string().optional(),
  preconditions: Joi.array().items(Joi.string()).optional(),
  postconditions: Joi.array().items(Joi.string()).optional(),
});

const metadataSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  avatar: Joi.string().uri().optional(),
  externalUrl: Joi.string().uri().optional(),
  version: Joi.string().optional(),
  model: Joi.string().optional(),
  personality: Joi.string().optional(),
  capabilities: Joi.array().items(agentCapabilitySchema).optional(),
  attributes: Joi.object().pattern(Joi.string(), Joi.alternatives(Joi.string(), Joi.number())).optional(),
});

// Validation schemas for different endpoints
export const validationSchemas = {
  mint: Joi.object({
    metadata: metadataSchema.required(),
  }),

  transfer: Joi.object({
    tokenId: Joi.number().integer().positive().required(),
    recipientAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    recipientEncPublicKey: Joi.string().required(),
    signature: Joi.string().pattern(/^0x[a-fA-F0-9]+$/).required(),
  }),

  clone: Joi.object({
    tokenId: Joi.number().integer().positive().required(),
    recipientAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    modifications: metadataSchema.optional(),
  }),

  update: Joi.object({
    tokenId: Joi.number().integer().positive().required(),
    updatedMetadata: metadataSchema.required(),
  }),

  tokenId: Joi.object({
    tokenId: Joi.number().integer().positive().required(),
  }),

  authorize: Joi.object({
    tokenId: Joi.number().integer().positive().required(),
    userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  }),

  ownedTokens: Joi.object({
    ownerAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    maxTokenId: Joi.number().integer().positive().default(100),
  }),
};

/**
 * Middleware factory for request validation
 */
export function validate(schema: Joi.ObjectSchema, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query;

    const { error, value } = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.warn('Validation failed', { 
        source,
        errors: error.details,
        data: data,
      });

      const response: ApiResponse = {
        success: false,
        error: 'Validation Error',
        message: errorMessage,
      };

      return res.status(400).json(response);
    }

    // Replace the original data with validated data
    if (source === 'body') {
      req.body = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.query = value;
    }

    next();
  };
}

/**
 * Middleware for handling validation errors
 */
export function validationErrorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  if (error.isJoi) {
    const response: ApiResponse = {
      success: false,
      error: 'Validation Error',
      message: error.details.map((detail: any) => detail.message).join(', '),
    };

    return res.status(400).json(response);
  }

  next(error);
}