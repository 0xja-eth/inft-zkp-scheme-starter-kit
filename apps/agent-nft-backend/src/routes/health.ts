import { Router, Request, Response } from 'express';
import { ApiResponse } from '@/types';
import { AgentNFTService } from '@/services/AgentNFTService';
import { asyncHandler } from '@/middleware/errorHandler';
import logger from '@/utils/logger';

const router: Router = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Check API health status
 *     description: Returns the health status of the API and blockchain connection
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     services:
 *                       type: object
 *                       properties:
 *                         blockchain:
 *                           type: string
 *                           example: "connected"
 *                         contract:
 *                           type: string
 *                           example: "accessible"
 *       500:
 *         description: API is unhealthy
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      blockchain: 'unknown',
      contract: 'unknown',
    },
  };

  try {
    // Initialize service to test connections
    const agentService = new AgentNFTService();
    
    // Test blockchain connection by getting contract info
    await agentService.getContractInfo();
    healthCheck.services.blockchain = 'connected';
    healthCheck.services.contract = 'accessible';

    const response: ApiResponse = {
      success: true,
      data: healthCheck,
    };

    logger.info('Health check passed', healthCheck);
    res.json(response);
  } catch (error: any) {
    healthCheck.status = 'unhealthy';
    healthCheck.services.blockchain = 'disconnected';
    healthCheck.services.contract = 'inaccessible';

    const response: ApiResponse = {
      success: false,
      data: healthCheck,
      error: 'Service Unavailable',
      message: error.message,
    };

    logger.error('Health check failed', { error: error.message, healthCheck });
    res.status(500).json(response);
  }
}));

/**
 * @swagger
 * /api/v1/health/info:
 *   get:
 *     tags: [Health]
 *     summary: Get system information
 *     description: Returns detailed system and contract information
 *     responses:
 *       200:
 *         description: System information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     contract:
 *                       type: object
 *                     wallet:
 *                       type: object
 *                     network:
 *                       type: object
 */
router.get('/info', asyncHandler(async (req: Request, res: Response) => {
  const agentService = new AgentNFTService();

  const [contractInfo, walletInfo] = await Promise.all([
    agentService.getContractInfo(),
    agentService.getWalletInfo(),
  ]);

  const systemInfo = {
    contract: contractInfo,
    wallet: {
      address: walletInfo.address,
      balance: walletInfo.balance,
      ownedTokensCount: walletInfo.ownedTokens.length,
    },
    network: {
      name: process.env.NETWORK_NAME,
      chainId: process.env.CHAIN_ID,
      rpcUrl: process.env.RPC_URL,
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  const response: ApiResponse = {
    success: true,
    data: systemInfo,
  };

  res.json(response);
}));

export default router;