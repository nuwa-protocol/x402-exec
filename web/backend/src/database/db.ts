import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('------ ')
console.log(supabaseUrl, supabaseAnonKey);

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Supabase client instance
 */
let supabase: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
export function initDatabase(): SupabaseClient {
  if (supabase) {
    return supabase;
  }

  try {
    supabase = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    logger.info('Database client initialized');
    return supabase;
  } catch (error) {
    logger.error('Failed to initialize database client', error);
    throw new DatabaseError('Failed to initialize database', error);
  }
}

/**
 * Get Supabase client instance
 */
export function getDatabase(): SupabaseClient {
  if (!supabase) {
    return initDatabase();
  }
  return supabase;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getDatabase();
    const { error } = await db.from('networks').select('count', { count: 'exact', head: true });
    
    if (error) {
      logger.error('Database connection test failed', error);
      return false;
    }

    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error);
    return false;
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (supabase) {
    // Supabase client doesn't need explicit closing
    supabase = null;
    logger.info('Database client closed');
  }
}

/**
 * Handle database errors
 */
export function handleDatabaseError(error: unknown, operation: string): never {
  logger.error(`Database error during ${operation}`, error);
  
  if (error && typeof error === 'object' && 'message' in error) {
    throw new DatabaseError(
      `Database error during ${operation}: ${(error as Error).message}`,
      error
    );
  }
  
  throw new DatabaseError(`Database error during ${operation}`, error);
}

