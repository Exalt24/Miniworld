import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

declare global {
  interface Window {
    MiniWorldSDK?: any;
  }
}

interface SDKContextType {
  sdk: any | null;
  isInitialized: boolean;
  isConnected: boolean;
  connectedAddress: string | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const SDKContext = createContext<SDKContextType | undefined>(undefined);

export function SDKProvider({ children }: { children: ReactNode }) {
  const [sdk, setSDK] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSDK = async () => {
      try {
        const { MiniWorldSDK } = await import('../../../sdk/dist/index.js');
        
        const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
        const apiUrl = import.meta.env.VITE_API_URL;
        const wsUrl = import.meta.env.VITE_WS_URL;

        if (!contractAddress) {
          throw new Error('CONTRACT_ADDRESS not set in environment');
        }

        const sdkInstance = new MiniWorldSDK({
          contractAddress,
          apiUrl: apiUrl || 'http://localhost:4000/api',
          wsUrl: wsUrl || 'http://localhost:4000',
          autoConnectWebSocket: true,
        });

        sdkInstance.on('connected', (data: any) => {
          setIsConnected(true);
          setConnectedAddress(data.address);
          setIsConnecting(false);
        });

        sdkInstance.on('disconnected', () => {
          setIsConnected(false);
          setConnectedAddress(null);
        });

        sdkInstance.on('accountChanged', (data: any) => {
          setConnectedAddress(data.newAddress);
        });

        sdkInstance.on('error', (data: any) => {
          setError(data.error);
          setIsConnecting(false);
        });

        setSDK(sdkInstance);
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize SDK:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize SDK');
        setIsInitialized(false);
      }
    };

    initSDK();
  }, []);

  const connectWallet = async () => {
    if (!sdk || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      await sdk.connect();
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    if (!sdk) return;
    sdk.disconnect();
  };

  return (
    <SDKContext.Provider
      value={{
        sdk,
        isInitialized,
        isConnected,
        connectedAddress,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </SDKContext.Provider>
  );
}

export function useSDKContext() {
  const context = useContext(SDKContext);
  if (context === undefined) {
    throw new Error('useSDKContext must be used within SDKProvider');
  }
  return context;
}