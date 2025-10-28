import { useSDKContext } from '../contexts/SDKContext';

export function useGameSDK() {
  return useSDKContext();
}