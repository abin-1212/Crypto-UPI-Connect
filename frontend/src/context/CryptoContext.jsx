import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { showToast } from '../utils/toast';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import { useAuth } from './AuthContext';
import {
    SEPOLIA_CHAIN_ID,
    TOKEN_ADDRESS,
    ESCROW_ADDRESS,
    ERC20_ABI,
    ESCROW_ABI,
    SEPOLIA_NETWORK_PARAMS,
    generateOffchainId,
    BLOCK_EXPLORER,
} from '../config/contracts';

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

    // Wallet State
    const [userWallet, setUserWallet] = useState(null);           // MetaMask address
    const [walletVerified, setWalletVerified] = useState(false);
    const [userWalletId, setUserWalletId] = useState(null);       // cx_ address
    const [isConnecting, setIsConnecting] = useState(false);

    // On-chain Balances
    const [cryptoBalances, setCryptoBalances] = useState({ cxUSDC: 0, eth: 0 });

    // Legacy compat
    const [convergeXWallet, setConvergeXWallet] = useState(null);
    const [convergeXBalances, setConvergeXBalances] = useState({});
    const [metamaskWallet, setMetamaskWallet] = useState(null);
    const [metamaskBalances, setMetamaskBalances] = useState({});
    const [activeWallet, setActiveWallet] = useState('convergex');

    // Bank
    const [bankBalance, setBankBalance] = useState(0);
    const [bankUpiId, setBankUpiId] = useState('');

    // Network
    const [network, setNetwork] = useState(null);
    const [chainId, setChainId] = useState(null);

    // Rates
    const [exchangeRates, setExchangeRates] = useState({
        usdc: 90, dai: 90, eth: 200000, btc: 6500000, source: 'fallback'
    });

    // Loading / TX state
    const [loading, setLoading] = useState(true);
    const [txPending, setTxPending] = useState(false);
    const [lastTxHash, setLastTxHash] = useState(null);
    const [lastTxStatus, setLastTxStatus] = useState(null);

    // Contract helpers
    const [walletInfo, setWalletInfo] = useState(null);

    // ═══════════════════════════════════════
    //  METAMASK DETECTION
    // ═══════════════════════════════════════
    const checkMetaMask = useCallback(() => {
        return typeof window !== 'undefined' && Boolean(window.ethereum);
    }, []);

    // ═══════════════════════════════════════
    //  WALLET INFO FETCH (on-chain balance)
    // ═══════════════════════════════════════
    const fetchWalletInfo = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/wallet/info');
            if (response.data.success) {
                const { wallet, balances, chain } = response.data;
                setUserWallet(wallet.walletAddress);
                setWalletVerified(wallet.walletVerified);
                setUserWalletId(wallet.convergeXAddress);
                setMetamaskWallet(wallet.walletAddress);
                setWalletInfo({
                    connectedAt: wallet.connectedAt,
                    type: 'METAMASK',
                });

                setCryptoBalances({
                    cxUSDC: parseFloat(balances.cxUSDC) || 0,
                    eth: parseFloat(balances.eth) || 0,
                });

                // Legacy compat
                setConvergeXWallet({ address: wallet.convergeXAddress });
                const cxBal = parseFloat(balances.cxUSDC) || 0;
                setConvergeXBalances({ usdc: cxBal, cxUSDC: cxBal, dai: 0, eth: 0 });
                setMetamaskBalances({ usdc: cxBal, cxUSDC: cxBal, dai: 0, eth: 0 });
            }
        } catch (error) {
            console.error('Failed to fetch wallet info:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Backward compat
    const fetchConvergeXWallet = fetchWalletInfo;

    // ═══════════════════════════════════════
    //  BANK BALANCE
    // ═══════════════════════════════════════
    const fetchBankBalance = useCallback(async () => {
        try {
            const response = await api.get('/bank/balance');
            setBankBalance(response.data.balance || 0);
            setBankUpiId(response.data.upiId || '');
        } catch (error) {
            console.error('Failed to fetch bank balance:', error);
        }
    }, []);

    // ═══════════════════════════════════════
    //  EXCHANGE RATES
    // ═══════════════════════════════════════
    const fetchExchangeRates = useCallback(async () => {
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
                    updatedAt: response.data.updatedAt,
                });
            }
        } catch (error) {
            console.error('Failed to fetch exchange rates:', error);
        }
    }, []);

    // ═══════════════════════════════════════
    //  CONNECT WALLET (MetaMask + Signature)
    // ═══════════════════════════════════════
    const connectWallet = useCallback(async () => {
        const provider = await detectEthereumProvider();
        if (!provider) {
            showToast.error('Please install MetaMask extension');
            return false;
        }

        try {
            setIsConnecting(true);

            // 1. Request accounts
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            if (!accounts.length) throw new Error('No accounts found');
            const walletAddress = accounts[0];

            // 2. Check network
            const ethProvider = new ethers.providers.Web3Provider(provider);
            const net = await ethProvider.getNetwork();
            setNetwork(net);
            setChainId(net.chainId);

            if (net.chainId !== SEPOLIA_CHAIN_ID) {
                try {
                    await provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: SEPOLIA_NETWORK_PARAMS.chainId }],
                    });
                } catch (switchErr) {
                    if (switchErr.code === 4902) {
                        await provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [SEPOLIA_NETWORK_PARAMS],
                        });
                    } else {
                        throw switchErr;
                    }
                }
            }

            // 3. Get nonce from backend
            const nonceRes = await api.get('/wallet/nonce');
            const { message } = nonceRes.data;

            // 4. Sign message
            const signer = ethProvider.getSigner();
            const signature = await signer.signMessage(message);

            // 5. Verify with backend
            const verifyRes = await api.post('/wallet/verify', {
                walletAddress,
                signature,
            });

            if (verifyRes.data.success) {
                setUserWallet(walletAddress);
                setMetamaskWallet(walletAddress);
                setWalletVerified(true);
                showToast.success('Wallet verified and connected!');

                // Refresh wallet info
                await fetchWalletInfo();
                return true;
            } else {
                throw new Error(verifyRes.data.message);
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            if (error.code === 4001) {
                showToast.error('Signature rejected by user');
            } else {
                showToast.error(error.message || 'Failed to connect wallet');
            }
            return false;
        } finally {
            setIsConnecting(false);
        }
    }, [fetchWalletInfo]);

    const connectMetaMask = connectWallet;

    // ═══════════════════════════════════════
    //  DISCONNECT WALLET
    // ═══════════════════════════════════════
    const disconnectWallet = useCallback(() => {
        setUserWallet(null);
        setMetamaskWallet(null);
        setWalletVerified(false);
        setCryptoBalances({ cxUSDC: 0, eth: 0 });
        setWalletInfo(null);
        showToast.success('Wallet disconnected');
    }, []);

    // ═══════════════════════════════════════
    //  ON-CHAIN: Approve + Lock (Crypto → UPI)
    // ═══════════════════════════════════════
    const lockTokensForUPI = useCallback(async (amount, receiverUpiId, token = 'cxUSDC') => {
        if (!window.ethereum) throw new Error('MetaMask not found');
        if (!walletVerified) throw new Error('Wallet not verified');

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

        const amountWei = ethers.utils.parseEther(amount.toString());
        const offchainId = generateOffchainId();

        setTxPending(true);
        setLastTxStatus('APPROVING');

        try {
            // Step 1: Check allowance
            const currentAllowance = await tokenContract.allowance(
                await signer.getAddress(), ESCROW_ADDRESS
            );

            if (currentAllowance.lt(amountWei)) {
                showToast.loading('Approve cxUSDC spending...');
                const approveTx = await tokenContract.approve(ESCROW_ADDRESS, amountWei);
                await approveTx.wait(1);
                showToast.success('Token approved!');
            }

            // Step 2: Lock tokens in escrow
            setLastTxStatus('LOCKING');
            showToast.loading('Locking tokens in escrow...');
            const lockTx = await escrowContract.lockForUPI(amountWei, offchainId);
            const receipt = await lockTx.wait(1);
            const txHash = receipt.transactionHash;
            setLastTxHash(txHash);
            setLastTxStatus('PENDING');

            // Step 3: Send to backend for settlement
            showToast.loading('Verifying on-chain...');
            const response = await api.post('/pay/crypto-to-upi', {
                txHash,
                offchainId,
                cryptoAmount: amount,
                token,
                receiverUpiId,
            });

            if (response.data.success) {
                setLastTxStatus('SETTLED');
                showToast.success(response.data.message);
                await fetchWalletInfo();
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            setLastTxStatus('FAILED');
            throw error;
        } finally {
            setTxPending(false);
        }
    }, [walletVerified, fetchWalletInfo]);

    // ═══════════════════════════════════════
    //  UPI → CRYPTO (INR debit → on-chain release)
    // ═══════════════════════════════════════
    const hybridUpiToCrypto = useCallback(async (receiverWalletAddress, inrAmount, token = 'cxUSDC') => {
        try {
            setTxPending(true);
            setLastTxStatus('PENDING');

            const response = await api.post('/pay/upi-to-crypto', {
                receiverWalletAddress,
                token: token.toUpperCase(),
                inrAmount: parseFloat(inrAmount),
            });

            if (response.data.success) {
                setLastTxHash(response.data.data?.txHash);
                setLastTxStatus('SETTLED');
                setBankBalance(response.data.data?.senderBankBalance ?? bankBalance - parseFloat(inrAmount));
                showToast.success(response.data.message);
                await fetchWalletInfo();
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            setLastTxStatus('FAILED');
            throw error;
        } finally {
            setTxPending(false);
        }
    }, [bankBalance, fetchWalletInfo]);

    // ═══════════════════════════════════════
    //  DIRECT ERC-20 TRANSFER (wallet → wallet)
    // ═══════════════════════════════════════
    const transferCrypto = useCallback(async (toAddress, amount, token = 'cxUSDC') => {
        if (!window.ethereum) throw new Error('MetaMask not found');
        if (!walletVerified) throw new Error('Wallet not verified');

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        const amountWei = ethers.utils.parseEther(amount.toString());

        setTxPending(true);
        setLastTxStatus('PENDING');

        try {
            showToast.loading('Sending tokens...');
            const tx = await tokenContract.transfer(toAddress, amountWei);
            const receipt = await tx.wait(1);
            const txHash = receipt.transactionHash;
            setLastTxHash(txHash);

            // Record on backend
            await api.post('/pay/crypto', {
                toWalletAddress: toAddress,
                amount: parseFloat(amount),
                tokenType: token,
                txHash,
            });

            setLastTxStatus('CONFIRMED');
            showToast.success(`Sent ${amount} ${token}`);
            await fetchWalletInfo();
            return { txHash, blockNumber: receipt.blockNumber };
        } catch (error) {
            setLastTxStatus('FAILED');
            throw error;
        } finally {
            setTxPending(false);
        }
    }, [walletVerified, fetchWalletInfo]);

    // Legacy compat aliases
    const transferConvergeXCrypto = transferCrypto;
    const hybridCryptoToUpi = lockTokensForUPI;

    // ═══════════════════════════════════════
    //  CONVERT FUNDS (self swap — bank ↔ crypto)
    // ═══════════════════════════════════════
    const convertFunds = useCallback(async (fromType, amount, token) => {
        if (fromType === 'upi' || fromType === 'UPI') {
            // Bank → Crypto for self: use UPI→Crypto with own wallet
            if (!userWallet || !walletVerified) {
                throw new Error('Connect and verify your wallet first');
            }
            return await hybridUpiToCrypto(userWallet, amount, token);
        } else {
            // Crypto → Bank for self: lock + settle to own UPI
            if (!bankUpiId) throw new Error('No bank account linked');
            return await lockTokensForUPI(amount, bankUpiId, token);
        }
    }, [userWallet, walletVerified, bankUpiId, hybridUpiToCrypto, lockTokensForUPI]);

    // ═══════════════════════════════════════
    //  LOOKUPS
    // ═══════════════════════════════════════
    const findConvergeXWallet = useCallback(async (walletAddress) => {
        try {
            const response = await api.get(`/wallet/find-by-address/${walletAddress}`);
            return response.data;
        } catch { return { success: false, found: false }; }
    }, []);

    const findUserByUpi = useCallback(async (upiId) => {
        try {
            const response = await api.get(`/bank/find-by-upi/${encodeURIComponent(upiId)}`);
            return response.data;
        } catch { return { success: false, found: false }; }
    }, []);

    // ═══════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════
    const getActiveBalances = useCallback(() => {
        return {
            usdc: cryptoBalances.cxUSDC,
            cxUSDC: cryptoBalances.cxUSDC,
            dai: 0,
            eth: cryptoBalances.eth,
        };
    }, [cryptoBalances]);

    const getActiveWalletAddress = useCallback(() => {
        return userWallet || convergeXWallet?.address;
    }, [userWallet, convergeXWallet]);

    // ═══════════════════════════════════════
    //  METAMASK EVENTS
    // ═══════════════════════════════════════
    useEffect(() => {
        if (!window.ethereum) return;

        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else if (accounts[0].toLowerCase() !== userWallet?.toLowerCase()) {
                setUserWallet(accounts[0]);
                setMetamaskWallet(accounts[0]);
                setWalletVerified(false);
                showToast('Wallet changed. Please re-verify.');
            }
        };

        const handleChainChanged = (newChainId) => {
            setChainId(parseInt(newChainId, 16));
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, [userWallet, disconnectWallet]);

    // ═══════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════
    useEffect(() => {
        if (token) {
            fetchWalletInfo();
            fetchBankBalance();
            fetchExchangeRates();

            const rateInterval = setInterval(fetchExchangeRates, 60_000);
            return () => clearInterval(rateInterval);
        } else {
            setConvergeXWallet(null);
            setConvergeXBalances({});
            setBankBalance(0);
            setBankUpiId('');
            setMetamaskWallet(null);
            setUserWallet(null);
            setWalletVerified(false);
            setCryptoBalances({ cxUSDC: 0, eth: 0 });
            setLoading(false);
        }
    }, [token, fetchWalletInfo, fetchBankBalance, fetchExchangeRates]);

    return (
        <CryptoContext.Provider value={{
            // State
            convergeXWallet,
            convergeXBalances,
            metamaskWallet,
            metamaskBalances,
            activeWallet,
            loading,
            isConnectingMetaMask: isConnecting,
            isConnecting,
            exchangeRates,
            bankBalance,
            bankUpiId,
            cryptoBalances,
            walletVerified,
            chainId,
            txPending,
            lastTxHash,
            lastTxStatus,

            // Methods
            fetchConvergeXWallet,
            fetchWalletInfo,
            fetchBankBalance,
            connectMetaMask,
            connectWallet,
            disconnectWallet,
            transferConvergeXCrypto,
            transferCrypto,
            convertFunds,
            lockTokensForUPI,
            hybridCryptoToUpi,
            hybridUpiToCrypto,
            findConvergeXWallet,
            findUserByUpi,
            getActiveBalances,
            getActiveWalletAddress,
            checkMetaMask,

            // Phase 1 compat
            userWallet,
            userWalletId,
            walletInfo,
            network,

            // Setters
            setActiveWallet,
            setLastTxStatus,
        }}>
            {children}
        </CryptoContext.Provider>
    );
};
