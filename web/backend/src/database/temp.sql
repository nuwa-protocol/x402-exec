-- x402 Scanner Backend Database Schema
-- PostgreSQL / Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS x402_temp_transactions (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  network VARCHAR(50) NOT NULL,
  time BIGINT NOT NULL,
  from_addr VARCHAR(42) NOT NULL,
  to_addr VARCHAR(42) NOT NULL,
  hook VARCHAR(42) NOT NULL,
  hookName VARCHAR(255) NOT NULL,
  amount NUMERIC(78, 0) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_tx_hash UNIQUE (tx_hash)
);

CREATE TABLE IF NOT EXISTS x402_temp_hooks (
  id SERIAL PRIMARY KEY,
  
  -- Hook 基础信息
  address VARCHAR(42) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  network VARCHAR(50) NOT NULL REFERENCES networks(name) ON DELETE CASCADE,
  data TEXT NOT NULL,
  facilitatorFee BigInt NOT NULL DEFAULT 0,
  pay_to VARCHAR(42) NOT NULL,
  settlement_router VARCHAR(42) NOT NULL,
  version VARCHAR(20),
  
  -- 统计信息 (缓存)
  total_transactions INTEGER DEFAULT 0,
  total_volume NUMERIC(78, 0) DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 唯一约束
  CONSTRAINT unique_hook_network UNIQUE (address, network)
);

-- Indexes for hooks
CREATE INDEX IF NOT EXISTS idx_hooks_address ON hooks(address);
CREATE INDEX IF NOT EXISTS idx_hooks_network ON hooks(network);

-- Comments for hooks
COMMENT ON TABLE hooks IS 'Registered settlement hooks';
COMMENT ON COLUMN hooks.total_transactions IS 'Cached total transaction count';
COMMENT ON COLUMN hooks.total_volume IS 'Cached total volume in token wei';

-- ==============================================
-- Statistics Table (统计数据缓存)
-- ==============================================
CREATE TABLE IF NOT EXISTS x402_temp_statistics (
  id SERIAL PRIMARY KEY,
  
  -- 统计维度 (NULL 表示全局统计)
  hook VARCHAR(42),
  facilitator VARCHAR(42),
  date DATE,
  
  -- 统计指标
  transaction_count INTEGER DEFAULT 0,
  total_volume NUMERIC(78, 0) DEFAULT 0,
  total_volume_usd NUMERIC(20, 2) DEFAULT 0,
  unique_payers INTEGER DEFAULT 0,
  unique_facilitators INTEGER DEFAULT 0,
  avg_transaction_size NUMERIC(20, 2) DEFAULT 0,
  avg_facilitator_fee NUMERIC(20, 2) DEFAULT 0,
  
  -- 时间戳
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 唯一约束 (支持部分 NULL)
  CONSTRAINT unique_stats UNIQUE NULLS NOT DISTINCT (network, hook, facilitator, date)
);

-- Indexes for statistics
CREATE INDEX IF NOT EXISTS idx_stats_network_date ON statistics(network, date) WHERE network IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stats_hook_date ON statistics(hook, date) WHERE hook IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stats_facilitator_date ON statistics(facilitator, date) WHERE facilitator IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stats_date ON statistics(date) WHERE date IS NOT NULL;

-- Comments for statistics
COMMENT ON TABLE statistics IS 'Pre-computed statistics for performance';
COMMENT ON COLUMN statistics.date IS 'NULL for overall statistics, date for daily statistics';

-- ==============================================
-- Functions and Triggers
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for hooks table
DROP TRIGGER IF EXISTS update_hooks_updated_at ON hooks;
CREATE TRIGGER update_hooks_updated_at
  BEFORE UPDATE ON hooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for statistics table
DROP TRIGGER IF EXISTS update_statistics_updated_at ON statistics;
CREATE TRIGGER update_statistics_updated_at
  BEFORE UPDATE ON statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- Views (Optional - for easier querying)
-- ==============================================

-- View: Latest transactions with hook names
CREATE OR REPLACE VIEW transactions_with_hooks AS
SELECT 
  t.*,
  h.name as hook_name,
  h.category as hook_category
FROM transactions t
LEFT JOIN hooks h ON t.hook = h.address AND t.network = h.network;

-- View: Network summary statistics
CREATE OR REPLACE VIEW network_stats AS
SELECT 
  n.name as network,
  n.type,
  COUNT(t.id) as total_transactions,
  SUM(t.amount) as total_volume,
  COUNT(DISTINCT t.payer) as unique_payers,
  COUNT(DISTINCT t.facilitator) as unique_facilitators,
  MAX(t.block_timestamp) as last_transaction_time
FROM networks n
LEFT JOIN transactions t ON n.name = t.network
GROUP BY n.name, n.type;

-- View: Hook statistics
CREATE OR REPLACE VIEW hook_stats AS
SELECT 
  h.address,
  h.network,
  h.name,
  h.category,
  COUNT(t.id) as transaction_count,
  SUM(t.amount) as total_volume,
  COUNT(DISTINCT t.payer) as unique_users,
  MAX(t.block_timestamp) as last_used
FROM hooks h
LEFT JOIN transactions t ON h.address = t.hook AND h.network = t.network
GROUP BY h.address, h.network, h.name, h.category;

-- ==============================================
-- Sample Data (Optional - for testing)
-- ==============================================

-- This will be inserted by seed-networks.ts script

