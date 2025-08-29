import { Router } from 'express';
import agentRoutes from './agent';
import healthRoutes from './health';

const router: Router = Router();

// Mount routes
router.use('/api/v1/agent', agentRoutes);
router.use('/api/v1/health', healthRoutes);

export default router;