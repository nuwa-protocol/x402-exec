import { Router } from 'express';
import transactionsRouter from './transaction';
import statsRouter from './stats';

const router: Router = Router();
router.use('/transactions', transactionsRouter);
router.use('/stats', statsRouter);

export default router;