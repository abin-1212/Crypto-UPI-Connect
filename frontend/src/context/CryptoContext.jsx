import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { showToast } from '../utils/toast';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import { useAuth } from './AuthContext';

const CryptoContext = createContext();

export const useCrypto = () => {
    const context = useContext(CryptoContext);
    if (!context) {
        throw new Error('useCrypto must be used within CryptoProvider');
    }
    return context;
};

export const CryptoProvider = ({ children }) => {
    const { token } = useAuth();

    // ConvergeX Wallet State
    const [convergeXWallet, setConvergeXWallet] = useState(null);
    const [convergeXBalances, setConvergeXBalances] = useState({});

    // Bank Account State (for UPI/Fiat)
    const [bankBalance, setBankBalance] = useState(0);
    const [bankUpiId, setBankUpiId] = useState('');

    // MetaMask Wallet State
    const [metamaskWallet, setMetamaskWallet] = useState(null);
    const [metamaskBalances, setMetamaskBalances] = useState({});
    const [isConnectingMetaMask, setIsConnectingMetaMask] = useState(false);

    // Phase 1: Network State
    const [network, setNetwork] = useState(null);

    const [activeWallet, setActiveWallet] = useState('convergex'); // 'convergex' or 'metamask'
    const [loading, setLoading] = useState(true);

    // Fetch ConvergeX Wallet on mount
    const fetchConvergeXWallet = async () => {
        try {
            setLoading(true);
            const response = await api.get('/wallet/convergex');

            if (response.data.success) {
                setConvergeXWallet(response.data.wallet);
                setConvergeXBalances(response.data.wallet.balance);
            }
        } catch (error) {
            console.error('Failed to fetch ConvergeX Wallet:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Bank Balance
    const fetchBankBalance = async () => {
        try {
            const response = await api.get('/bank/balance');
            setBankBalance(response.data.balance || 0);
            setBankUpiId(response.data.upiId || '');
        } catch (error) {
            console.error('Failed to fetch bank balance:', error);
        }
    };

    // Connect MetaMask Wallet (Phase 1 Refactor)
    const connectWallet = async () => {
        const provider = await detectEthereumProvider();

        if (!provider) {
            showToast.error('Please install MetaMask extension');
            return false;
        }

        try {
            setIsConnectingMetaMask(true);

            // Request accounts
            const accounts = await provider.request({ method: 'eth_requestAccounts' });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            const walletAddress = accounts[0];

            // Get Network
            const ethProvider = new ethers.providers.Web3Provider(provider);
            const network = await ethProvider.getNetwork();
            setNetwork(network);

            // Save to backend (Phase 1 Route)
            await api.post('/wallet/connect', {
                walletAddress
            });

            setMetamaskWallet(walletAddress);
            showToast.success('MetaMask wallet connected');

            // Fetch real balances if we were tracking them, but for now dummy/random as per previous code?
            // User said "No crypto transfers" in Phase 1, but "Show wallet address".
            // Previous code had dummy balances. I'll keep dummy balances for now as placeholders or 0.
            setMetamaskBalances({
                usdc: 0.00,
                dai: 0.00,
                eth: 0.00
            });

            return true;

        } catch (error) {
            console.error('MetaMask connection error:', error);
            showToast.error(error.message || 'Failed to connect MetaMask');
            return false;
        } finally {
            setIsConnectingMetaMask(false);
        }
    };

    // Alias for backward compatibility if needed, or just usage connectWallet
    const connectMetaMask = connectWallet;

    // Transfer between ConvergeX Wallets
    const transferConvergeXCrypto = async (toAddress, amount, token) => {
        try {
            const response = await api.post('/wallet/convergex/transfer', {
                toWalletAddress: toAddress,
                amount: parseFloat(amount),
                token: token.toUpperCase()
            });

            if (!response.data.success) {
                throw new Error(response.data.message);
            }

            // Update local balances
            setConvergeXBalances(prev => ({
                ...prev,
                [token.toLowerCase()]: prev[token.toLowerCase()] - amount
            }));

            showToast.success(`Transferred ${amount} ${token} to ${response.data.recipientName}`);
            return response.data;

        } catch (error) {
            console.error('Transfer error:', error);
            throw error;
        }
    };

    // Find ConvergeX Wallet by address
    const findConvergeXWallet = async (walletAddress) => {
        try {
            const response = await api.get(`/wallet/find-by-address/${walletAddress}`);
            return response.data;
        } catch (error) {
            return { success: false, found: false };
        }
    };

    // Get current active wallet balances
    const getActiveBalances = () => {
        return activeWallet === 'convergex' ? convergeXBalances : metamaskBalances;
    };

    // Get current active wallet address
    const getActiveWalletAddress = () => {
        return activeWallet === 'convergex'
            ? convergeXWallet?.address
            : metamaskWallet;
    };

    const [exchangeRates, setExchangeRates] = useState({
        usdc: 90,
        dai: 90,
        eth: 200000,
        btc: 6500000,
        source: 'fallback'
    });

    // Fetch Live Exchange Rates from backend (/wallet/rates → CoinGecko)
    const fetchExchangeRates = async () => {
        try {
            const response = await api.get('/wallet/rates');
            if (response.data.success && response.data.rates) {
                const r = response.data.rates;
                setExchangeRates({
                    usdc: r.USDC || 90,
                    dai: r.DAI || 90,
                    eth: r.ETH || 200000,
                    btc: r.BTC || 6500000,
                    source: response.data.source || 'api',
                    updatedAt: response.data.updatedAt
                });
            }
        } catch (error) {
            console.error('Failed to fetch live exchange rates:', error);
        }
    };

    // Convert Funds (UPI <-> Crypto)
    const convertFunds = async (fromType, amount, token) => {
        try {
            const endpoint = fromType === 'upi'
                ? '/wallet/convert/upi-to-crypto'
                : '/wallet/convert/crypto-to-upi';

            const response = await api.post(endpoint, {
                amount: parseFloat(amount),
                token: token.toUpperCase()
            });

            if (response.data.success) {
                // Update local wallet balance
                setConvergeXBalances(response.data.newCryptoBalance);
                setBankBalance(response.data.newBankBalance);
                showToast.success(response.data.message);
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('Conversion error:', error);
            throw error;
        }
    };

    // ── Hybrid Bridge: Crypto → UPI (send crypto, receiver gets INR) ──
    const hybridCryptoToUpi = async (receiverUpiId, cryptoAmount, token) => {
        try {
            const response = await api.post('/pay/crypto-to-upi', {
                receiverUpiId,
                token: token.toUpperCase(),
                cryptoAmount: parseFloat(cryptoAmount),
            });

            if (response.data.success) {
                // Update sender's crypto balance locally
                if (response.data.data?.senderCryptoBalance) {
                    setConvergeXBalances(response.data.data.senderCryptoBalance);
                } else {
                    // Fallback: deduct locally
                    setConvergeXBalances(prev => ({
                        ...prev,
                        [token.toLowerCase()]: (prev[token.toLowerCase()] || 0) - parseFloat(cryptoAmount)
                    }));
                }
                showToast.success(response.data.message);
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('Hybrid Crypto→UPI error:', error);
            throw error;
        }
    };

    // ── Hybrid Bridge: UPI → Crypto (send INR, receiver gets crypto) ──
    const hybridUpiToCrypto = async (receiverUserId, inrAmount, token) => {
        try {
            const response = await api.post('/pay/upi-to-crypto', {
                receiverUserId,
                token: token.toUpperCase(),
                inrAmount: parseFloat(inrAmount),
            });

            if (response.data.success) {
                // Update sender's bank balance locally
                if (response.data.data?.senderBankBalance !== undefined) {
                    setBankBalance(response.data.data.senderBankBalance);
                }
                showToast.success(response.data.message);
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('Hybrid UPI→Crypto error:', error);
            throw error;
        }
    };

    // ── Look up user by UPI ID ──
    const findUserByUpi = async (upiId) => {
        try {
            const response = await api.get(`/bank/find-by-upi/${encodeURIComponent(upiId)}`);
            return response.data;
        } catch (error) {
            return { success: false, found: false };
        }
    };

    // ── Look up user by wallet address (already exists as findConvergeXWallet) ──

    // Initialize — only fetch when user is authenticated
    useEffect(() => {
        if (token) {
            fetchConvergeXWallet();
            fetchBankBalance();
            fetchExchangeRates();

            // Auto-refresh rates every 60 seconds
            const rateInterval = setInterval(fetchExchangeRates, 60_000);
            return () => clearInterval(rateInterval);
        } else {
            // Reset state when logged out
            setConvergeXWallet(null);
            setConvergeXBalances({});
            setBankBalance(0);
            setBankUpiId('');
            setMetamaskWallet(null);
            setMetamaskBalances({});
            setLoading(false);
        }
    }, [token]);

    return (
        <CryptoContext.Provider value={{
            // State
            convergeXWallet,
            convergeXBalances,
            metamaskWallet,
            metamaskBalances,
            activeWallet,
            loading,
            isConnectingMetaMask,
            exchangeRates,
            bankBalance,
            bankUpiId,

            // Methods
            fetchConvergeXWallet,
            fetchBankBalance,
            connectMetaMask, // Keep for backward compat
            connectWallet,   // New Phase 1 method
            transferConvergeXCrypto,
            convertFunds,
            hybridCryptoToUpi,
            hybridUpiToCrypto,
            findConvergeXWallet,
            findUserByUpi,
            getActiveBalances,
            getActiveWalletAddress,

            // Phase 1 Props
            userWallet: metamaskWallet,
            network,

            // Setters
            setActiveWallet
        }}>
            {children}
        </CryptoContext.Provider>
    );
};
