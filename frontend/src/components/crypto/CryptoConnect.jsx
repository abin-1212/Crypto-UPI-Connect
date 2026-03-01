import { useCrypto } from '../../context/CryptoContext';
import { Wallet, Copy, ExternalLink, LogOut, AlertCircle, CheckCircle, Droplets } from 'lucide-react';
import { useState } from 'react';
import { showToast } from '../../utils/toast';
import EtherscanLink from '../ui/EtherscanLink';
import { BLOCK_EXPLORER, TOKEN_ADDRESS } from '../../config/contracts';
import api from '../../api/client';

const CryptoConnect = () => {
    const {
        userWallet,
        walletVerified,
        isConnecting,
        cryptoBalances,
        connectWallet,
        disconnectWallet,
        checkMetaMask,
        loading,
        chainId,
        fetchWalletInfo,
    } = useCrypto();

    const [copySuccess, setCopySuccess] = useState('');
    const [faucetLoading, setFaucetLoading] = useState(false);

    const handleCopyAddress = () => {
        if (!userWallet) return;
        navigator.clipboard.writeText(userWallet);
        setCopySuccess('Copied!');
        showToast.success('Wallet address copied');
        setTimeout(() => setCopySuccess(''), 2000);
    };

    const formatAddress = (address) => {
        if (!address) return 'Not connected';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const handleFaucet = async () => {
        if (!userWallet) return;
        setFaucetLoading(true);
        try {
            // The faucet is called directly on the MockCXToken contract via MetaMask
            const { ethers } = await import('ethers');
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const token = new ethers.Contract(TOKEN_ADDRESS, ['function faucet() external'], signer);
            const tx = await token.faucet();
            showToast.success('Faucet transaction sent! Waiting for confirmation...');
            await tx.wait();
            showToast.success('1000 cxUSDC received!');
            fetchWalletInfo();
        } catch (error) {
            showToast.error(error?.reason || error?.message || 'Faucet failed. Maybe cooldown not expired (1hr).');
        } finally {
            setFaucetLoading(false);
        }
    };

    // Loading skeleton
    if (loading && !userWallet) {
        return (
            <div className="glass-card p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
                    <div className="h-10 bg-gray-700 rounded mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-700 rounded"></div>
                        <div className="h-4 bg-gray-700 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!checkMetaMask()) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-yellow-400 mt-1" size={20} />
                    <div>
                        <h3 className="font-medium text-white mb-2">MetaMask Required</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Install MetaMask browser extension to use crypto features.
                        </p>
                        <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300">
                            Install MetaMask →
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (!userWallet) {
        return (
            <div className="glass-card p-6">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
                        <Wallet size={28} className="text-purple-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Connect & Verify Wallet</h3>
                    <p className="text-gray-400 text-sm mb-6">
                        Connect your MetaMask wallet and sign a message to verify ownership
                    </p>
                    <button onClick={connectWallet} disabled={isConnecting}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:opacity-90 transition-all font-medium disabled:opacity-50">
                        {isConnecting ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Connecting...
                            </span>
                        ) : (
                            'Connect & Verify MetaMask'
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            {/* Wallet Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${walletVerified ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' : 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20'}`}>
                        <Wallet size={20} className={walletVerified ? 'text-green-400' : 'text-yellow-400'} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-400">Your Wallet</p>
                            {walletVerified && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle size={10} /> Verified
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-white text-sm">{formatAddress(userWallet)}</span>
                            <EtherscanLink address={userWallet} short />
                        </div>
                    </div>
                </div>
                <button onClick={disconnectWallet}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-red-400" title="Disconnect wallet">
                    <LogOut size={18} />
                </button>
            </div>

            {/* Wallet Actions */}
            <div className="flex gap-2 mb-6">
                <button onClick={handleCopyAddress}
                    className="flex-1 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2 text-xs">
                    <Copy size={14} />
                    {copySuccess === 'Copied!' ? 'Copied!' : 'Copy Address'}
                </button>
                <button onClick={handleFaucet} disabled={faucetLoading}
                    className="flex-1 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50">
                    <Droplets size={14} />
                    {faucetLoading ? 'Claiming...' : 'Get Test Tokens'}
                </button>
            </div>

            {/* On-chain Balances */}
            <div className="space-y-4">
                <h4 className="font-medium text-white">On-chain Balances</h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <span className="text-blue-400 text-sm font-bold">cx</span>
                            </div>
                            <span className="text-gray-300">cxUSDC</span>
                        </div>
                        <span className="text-white font-medium font-mono">
                            {(cryptoBalances?.cxUSDC || 0).toFixed(4)} cxUSDC
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <span className="text-purple-400 text-sm">Ξ</span>
                            </div>
                            <span className="text-gray-300">ETH (gas)</span>
                        </div>
                        <span className="text-white font-medium font-mono">
                            {(cryptoBalances?.eth || 0).toFixed(6)} ETH
                        </span>
                    </div>
                </div>
            </div>

            {/* Network Info */}
            <div className="mt-6 pt-4 border-t border-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Network: {chainId === '0xaa36a7' || chainId === 11155111 ? 'Sepolia Testnet' : `Chain ${chainId}`}</span>
                    <a href={`${BLOCK_EXPLORER}/address/${userWallet}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        View on Etherscan <ExternalLink size={10} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default CryptoConnect;
