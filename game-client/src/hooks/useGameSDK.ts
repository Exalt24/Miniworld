import { useSDKContext } from '../contexts/SDKContext';

export function useGameSDK() {
  const context = useSDKContext();

  return {
    sdk: context.sdk,
    isInitialized: context.isInitialized,
    isConnected: context.isConnected,
    connectedAddress: context.connectedAddress,
    isConnecting: context.isConnecting,
    error: context.error,
    connectWallet: context.connectWallet,
    disconnectWallet: context.disconnectWallet,
  };
}