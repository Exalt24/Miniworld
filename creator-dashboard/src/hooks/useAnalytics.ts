import { useState, useEffect, useCallback } from 'react';
import { useGameSDK } from './useGameSDK';
import type { AnalyticsData, TimeSeriesData, ItemDistribution, PlayerActivity, ActivityItem } from '../types';

const ITEM_COLORS: Record<string, string> = {
  Empty: '#64748b',
  Tree: '#22c55e',
  Rock: '#6b7280',
  Flag: '#ef4444',
  Building: '#8b5cf6',
  Water: '#06b6d4',
};

export function useAnalytics() {
  const { sdk, isInitialized } = useGameSDK();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchAnalytics = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      setError(null);

      const [stats, activity] = await Promise.all([
        sdk.getStats(),
        sdk.getActivity(200),
      ]);

      const timeSeriesData = generateTimeSeriesData(activity.events);
      const itemDistribution = generateItemDistribution(stats);
      const topPlayers = await calculateTopPlayers();

      setData({
        stats,
        timeSeriesData,
        itemDistribution,
        topPlayers,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(message);
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [sdk, isInitialized, refreshTrigger]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (!isInitialized) return;

    const handleUpdate = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    sdk.on('tileClaimed', handleUpdate);
    sdk.on('itemPlaced', handleUpdate);
    sdk.on('itemRemoved', handleUpdate);
    sdk.on('worldUpdate', handleUpdate);

    return () => {
      sdk.off('tileClaimed', handleUpdate);
      sdk.off('itemPlaced', handleUpdate);
      sdk.off('itemRemoved', handleUpdate);
      sdk.off('worldUpdate', handleUpdate);
    };
  }, [sdk, isInitialized]);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { data, loading, error, refresh };
}

function generateTimeSeriesData(events: ActivityItem[]): TimeSeriesData[] {
  const claimEvents = events.filter(e => e.eventType === 'TileClaimed');
  
  const dateMap = new Map<string, number>();
  
  claimEvents.forEach(event => {
    const date = new Date(event.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });

  const sorted = Array.from(dateMap.entries())
    .map(([date, claims]) => ({ date, claims }))
    .reverse()
    .slice(0, 7);

  return sorted.reverse();
}

function generateItemDistribution(stats: any): ItemDistribution[] {
  return [
    { name: 'Empty', value: stats.itemsByType.Empty || 0, fill: ITEM_COLORS['Empty']! },
    { name: 'Tree', value: stats.itemsByType.Tree || 0, fill: ITEM_COLORS['Tree']! },
    { name: 'Rock', value: stats.itemsByType.Rock || 0, fill: ITEM_COLORS['Rock']! },
    { name: 'Flag', value: stats.itemsByType.Flag || 0, fill: ITEM_COLORS['Flag']! },
    { name: 'Building', value: stats.itemsByType.Building || 0, fill: ITEM_COLORS['Building']! },
    { name: 'Water', value: stats.itemsByType.Water || 0, fill: ITEM_COLORS['Water']! },
  ].filter(item => item.value > 0);
}

async function calculateTopPlayers(): Promise<PlayerActivity[]> {
  return [];
}