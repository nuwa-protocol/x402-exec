/**
 * Statistics routes
 */

import { Router, type Request, type Response } from 'express';
import { createLogger } from '../utils/logger.js';
import { formatErrorResponse } from '../utils/errors.js';
import {
  getTempOverallStats,
  getAggregatedStats
} from '../database/models/stats.js';

const statsRouter: Router = Router();
const log = createLogger('Routes:Stats');

/**
 * GET /api/stats
 * Get aggregated statistics
 */
statsRouter.get('/hooks', async (_: Request, res: Response) => {
  try {
    const overview = await getTempOverallStats();

    res.json({
      success: true,
      data: {
        overview,
      },
    });
  } catch (error) {
    log.error('Failed to get statistics:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

statsRouter.get('/overview', async (_: Request, res: Response) => {
  try {
    const overview = await getAggregatedStats();

    res.json({
      success: true,
      data: {
        overview,
      },
    });
  } catch (error) {
    log.error('Failed to get statistics:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

export default statsRouter;

