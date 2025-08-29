import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { AgentNFTService } from '@/services/AgentNFTService';
import { validate, validationSchemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/errorHandler';
import logger from '@/utils/logger';

const router: Router = Router();

// Initialize service
const agentService = new AgentNFTService();

/**
 * @swagger
 * components:
 *   schemas:
 *     Metadata:
 *       type: object
 *       required:
 *         - name
 *         - description
 *       properties:
 *         name:
 *           type: string
 *           example: "Aurora Assistant"
 *         description:
 *           type: string
 *           example: "AI assistant for Web3 interactions"
 *         avatar:
 *           type: string
 *           format: uri
 *           example: "https://example.com/avatar.png"
 *         version:
 *           type: string
 *           example: "1.0.0"
 *         model:
 *           type: string
 *           example: "gpt-4"
 *         personality:
 *           type: string
 *           example: "Helpful and friendly"
 *         capabilities:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *         attributes:
 *           type: object
 *           additionalProperties: true
 */

/**
 * @swagger
 * /api/v1/agent/mint:
 *   post:
 *     tags: [Agent NFT]
 *     summary: Mint a new Agent NFT
 *     description: Creates a new Agent NFT with the provided metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metadata
 *             properties:
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 *     responses:
 *       200:
 *         description: Agent NFT minted successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/mint', 
  validate(validationSchemas.mint), 
  asyncHandler(async (req: Request, res: Response) => {
    const { metadata } = req.body;

    logger.info('Mint request received', { 
      agentName: metadata.name, 
      model: metadata.model,
    });

    const result = await agentService.mint(metadata);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Agent NFT minted successfully',
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/v1/agent/transfer:
 *   post:
 *     tags: [Agent NFT]
 *     summary: Transfer an Agent NFT
 *     description: Transfer an Agent NFT to another address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *               - recipientAddress
 *               - recipientEncPublicKey
 *               - signature
 *             properties:
 *               tokenId:
 *                 type: number
 *                 example: 1
 *               recipientAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               recipientEncPublicKey:
 *                 type: string
 *                 example: "BO6ehe7KGZ4hxqJEUTHos8EvJ5zvRIS0mFF/85Lf4kA="
 *               signature:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]+$'
 *     responses:
 *       200:
 *         description: Agent NFT transferred successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/transfer', 
  validate(validationSchemas.transfer), 
  asyncHandler(async (req: Request, res: Response) => {
    const { tokenId, recipientAddress, recipientEncPublicKey, signature } = req.body;

    logger.info('Transfer request received', { 
      tokenId, 
      recipientAddress,
    });

    const result = await agentService.transfer(
      tokenId, 
      recipientAddress, 
      recipientEncPublicKey, 
      signature
    );

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Agent NFT transferred successfully',
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/v1/agent/clone:
 *   post:
 *     tags: [Agent NFT]
 *     summary: Clone an Agent NFT
 *     description: Create a clone of an existing Agent NFT for another address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *               - recipientAddress
 *             properties:
 *               tokenId:
 *                 type: number
 *                 example: 1
 *               recipientAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               modifications:
 *                 $ref: '#/components/schemas/Metadata'
 *     responses:
 *       200:
 *         description: Agent NFT cloned successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/clone', 
  validate(validationSchemas.clone), 
  asyncHandler(async (req: Request, res: Response) => {
    const { tokenId, recipientAddress, modifications } = req.body;

    logger.info('Clone request received', { 
      sourceTokenId: tokenId, 
      recipientAddress,
      hasModifications: !!modifications,
    });

    const result = await agentService.clone(tokenId, recipientAddress, modifications);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Agent NFT cloned successfully',
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/v1/agent/update:
 *   post:
 *     tags: [Agent NFT]
 *     summary: Update an Agent NFT
 *     description: Update the metadata of an existing Agent NFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *               - updatedMetadata
 *             properties:
 *               tokenId:
 *                 type: number
 *                 example: 1
 *               updatedMetadata:
 *                 $ref: '#/components/schemas/Metadata'
 *     responses:
 *       200:
 *         description: Agent NFT updated successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/update', 
  validate(validationSchemas.update), 
  asyncHandler(async (req: Request, res: Response) => {
    const { tokenId, updatedMetadata } = req.body;

    logger.info('Update request received', { 
      tokenId, 
      updateFields: Object.keys(updatedMetadata),
    });

    const result = await agentService.update(tokenId, updatedMetadata);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Agent NFT updated successfully',
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/v1/agent/{tokenId}:
 *   get:
 *     tags: [Agent NFT]
 *     summary: Get Agent NFT information
 *     description: Retrieve detailed information about a specific Agent NFT
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: number
 *         description: Token ID of the Agent NFT
 *     responses:
 *       200:
 *         description: Token information retrieved successfully
 *       400:
 *         description: Invalid token ID
 *       404:
 *         description: Token not found
 *       500:
 *         description: Internal server error
 */
router.get('/:tokenId', 
  validate(validationSchemas.tokenId, 'params'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { tokenId } = req.params;
    const tokenIdNumber = parseInt(tokenId);

    logger.info('Token info request received', { tokenId: tokenIdNumber });

    // Check if token exists
    const exists = await agentService.tokenExists(tokenIdNumber);
    if (!exists) {
      const response: ApiResponse = {
        success: false,
        error: 'Not Found',
        message: `Token ${tokenIdNumber} does not exist`,
      };
      return res.status(404).json(response);
    }

    const tokenInfo = await agentService.getTokenInfo(tokenIdNumber);

    const response: ApiResponse = {
      success: true,
      data: tokenInfo,
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/v1/agent/tokens/existing:
 *   get:
 *     tags: [Agent NFT]
 *     summary: Get all existing tokens
 *     description: Retrieve a list of all existing Agent NFT token IDs
 *     parameters:
 *       - in: query
 *         name: maxTokenId
 *         schema:
 *           type: number
 *           default: 100
 *         description: Maximum token ID to scan
 *     responses:
 *       200:
 *         description: Existing tokens retrieved successfully
 */
router.get('/tokens/existing', asyncHandler(async (req: Request, res: Response) => {
  const maxTokenId = parseInt(req.query.maxTokenId as string) || 100;

  logger.info('Existing tokens request received', { maxTokenId });

  const existingTokens = await agentService.getExistingTokens(maxTokenId);

  const response: ApiResponse = {
    success: true,
    data: {
      tokens: existingTokens,
      count: existingTokens.length,
      maxScanned: maxTokenId,
    },
  };

  res.json(response);
}));

/**
 * @swagger
 * /api/v1/agent/tokens/owned:
 *   get:
 *     tags: [Agent NFT]
 *     summary: Get tokens owned by address
 *     description: Retrieve tokens owned by a specific address
 *     parameters:
 *       - in: query
 *         name: ownerAddress
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Owner address to check
 *       - in: query
 *         name: maxTokenId
 *         schema:
 *           type: number
 *           default: 100
 *         description: Maximum token ID to scan
 *     responses:
 *       200:
 *         description: Owned tokens retrieved successfully
 *       400:
 *         description: Invalid address format
 */
router.get('/tokens/owned', 
  validate(validationSchemas.ownedTokens, 'query'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { ownerAddress, maxTokenId } = req.query as any;

    logger.info('Owned tokens request received', { ownerAddress, maxTokenId });

    const ownedTokens = await agentService.getOwnedTokens(ownerAddress, maxTokenId);

    const response: ApiResponse = {
      success: true,
      data: {
        ownerAddress,
        tokens: ownedTokens,
        count: ownedTokens.length,
        maxScanned: maxTokenId,
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/v1/agent/authorize:
 *   post:
 *     tags: [Agent NFT]
 *     summary: Authorize usage for a user
 *     description: Grant usage authorization for a specific Agent NFT to a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *               - userAddress
 *             properties:
 *               tokenId:
 *                 type: number
 *                 example: 1
 *               userAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *     responses:
 *       200:
 *         description: Usage authorized successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/authorize', 
  validate(validationSchemas.authorize), 
  asyncHandler(async (req: Request, res: Response) => {
    const { tokenId, userAddress } = req.body;

    logger.info('Authorize usage request received', { tokenId, userAddress });

    const result = await agentService.authorizeUsage(tokenId, userAddress);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Usage authorized successfully',
    };

    res.json(response);
  })
);

export default router;