import { Router } from 'express';
import transactionsRouter from './transaction.js';
import statsRouter from './stats.js';

const apiRouter: Router = Router();
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/stats', statsRouter);

export { apiRouter };