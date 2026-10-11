// Row shape of the world_state table (see migrations/001_world_state.sql).
// pg returns BIGINT columns as strings, so last_modified is a string here.
export interface WorldStateTile {
  tile_id: number;
  owner: string;
  item_type: number;
  last_modified: string;
  x: number;
  y: number;
  updated_at?: Date;
}

export interface TileQueryResult {
  tile_id: number;
  owner: string;
  item_type: number;
  last_modified: string;
  x: number;
  y: number;
}

export interface PlayerTilesResult {
  tiles: TileQueryResult[];
  total_count: number;
}

export interface GameStats {
  total_claims: number;
  unique_players: number;
  total_events: number;
  items_by_type: { [key: number]: number };
}
