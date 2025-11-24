-- x402 Scanner Backend Database Schema
-- PostgreSQL / Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- Networks Table (网络配置)
-- ==============================================
-- CREATE TABLE IF NOT EXISTS networks (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(50) UNIQUE NOT NULL,
--   chain_id INTEGER UNIQUE NOT NULL,
--   settlement_router VARCHAR(42) NOT NULL,
--   explorer_api_url VARCHAR(255) NOT NULL,
--   explorer_api_type VARCHAR(20) NOT NULL CHECK (explorer_api_type IN ('basescan', 'oklink')),
--   usdc_address VARCHAR(42) NOT NULL,
--   type VARCHAR(20) NOT NULL CHECK (type IN ('mainnet', 'testnet')),
--   is_active BOOLEAN DEFAULT true,
--   last_indexed_timestamp BIGINT DEFAULT 0,
--   last_indexed_block_height VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Indexes for networks
-- CREATE INDEX IF NOT EXISTS idx_networks_name ON networks(name);
-- CREATE INDEX IF NOT EXISTS idx_networks_is_active ON networks(is_active);

-- Comments for networks
-- COMMENT ON TABLE networks IS 'Blockchain network configurations';
-- COMMENT ON COLUMN networks.last_indexed_timestamp IS 'Unix timestamp of last indexed block';

-- ==============================================
-- Transactions Table (交易记录)
-- ==============================================
CREATE TABLE IF NOT EXISTS x402_transactions (
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  network VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- block_number BIGINT NOT NULL,
  block_timestamp BIGINT NOT NULL,
  from_addr VARCHAR(42) NOT NULL,
  to_addr VARCHAR(42) NOT NULL,
  hook VARCHAR(42) NOT NULL,
  hook_name VARCHAR(255) NOT NULL,
  amount NUMERIC(78, 0) NOT NULL,
  version VARCHAR(20) NOT NULL,
  facilitator BIGINT NOT NULL,

  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),

  CONSTRAINT unique_x402_transactions_tx_hash UNIQUE (tx_hash)
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_hook ON transactions(hook) WHERE hook IS NOT NULL;

-- Comments for transactions
COMMENT ON TABLE transactions IS 'Settlement transactions from SettlementRouter contract';
COMMENT ON COLUMN transactions.context_key IS 'Unique settlement context identifier (from Settled event)';
COMMENT ON COLUMN transactions.amount IS 'Transaction amount in token wei (uint256)';
COMMENT ON COLUMN transactions.facilitator_fee IS 'Facilitator fee in token wei (uint256)';

-- ==============================================
-- Hooks Table (Hook 注册信息)
-- ==============================================
CREATE TABLE IF NOT EXISTS hooks (
  id SERIAL PRIMARY KEY,

  -- Hook 基础信息
  address VARCHAR(42) NOT NULL,
  network VARCHAR(50) NOT NULL REFERENCES networks(name) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Hook 元数据
  category VARCHAR(50),
  version VARCHAR(20),
  author VARCHAR(100),
  website VARCHAR(255),
  github VARCHAR(255),

  -- 验证状态
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by VARCHAR(42),

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
CREATE INDEX IF NOT EXISTS idx_hooks_category ON hooks(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hooks_verified ON hooks(is_verified);

-- Comments for hooks
COMMENT ON TABLE hooks IS 'Registered settlement hooks';
COMMENT ON COLUMN hooks.total_transactions IS 'Cached total transaction count';
COMMENT ON COLUMN hooks.total_volume IS 'Cached total volume in token wei';

-- ==============================================
-- Statistics Table (统计数据缓存)
-- ==============================================
CREATE TABLE IF NOT EXISTS statistics (
  id SERIAL PRIMARY KEY,

  -- 统计维度 (NULL 表示全局统计)
  network VARCHAR(50) REFERENCES networks(name) ON DELETE CASCADE,
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
