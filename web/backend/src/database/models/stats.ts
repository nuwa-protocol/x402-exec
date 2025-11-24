import { getDatabase, handleDatabaseError } from '../db.js';

/**
 * Hook stats data structure from database
 */
interface HookStats {
  total_volume: string | number | null;
  unique_users: number | null;
  total_transactions: number | null;
}

export async function getTempOverallStats() {
  try {
    const db = getDatabase();
    const { data, error } = await db.from('x402_hooks').select('*');
    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    handleDatabaseError(error, 'getTempOverallStats');
  }
}

/**
 * Get aggregated statistics across all hooks
 * Sums total_volume, unique_users, and total_transactions from all hooks
 */
export async function getAggregatedStats() {
  try {
    const db = getDatabase();
    const { data, error } = await db
      .from('x402_hooks')
      .select('total_volume, unique_users, total_transactions');
    
    if (error) {
      throw error;
    }

    // Aggregate the statistics
    const aggregated = {
      total_volume: '0',
      unique_users: 0,
      total_transactions: 0,
    };

    if (data && data.length > 0) {
      // Sum total_volume (handling BigInt/Numeric as string)
      const totalVolumeSum = (data as HookStats[]).reduce((sum: string, hook: HookStats) => {
        const volume = hook.total_volume ? String(hook.total_volume) : '0';
        return (BigInt(sum) + BigInt(volume)).toString();
      }, '0');

      // Sum unique_users (using Set to count unique users across all hooks)
      // Since we're summing unique_users per hook, we need to be careful
      // For now, we'll sum the counts (assuming they represent unique users per hook)
      const uniqueUsersSum = (data as HookStats[]).reduce((sum: number, hook: HookStats) => {
        return sum + (hook.unique_users || 0);
      }, 0);

      // Sum total_transactions
      const totalTransactionsSum = (data as HookStats[]).reduce((sum: number, hook: HookStats) => {
        return sum + (hook.total_transactions || 0);
      }, 0);

      aggregated.total_volume = totalVolumeSum;
      aggregated.unique_users = uniqueUsersSum;
      aggregated.total_transactions = totalTransactionsSum;
    }

    return aggregated;
  } catch (error) {
    handleDatabaseError(error, 'getAggregatedStats');
  }
}

export async function getTempTransactions(page: number, limit: number) {
  try {
    const db = getDatabase();
    const { data, error } = await db.from('x402_transactions').select('*').order('block_timestamp', { ascending: false }).range((page - 1) * limit, page * limit - 1);

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    handleDatabaseError(error, 'getTempTransactions');
  }
}

export async function getTempTransactionsCount() {
  try {
    const db = getDatabase();
    const { count, error } = await db.from('x402_transactions').select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }
    return count || 0;
  } catch (error) {
    handleDatabaseError(error, 'getTempTransactionsCount');
  }
}

