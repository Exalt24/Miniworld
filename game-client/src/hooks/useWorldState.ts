import { useState, useEffect } from 'react';
import { useGameSDK } from './useGameSDK';
import type { WorldState, Tile } from '../types';

export function useWorldState() {
  const { sdk, isInitialized } = useGameSDK();
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorldState = async () => {
    if (!sdk || !isInitialized) return;

    setLoading(true);
    setError(null);

    try {
      const state = await sdk.getWorldState();
      setWorldState(state);
    } catch (err) {
      console.error('Failed to fetch world state:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch world state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorldState();
  }, [sdk, isInitialized]);

  useEffect(() => {
    if (!sdk) return;

    const handleTileClaimed = (data: any) => {
      console.log('Tile claimed event:', data);
      fetchWorldState();
    };

    const handleItemPlaced = (data: any) => {
      console.log('Item placed event:', data);
      fetchWorldState();
    };

    const handleItemRemoved = (data: any) => {
      console.log('Item removed event:', data);
      fetchWorldState();
    };

    const handleWorldUpdate = () => {
      console.log('World update event');
      fetchWorldState();
    };

    sdk.on('tileClaimed', handleTileClaimed);
    sdk.on('itemPlaced', handleItemPlaced);
    sdk.on('itemRemoved', handleItemRemoved);
    sdk.on('worldUpdate', handleWorldUpdate);

    return () => {
      sdk.off('tileClaimed', handleTileClaimed);
      sdk.off('itemPlaced', handleItemPlaced);
      sdk.off('itemRemoved', handleItemRemoved);
      sdk.off('worldUpdate', handleWorldUpdate);
    };
  }, [sdk]);

  const getTile = (tileId: number): Tile | null => {
    if (!worldState) return null;
    return worldState.tiles.find((t) => t.tileId === tileId) || null;
  };

  const refreshWorldState = () => {
    fetchWorldState();
  };

  return {
    worldState,
    loading,
    error,
    getTile,
    refreshWorldState,
  };
}