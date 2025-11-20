/**
 * Statistics routes
 */

import { Router, type Request, type Response } from 'express';
import { formatErrorResponse } from '../utils/errors.js';
import {
  getTempTransactions,
  getTempTransactionsCount
} from '../database/models/stats.js';

const transactionsRouter: Router = Router();

/**
 * GET /api/stats
 * Get aggregated statistics
 */
transactionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const transactions = await getTempTransactions(page, limit);
    const totalItems = await getTempTransactionsCount();
    res.json({
      success: true,
      data: {
        items:transactions,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    res.status(500).json(formatErrorResponse(error));
  }
});

export default transactionsRouter;

