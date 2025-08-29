import 'tsconfig-paths/register';
import express, {Express} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import config from './config';
import logger from './utils/logger';
import routes from './routes';
import { setupSwagger } from './swagger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { validationErrorHandler } from './middleware/validation';

const app: Express = express();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Swagger UI
}));

// CORS configuration
app.use(cors({
  origin: config.api.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.api.rateLimit.windowMs,
  max: config.api.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
}));

// Setup Swagger documentation
setupSwagger(app);

// Health check endpoint (before other routes)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Agent NFT Backend API is running!',
    version: '1.0.0',
    docs: '/api/docs',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/', routes);

// Error handling middleware
app.use(validationErrorHandler);
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`🚀 Agent NFT Backend API started`, {
    port: config.server.port,
    nodeEnv: config.server.nodeEnv,
    network: config.network.name,
    chainId: config.network.chainId,
    agentNFTAddress: config.contracts.agentNFTAddress,
    verifierAddress: config.contracts.verifierAddress,
    docsUrl: `http://localhost:${config.server.port}/api/docs`,
  });

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                🤖 Agent NFT Backend API 🤖                ║
╠═══════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${config.server.port.toString().padEnd(30)} ║
║  Docs:       http://localhost:${config.server.port}/api/docs${' '.repeat(19)} ║
║  Network:    ${config.network.name.padEnd(42)} ║
║  Chain ID:   ${config.network.chainId.toString().padEnd(42)} ║
║  Storage:    ${config.storage.type.padEnd(42)} ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production, just log the error
  if (config.server.nodeEnv === 'development') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;