import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import { showToast } from '../utils/toast';
import { toast } from 'react-hot-toast';
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

    // Session-level flag: persisted in sessionStorage so it survives Stripe
    // redirects (full page reloads) but resets when the browser tab closes.
    // This prevents auto-restoring wallet state from backend on fresh login
    // while keeping MetaMask connected across Stripe payment flows.
    const getSessionVerified = () => sessionStorage.getItem('cx_wallet_verified') === 'true';
    const setSessionVerified = (val) => {
        if (val) {
            sessionStorage.setItem('cx_wallet_verified', 'true');
        } else {
            sessionStorage.removeItem('cx_wallet_verified');
        }
    };

    // Guard: true while connectWallet() is running.
    // Blocks the accountsChanged event listener from polluting state mid-flow.
    const isConnectingRef = useRef(false);

    // Guard: true while a blockchain TX is pending (approve/lock/transfer).
    // Prevents accountsChanged from disconnecting wallet during TX confirmation.
    const txPendingRef = useRef(false);

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

                // Always set the convergeX internal wallet ID
                setUserWalletId(wallet.convergeXAddress);
                setConvergeXWallet({ address: wallet.convergeXAddress });

                // ONLY restore MetaMask wallet state if the user explicitly
                // connected MetaMask in THIS browser session (via connectWallet).
                // Uses sessionStorage so it survives Stripe redirects (page reloads)
                // but resets when the browser tab is closed.
                if (getSessionVerified() && wallet.walletAddress) {
                    setUserWallet(wallet.walletAddress);
                    setWalletVerified(true);
                    setMetamaskWallet(wallet.walletAddress);
                    setWalletInfo({ connectedAt: wallet.connectedAt, type: 'METAMASK' });
                    setCryptoBalances({
                        cxUSDC: parseFloat(balances.cxUSDC) || 0,
                        eth: parseFloat(balances.eth) || 0,
                    });
                    const cxBal = parseFloat(balances.cxUSDC) || 0;
                    setConvergeXBalances({ usdc: cxBal, cxUSDC: cxBal, dai: 0, eth: 0 });
                    setMetamaskBalances({ usdc: cxBal, cxUSDC: cxBal, dai: 0, eth: 0 });
                } else {
                    // Not connected this session — always show "Not Connected"
                    setUserWallet(null);
                    setWalletVerified(false);
                    setMetamaskWallet(null);
                    setWalletInfo(null);
                    setCryptoBalances({ cxUSDC: 0, eth: 0 });
                    setConvergeXBalances({});
                    setMetamaskBalances({});
                }
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
            isConnectingRef.current = true;

            // 1. Force MetaMask to show the account picker EVERY time
            //    wallet_requestPermissions re-prompts even if already connected,
            //    so the user always picks the correct account for this ConvergeX user.
            try {
                await provider.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }],
                });
            } catch (permErr) {
                // User rejected the account picker
                if (permErr.code === 4001) {
                    showToast.error('Account selection cancelled');
                    return false;
                }
                // Fallback: some wallets don't support wallet_requestPermissions
                console.warn('wallet_requestPermissions not supported, falling back', permErr);
            }

            // 2. Now fetch the selected account
            const accounts = await provider.request({ method: 'eth_accounts' });
            if (!accounts.length) throw new Error('No accounts found. Please select an account in MetaMask.');
            const walletAddress = accounts[0];
            console.log('[WALLET CONNECT] selected account:', walletAddress);

            // 3. Check network and switch to Sepolia if needed
            let ethProvider = new ethers.providers.Web3Provider(provider);
            let net = await ethProvider.getNetwork();
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
                // Re-create provider after network switch
                ethProvider = new ethers.providers.Web3Provider(provider);
                net = await ethProvider.getNetwork();
                setNetwork(net);
                setChainId(net.chainId);
            }

            // 4. Get nonce from backend
            const nonceRes = await api.get('/wallet/nonce');
            const { message, nonce: serverNonce } = nonceRes.data;
            console.log('[WALLET CONNECT] nonce:', serverNonce);

            // 5. Sign message — re-create provider to ensure signer matches selected account
            ethProvider = new ethers.providers.Web3Provider(provider);
            const signer = ethProvider.getSigner();
            const signerAddr = await signer.getAddress();
            console.log('[WALLET CONNECT] signer address:', signerAddr);

            // Safety check: signer must match the account we selected
            if (signerAddr.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new Error(
                    `MetaMask is signing with ${signerAddr.substring(0,10)}… but you selected ${walletAddress.substring(0,10)}…. ` +
                    `Please switch to the correct account in MetaMask and try again.`
                );
            }

            const signature = await signer.signMessage(message);
            console.log('[WALLET CONNECT] signature obtained, verifying...');

            // 6. Verify with backend
            const verifyRes = await api.post('/wallet/verify', {
                walletAddress,
                signature,
            });

            if (verifyRes.data.success) {
                // Mark session as verified BEFORE fetchWalletInfo
                // Stored in sessionStorage so it survives Stripe page reloads
                setSessionVerified(true);

                setUserWallet(walletAddress);
                setMetamaskWallet(walletAddress);
                setWalletVerified(true);
                showToast.success('Wallet verified and connected!');

                // Now fetch on-chain balances (sessionVerifiedRef is true so it will load)
                await fetchWalletInfo();
                return true;
            } else {
                throw new Error(verifyRes.data.message);
            }
        } catch (error) {
            console.error('Wallet connection error:', error);

            // ALWAYS reset wallet state on ANY failure (409, signature reject, etc.)
            setSessionVerified(false);
            setUserWallet(null);
            setMetamaskWallet(null);
            setWalletVerified(false);
            setCryptoBalances({ cxUSDC: 0, eth: 0 });
            setConvergeXBalances({});
            setMetamaskBalances({});
            setWalletInfo(null);

            if (error.code === 4001) {
                showToast.error('Signature rejected by user');
            } else {
                const msg = error?.response?.data?.message || error.message || 'Failed to connect wallet';
                showToast.error(msg);
            }
            return false;
        } finally {
            setIsConnecting(false);
            isConnectingRef.current = false;
        }
    }, [fetchWalletInfo]);

    const connectMetaMask = connectWallet;

    // ═══════════════════════════════════════
    //  DISCONNECT WALLET
    // ═══════════════════════════════════════
    const disconnectWallet = useCallback(() => {
        setSessionVerified(false);
        setUserWallet(null);
        setMetamaskWallet(null);
        setWalletVerified(false);
        setCryptoBalances({ cxUSDC: 0, eth: 0 });
        setConvergeXBalances({});
        setMetamaskBalances({});
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
        txPendingRef.current = true;
        setLastTxStatus('APPROVING');

        let loadingToastId;
        try {
            // Step 1: Check allowance
            const currentAllowance = await tokenContract.allowance(
                await signer.getAddress(), ESCROW_ADDRESS
            );

            if (currentAllowance.lt(amountWei)) {
                loadingToastId = showToast.loading('Approve cxUSDC spending...');
                const approveTx = await tokenContract.approve(ESCROW_ADDRESS, amountWei);
                await approveTx.wait(1);
                toast.dismiss(loadingToastId);
                showToast.success('Token approved!');
            }

            // Step 2: Lock tokens in escrow
            setLastTxStatus('LOCKING');
            loadingToastId = showToast.loading('Locking tokens in escrow...');
            const lockTx = await escrowContract.lockForUPI(amountWei, offchainId);
            const receipt = await lockTx.wait(1);
            const txHash = receipt.transactionHash;
            setLastTxHash(txHash);
            setLastTxStatus('PENDING');

            // Step 3: Send to backend for settlement
            toast.dismiss(loadingToastId);
            loadingToastId = showToast.loading('Verifying on-chain...');
            const response = await api.post('/pay/crypto-to-upi', {
                txHash,
                offchainId,
                cryptoAmount: amount,
                token,
                receiverUpiId,
            }, { timeout: 120000, _suppressToast: true });

            toast.dismiss(loadingToastId);
            if (response.data.success) {
                setLastTxStatus('SETTLED');
                showToast.success(response.data.message);
                await fetchWalletInfo();
                await fetchBankBalance();
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            setLastTxStatus('FAILED');
            if (loadingToastId) toast.dismiss(loadingToastId);
            const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Crypto-to-UPI transfer failed';
            showToast.error(msg);
            throw error;
        } finally {
            setTxPending(false);
            txPendingRef.current = false;
        }
    }, [walletVerified, fetchWalletInfo]);

    // ═══════════════════════════════════════
    //  UPI → CRYPTO (INR debit → on-chain release)
    // ═══════════════════════════════════════
    const hybridUpiToCrypto = useCallback(async (receiverWalletAddress, inrAmount, token = 'cxUSDC') => {
        try {
            setTxPending(true);
            txPendingRef.current = true;
            setLastTxStatus('PENDING');

            const response = await api.post('/pay/upi-to-crypto', {
                receiverAddress: receiverWalletAddress,
                token: token.toUpperCase(),
                inrAmount: parseFloat(inrAmount),
            }, { timeout: 120000, _suppressToast: true });

            if (response.data.success) {
                setLastTxHash(response.data.data?.txHash);
                setLastTxStatus('SETTLED');
                setBankBalance(response.data.data?.senderBankBalance ?? bankBalance - parseFloat(inrAmount));
                showToast.success(response.data.message);
                await fetchWalletInfo();
                await fetchBankBalance();
                return response.data;
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            setLastTxStatus('FAILED');
            throw error;
        } finally {
            setTxPending(false);
            txPendingRef.current = false;
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
        txPendingRef.current = true;
        setLastTxStatus('PENDING');

        let loadingToastId;
        try {
            loadingToastId = showToast.loading('Sending tokens...');
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
            toast.dismiss(loadingToastId);
            showToast.success(`Sent ${amount} ${token}`);
            await fetchWalletInfo();
            return { txHash, blockNumber: receipt.blockNumber };
        } catch (error) {
            setLastTxStatus('FAILED');
            if (loadingToastId) toast.dismiss(loadingToastId);
            throw error;
        } finally {
            setTxPending(false);
            txPendingRef.current = false;
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
            // CRITICAL: Do NOT update wallet state while connectWallet() is running
            // or while a blockchain TX is pending (approve/lock/transfer).
            // wallet_requestPermissions and TX confirmations trigger this event.
            if (isConnectingRef.current || txPendingRef.current) return;

            if (accounts.length === 0) {
                disconnectWallet();
            } else if (walletVerified && accounts[0].toLowerCase() !== userWallet?.toLowerCase()) {
                // Only warn about account change if wallet was previously verified
                setSessionVerified(false);
                setUserWallet(null);
                setMetamaskWallet(null);
                setWalletVerified(false);
                setCryptoBalances({ cxUSDC: 0, eth: 0 });
                setConvergeXBalances({});
                setMetamaskBalances({});
                setWalletInfo(null);
                showToast.error('MetaMask account changed. Please reconnect your wallet.');
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
            // User logged out — reset ALL crypto state + session flag
            setSessionVerified(false);
            setConvergeXWallet(null);
            setConvergeXBalances({});
            setBankBalance(0);
            setBankUpiId('');
            setMetamaskWallet(null);
            setUserWallet(null);
            setWalletVerified(false);
            setCryptoBalances({ cxUSDC: 0, eth: 0 });
            setMetamaskBalances({});
            setWalletInfo(null);
            setLoading(false);

            // Best-effort: revoke MetaMask permissions for fresh account picker
            if (window.ethereum) {
                window.ethereum.request({
                    method: 'wallet_revokePermissions',
                    params: [{ eth_accounts: {} }],
                }).catch(() => {});
            }
        }
    }, [token, fetchWalletInfo, fetchBankBalance, fetchExchangeRates]);

    // ═══════════════════════════════════════
    //  REFRESH ALL DATA — call from any page after payments
    // ═══════════════════════════════════════
    const refreshAllData = useCallback(async () => {
        await Promise.all([
            fetchBankBalance(),
            fetchWalletInfo(),
        ]);
    }, [fetchBankBalance, fetchWalletInfo]);

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
            refreshAllData,

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
