/**
 * x402 Scanner Backend
 * 
 * Main entry point
 */

import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { initDatabase, testConnection } from './database/db.js';
import { apiRouter } from './routes/index.js';

const app = express();

/**
 * Initialize application
 */
async function initialize() {
  try {
    logger.info('='.repeat(70));
    logger.info('x402 Scanner Backend');
    logger.info('='.repeat(70));
    logger.info('');

    // Initialize database
    logger.info('Initializing database connection...');
    initDatabase();
    
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }
    logger.info('✅ Database connected');
    logger.info('');

    // Setup Express middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
        });
      });
      next();
    });

    app.use('/api', apiRouter);

    // Root endpoint
    app.get('/', (_req, res) => {
      res.json({
        name: 'x402 Scanner Backend',
        version: '1.0.0',
        endpoints: {
          stats: '/api/stats',
        },
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint not found: ${req.method} ${req.path}`,
        },
      });
    });

    // Error handler
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'An internal error occurred',
        },
      });
    });

    // Start HTTP server
    const port = 3003;
    app.listen(port, async () => {
      logger.info('');
      logger.info('='.repeat(70));
      logger.info(`🚀 Server running on http://localhost:${port}`);
      logger.info('='.repeat(70));
      logger.info('');
      logger.info('API Endpoints:');
      logger.info(`  Health:       http://localhost:${port}/api/health`);
      logger.info(`  Transactions: http://localhost:${port}/api/transactions`);
      logger.info(`  Statistics:   http://localhost:${port}/api/stats`);
      logger.info(`  Hooks:        http://localhost:${port}/api/hooks`);
      logger.info(`  Networks:     http://localhost:${port}/api/networks`);
      logger.info('');

      logger.info('='.repeat(70));
      logger.info('✅ Application initialized successfully');
      logger.info('='.repeat(70));
      logger.info('');
    });

  } catch (error) {
    logger.error('');
    logger.error('='.repeat(70));
    logger.error('❌ Application initialization failed');
    logger.error('='.repeat(70));
    logger.error('');
    logger.error('Error details:');
    logger.error(error);
    logger.error('');
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('');
  logger.info('Shutting down gracefully...');

  try {
    // Stop indexer
    logger.info('✅ Indexer stopped');

    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  shutdown();
});

// Start application
initialize();

