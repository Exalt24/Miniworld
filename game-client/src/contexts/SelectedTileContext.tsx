import { createContext, useContext, ReactNode } from 'react';
import { useSelectedTile as useSelectedTileHook } from '../hooks/useSelectedTile';

type SelectedTileContextType = ReturnType<typeof useSelectedTileHook>;

const SelectedTileContext = createContext<SelectedTileContextType | undefined>(undefined);

export function SelectedTileProvider({ children }: { children: ReactNode }) {
  const selectedTileState = useSelectedTileHook();

  return (
    <SelectedTileContext.Provider value={selectedTileState}>
      {children}
    </SelectedTileContext.Provider>
  );
}

export function useSelectedTileContext() {
  const context = useContext(SelectedTileContext);
  if (context === undefined) {
    throw new Error('useSelectedTileContext must be used within SelectedTileProvider');
  }
  return context;
}