import { useState, useEffect } from 'react';
import { useGameSDK } from './useGameSDK';
import { useWorldState } from './useWorldState';

interface TransactionState {
  pending: boolean;
  type: 'claim' | 'place' | 'remove' | null;
  hash: string | null;
  error: string | null;
}

export function useSelectedTile() {
  const { sdk, isConnected, connectedAddress } = useGameSDK();
  const { getTile, refreshWorldState } = useWorldState();
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [transaction, setTransaction] = useState<TransactionState>({
    pending: false,
    type: null,
    hash: null,
    error: null,
  });

  const selectedTile = selectedTileId !== null ? getTile(selectedTileId) : null;

  const isOwnedByUser =
    selectedTile &&
    connectedAddress &&
    selectedTile.owner.toLowerCase() === connectedAddress.toLowerCase() &&
    selectedTile.owner !== '0x0000000000000000000000000000000000000000';

  const canClaim =
    isConnected &&
    selectedTile &&
    selectedTile.owner === '0x0000000000000000000000000000000000000000';

  const canPlaceItem = isConnected && isOwnedByUser;
  const canRemoveItem = isConnected && isOwnedByUser && selectedTile && selectedTile.itemType !== 0;

  useEffect(() => {
    if (!sdk) return;

    const handleTransactionStarted = (data: any) => {
      if (data.tileId === selectedTileId) {
        setTransaction({
          pending: true,
          type: data.type,
          hash: null,
          error: null,
        });
      }
    };

    const handleTransactionSubmitted = (data: any) => {
      if (data.tileId === selectedTileId) {
        setTransaction((prev) => ({
          ...prev,
          hash: data.hash,
        }));
      }
    };

    const handleTransactionConfirmed = (data: any) => {
      if (data.tileId === selectedTileId) {
        setTransaction({
          pending: false,
          type: null,
          hash: null,
          error: null,
        });
        refreshWorldState();
      }
    };

    const handleTransactionFailed = (data: any) => {
      if (data.tileId === selectedTileId) {
        setTransaction({
          pending: false,
          type: null,
          hash: null,
          error: data.error,
        });
      }
    };

    sdk.on('transactionStarted', handleTransactionStarted);
    sdk.on('transactionSubmitted', handleTransactionSubmitted);
    sdk.on('transactionConfirmed', handleTransactionConfirmed);
    sdk.on('transactionFailed', handleTransactionFailed);

    return () => {
      sdk.off('transactionStarted', handleTransactionStarted);
      sdk.off('transactionSubmitted', handleTransactionSubmitted);
      sdk.off('transactionConfirmed', handleTransactionConfirmed);
      sdk.off('transactionFailed', handleTransactionFailed);
    };
  }, [sdk, selectedTileId]);

  const selectTile = (tileId: number) => {
    setSelectedTileId(tileId);
    setTransaction({
      pending: false,
      type: null,
      hash: null,
      error: null,
    });
  };

  const deselectTile = () => {
    setSelectedTileId(null);
    setTransaction({
      pending: false,
      type: null,
      hash: null,
      error: null,
    });
  };

  const claimTile = async () => {
    if (!sdk || !selectedTileId || !canClaim || transaction.pending) return;

    try {
      await sdk.claimTile(selectedTileId);
    } catch (err) {
      console.error('Failed to claim tile:', err);
    }
  };

  const placeItem = async (itemType: number) => {
    if (!sdk || !selectedTileId || !canPlaceItem || transaction.pending) return;

    try {
      await sdk.placeItem(selectedTileId, itemType);
    } catch (err) {
      console.error('Failed to place item:', err);
    }
  };

  const removeItem = async () => {
    if (!sdk || !selectedTileId || !canRemoveItem || transaction.pending) return;

    try {
      await sdk.removeItem(selectedTileId);
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  return {
    selectedTileId,
    selectedTile,
    isOwnedByUser,
    canClaim,
    canPlaceItem,
    canRemoveItem,
    transaction,
    selectTile,
    deselectTile,
    claimTile,
    placeItem,
    removeItem,
  };
}