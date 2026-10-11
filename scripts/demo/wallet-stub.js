// Recording aid, NOT a wallet. A minimal EIP-1193 window.ethereum stand-in for the local Hardhat dev chain.
// It reports one of the Hardhat node's pre-funded, unlocked accounts and forwards every JSON-RPC call
// (eth_sendTransaction, eth_call, signing methods, ...) to the local node through a host-side function
// called __rpc, so the node signs with that unlocked account. It only works against a dev chain.
(() => {
  const ACCOUNT = window.__MW_ACCOUNT;
  const listeners = {};
  const rpcError = (e) => Object.assign(new Error(e.message || 'RPC error'), { code: e.code, data: e.data });
  window.ethereum = {
    isMetaMask: false,
    isRecordingStub: true,
    request: async ({ method, params = [] }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ACCOUNT];
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      const res = await window.__rpc(method, params);
      if (res.error) throw rpcError(res.error);
      return res.result;
    },
    on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
})();
