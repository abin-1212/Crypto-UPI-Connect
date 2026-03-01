/**
 * NetworkGuard — Warns when user is on wrong chain
 */
import { SEPOLIA_CHAIN_ID, SEPOLIA_NETWORK_PARAMS } from '../../config/contracts';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const NetworkGuard = ({ currentChainId, children }) => {
  const [switching, setSwitching] = useState(false);

  if (!currentChainId || currentChainId === SEPOLIA_CHAIN_ID) {
    return children;
  }

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    setSwitching(true);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_NETWORK_PARAMS.chainId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_NETWORK_PARAMS],
        });
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="glass-card p-6 border-yellow-500/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-yellow-400 mt-1 shrink-0" size={20} />
        <div className="flex-1">
          <h3 className="font-medium text-white mb-1">Wrong Network</h3>
          <p className="text-sm text-gray-400 mb-4">
            Please switch to <span className="text-yellow-400 font-medium">Sepolia Testnet</span> to use crypto features.
          </p>
          <button
            onClick={switchNetwork}
            disabled={switching}
            className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all text-sm font-medium flex items-center gap-2"
          >
            {switching ? <RefreshCw size={14} className="animate-spin" /> : null}
            {switching ? 'Switching...' : 'Switch to Sepolia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NetworkGuard;
