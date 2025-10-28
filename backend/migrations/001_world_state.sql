-- MiniWorld Database Schema
-- PostgreSQL 18 Migration for World State and Event Tracking

-- Create world_state table
CREATE TABLE IF NOT EXISTS world_state (
  tile_id INTEGER PRIMARY KEY CHECK (tile_id >= 0 AND tile_id < 100),
  owner VARCHAR(42) NOT NULL,
  item_type SMALLINT NOT NULL DEFAULT 0 CHECK (item_type >= 0 AND item_type <= 5),
  last_modified BIGINT NOT NULL,
  x INTEGER NOT NULL CHECK (x >= 0 AND x < 10),
  y INTEGER NOT NULL CHECK (y >= 0 AND y < 10),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(x, y)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_world_state_owner ON world_state(owner);
CREATE INDEX IF NOT EXISTS idx_world_state_coords ON world_state(x, y);
CREATE INDEX IF NOT EXISTS idx_world_state_item_type ON world_state(item_type);
CREATE INDEX IF NOT EXISTS idx_world_state_updated_at ON world_state(updated_at DESC);

-- Create events table for activity feed
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(20) NOT NULL,
  tile_id INTEGER NOT NULL,
  player_address VARCHAR(42) NOT NULL,
  item_type SMALLINT,
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_player ON events(player_address);
CREATE INDEX IF NOT EXISTS idx_events_tile ON events(tile_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_block_number ON events(block_number);

-- Create sync_status table for tracking blockchain sync
CREATE TABLE IF NOT EXISTS sync_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_synced_block BIGINT NOT NULL DEFAULT 0,
  last_sync_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial sync status
INSERT INTO sync_status (id, last_synced_block, last_sync_time)
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Initialize all 100 tiles as unclaimed
INSERT INTO world_state (tile_id, owner, item_type, last_modified, x, y)
SELECT 
  i AS tile_id,
  '0x0000000000000000000000000000000000000000' AS owner,
  0 AS item_type,
  0 AS last_modified,
  i % 10 AS x,
  i / 10 AS y
FROM generate_series(0, 99) AS i
ON CONFLICT (tile_id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for world_state
DROP TRIGGER IF EXISTS update_world_state_updated_at ON world_state;
CREATE TRIGGER update_world_state_updated_at
  BEFORE UPDATE ON world_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();