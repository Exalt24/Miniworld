import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MiniWorldSDK } from '../../../sdk/dist/index.js';

interface SDKContextValue {
  sdk: MiniWorldSDK;
  isInitialized: boolean;
  error: string | null;
}

const SDKContext = createContext<SDKContextValue | undefined>(undefined);

export function SDKProvider({ children }: { children: ReactNode }) {
  const [sdk] = useState<MiniWorldSDK>(() => {
    const instance = new MiniWorldSDK({
      contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
      apiUrl: import.meta.env.VITE_API_URL,
      wsUrl: import.meta.env.VITE_WS_URL,
      autoConnectWebSocket: true,
    });
    return instance;
  });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    const handleError = (data: { message: string }) => {
      console.error('✗ SDK error:', data.message);
      setError(data.message);
    };

    const handleWSConnected = () => {
      console.log('✓ WebSocket connected');
    };

    const handleWSDisconnected = (data: { reason?: string }) => {
      console.log('⚠ WebSocket disconnected:', data.reason || 'Unknown reason');
    };

    sdk.on('wsConnected', handleWSConnected);
    sdk.on('wsDisconnected', handleWSDisconnected);
    sdk.on('error', handleError);

    setIsInitialized(true);

    return () => {
      sdk.off('wsConnected', handleWSConnected);
      sdk.off('wsDisconnected', handleWSDisconnected);
      sdk.off('error', handleError);
    };
  }, [sdk]);

  return (
    <SDKContext.Provider value={{ sdk, isInitialized, error }}>
      {children}
    </SDKContext.Provider>
  );
}

export function useSDKContext(): SDKContextValue {
  const context = useContext(SDKContext);
  if (!context) {
    throw new Error('useSDKContext must be used within SDKProvider');
  }
  return context;
}