import { useState, useEffect } from 'react';
import { useCrypto } from '../context/CryptoContext';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '../utils/toast';
import LiveRateTicker from '../components/ui/LiveRateTicker';
import TransactionStatus from '../components/ui/TransactionStatus';
import EtherscanLink from '../components/ui/EtherscanLink';
import GasEstimate from '../components/ui/GasEstimate';
import NetworkGuard from '../components/ui/NetworkGuard';
import {
    Send,
    Wallet,
    CheckCircle,
    CreditCard,
    User,
    AlertCircle,
    RefreshCw,
    ArrowDown,
    ArrowRight,
    Landmark,
    ShieldCheck,
    ArrowLeftRight,
    Zap,
    ExternalLink,
    Droplets,
} from 'lucide-react';
import { BLOCK_EXPLORER, TOKEN_ADDRESS } from '../config/contracts';

const CryptoPay = () => {
    const {
        convergeXWallet,
        convergeXBalances,
        metamaskWallet,
        userWallet,
        walletVerified,
        activeWallet,
        loading,
        isConnecting,
        connectWallet,
        transferCrypto,
        findConvergeXWallet,
        getActiveBalances,
        getActiveWalletAddress,
        setActiveWallet,
        convertFunds,
        exchangeRates,
        bankBalance,
        fetchBankBalance,
        fetchWalletInfo,
        fetchConvergeXWallet,
        lockTokensForUPI,
        hybridUpiToCrypto,
        findUserByUpi,
        cryptoBalances,
        chainId,
        txPending,
        lastTxHash,
        lastTxStatus,
    } = useCrypto();

    const [activeTab, setActiveTab] = useState('send');
    const [faucetLoading, setFaucetLoading] = useState(false);

    const handleFaucet = async () => {
        if (faucetLoading) return;
        setFaucetLoading(true);
        try {
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

    // Send Form State
    const [sendForm, setSendForm] = useState({
        recipient: '',
        amount: '',
        token: 'cxUSDC'
    });

    // Swap Form State
    const [swapForm, setSwapForm] = useState({
        from: 'UPI',
        amount: '',
        token: 'cxUSDC'
    });

    // Bridge Form State
    const [bridgeForm, setBridgeForm] = useState({
        direction: 'CRYPTO_TO_UPI',
        recipient: '',
        amount: '',
        token: 'cxUSDC'
    });
    const [bridgeRecipientInfo, setBridgeRecipientInfo] = useState(null);
    const [bridgeStep, setBridgeStep] = useState(1);
    const [bridgeResult, setBridgeResult] = useState(null);

    const [sending, setSending] = useState(false);
    const [step, setStep] = useState(1);
    const [recipientInfo, setRecipientInfo] = useState(null);
    const [sendResult, setSendResult] = useState(null);

    // ── Helpers ──
    const validateAddress = (address) => {
        return /^0x[a-fA-F0-9]{40}$/.test(address) || (address && address.startsWith('cx_') && address.length >= 20);
    };

    // Lookup recipient
    useEffect(() => {
        const lookupRecipient = async () => {
            if (!sendForm.recipient || !validateAddress(sendForm.recipient)) {
                setRecipientInfo(null);
                return;
            }
            try {
                const response = await findConvergeXWallet(sendForm.recipient);
                if (response.found) {
                    setRecipientInfo({ type: 'user', user: response.user });
                } else {
                    if (/^0x[a-fA-F0-9]{40}$/.test(sendForm.recipient)) {
                        setRecipientInfo({ type: 'external', message: 'External wallet' });
                    } else {
                        setRecipientInfo({ type: 'invalid', message: 'Not found' });
                    }
                }
            } catch { setRecipientInfo(null); }
        };
        const timer = setTimeout(lookupRecipient, 500);
        return () => clearTimeout(timer);
    }, [sendForm.recipient]);

    // ── SEND HANDLERS ──
    const handleSendSubmit = (e) => {
        e.preventDefault();
        if (!validateAddress(sendForm.recipient)) {
            showToast.error('Enter a valid wallet address (0x... or cx_...)');
            return;
        }
        if (!sendForm.amount || parseFloat(sendForm.amount) <= 0) {
            showToast.error('Enter valid amount');
            return;
        }
        if (!walletVerified) {
            showToast.error('Connect & verify your wallet first');
            return;
        }

        const balance = cryptoBalances.cxUSDC || 0;
        if (parseFloat(sendForm.amount) > balance) {
            showToast.error('Insufficient on-chain balance');
            return;
        }
        setStep(2);
    };

    const confirmSend = async () => {
        setSending(true);
        try {
            const result = await transferCrypto(
                sendForm.recipient,
                sendForm.amount,
                sendForm.token
            );
            setSendResult(result);
            setStep(3);
        } catch (error) {
            showToast.error(error?.message || 'Transfer failed');
        } finally {
            setSending(false);
        }
    };

    // ── SWAP HANDLER ──
    const handleSwap = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            const fromType = swapForm.from === 'UPI' ? 'upi' : 'crypto';
            await convertFunds(fromType, swapForm.amount, swapForm.token);
            setSwapForm(prev => ({ ...prev, amount: '' }));
            fetchBankBalance();
            fetchWalletInfo();
        } catch (error) {
            showToast.error(error?.response?.data?.message || error?.message || 'Swap failed');
        } finally {
            setSending(false);
        }
    };

    // ── Bridge: Recipient Lookup ──
    useEffect(() => {
        const lookupBridgeRecipient = async () => {
            const val = bridgeForm.recipient.trim();
            if (!val) { setBridgeRecipientInfo(null); return; }

            try {
                if (bridgeForm.direction === 'CRYPTO_TO_UPI') {
                    if (!val.includes('@')) { setBridgeRecipientInfo(null); return; }
                    const res = await findUserByUpi(val);
                    if (res.found) {
                        setBridgeRecipientInfo({ type: 'user', user: res.user });
                    } else {
                        setBridgeRecipientInfo({ type: 'invalid', message: 'UPI ID not found' });
                    }
                } else {
                    if (!/^0x[a-fA-F0-9]{40}$/.test(val)) { setBridgeRecipientInfo(null); return; }
                    const res = await findConvergeXWallet(val);
                    if (res.found) {
                        setBridgeRecipientInfo({ type: 'user', user: res.user });
                    } else {
                        setBridgeRecipientInfo({ type: 'external', message: 'External wallet' });
                    }
                }
            } catch { setBridgeRecipientInfo(null); }
        };
        const timer = setTimeout(lookupBridgeRecipient, 600);
        return () => clearTimeout(timer);
    }, [bridgeForm.recipient, bridgeForm.direction]);

    useEffect(() => {
        setBridgeRecipientInfo(null);
        setBridgeForm(prev => ({ ...prev, recipient: '' }));
        setBridgeStep(1);
        setBridgeResult(null);
    }, [bridgeForm.direction]);

    const handleBridgeReview = (e) => {
        e.preventDefault();
        const amt = parseFloat(bridgeForm.amount);
        if (!amt || amt <= 0) { showToast.error('Enter a valid amount'); return; }

        if (bridgeForm.direction === 'CRYPTO_TO_UPI') {
            if (!bridgeRecipientInfo || bridgeRecipientInfo.type === 'invalid') {
                showToast.error('Valid UPI recipient required'); return;
            }
            if (!walletVerified) { showToast.error('Verify your wallet first'); return; }
            if (amt > (cryptoBalances.cxUSDC || 0)) { showToast.error('Insufficient cxUSDC balance'); return; }
        } else {
            if (!bridgeRecipientInfo || bridgeRecipientInfo.type === 'invalid') {
                showToast.error('Valid wallet address required'); return;
            }
            if (amt > bankBalance) { showToast.error('Insufficient bank balance'); return; }
        }
        setBridgeStep(2);
    };

    const confirmBridge = async () => {
        setSending(true);
        try {
            let result;
            if (bridgeForm.direction === 'CRYPTO_TO_UPI') {
                result = await lockTokensForUPI(
                    bridgeForm.amount,
                    bridgeRecipientInfo?.user?.upiId || bridgeForm.recipient,
                    bridgeForm.token
                );
            } else {
                result = await hybridUpiToCrypto(
                    bridgeForm.recipient,
                    bridgeForm.amount,
                    bridgeForm.token
                );
            }
            setBridgeResult(result?.data || result);
            setBridgeStep(3);
            fetchBankBalance();
            fetchWalletInfo();
        } catch (error) {
            showToast.error(error?.response?.data?.message || error?.message || 'Bridge transfer failed');
        } finally {
            setSending(false);
        }
    };

    // ── Rate helpers ──
    const getBridgeTokenRate = () => exchangeRates[bridgeForm.token?.toLowerCase()] || exchangeRates.usdc || 90;
    const getTokenRate = () => exchangeRates[swapForm.token?.toLowerCase()] || exchangeRates.usdc || 90;

    const getBridgeEstimate = () => {
        const amt = parseFloat(bridgeForm.amount) || 0;
        if (amt === 0) return '0';
        const rate = getBridgeTokenRate();
        return bridgeForm.direction === 'CRYPTO_TO_UPI'
            ? `₹${(amt * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            : `${(amt / rate).toFixed(6)} ${bridgeForm.token}`;
    };

    const getSwapEstimate = () => {
        const amt = parseFloat(swapForm.amount) || 0;
        if (amt === 0) return 0;
        const rate = getTokenRate();
        return swapForm.from === 'UPI' ? (amt / rate).toFixed(4) : (amt * rate).toFixed(2);
    };

    if (loading) return <div className="text-center p-10 text-gray-400">Loading Vault...</div>;

    return (
        <div className="max-w-xl mx-auto space-y-8">

            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    Crypto Hub
                </h1>
                <p className="text-gray-400 text-sm">On-chain crypto powered by Sepolia testnet</p>
                {walletVerified && userWallet && (
                    <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="text-green-400">● Verified</span>
                        <EtherscanLink address={userWallet} />
                    </div>
                )}
            </div>

            {/* Network Guard */}
            <NetworkGuard currentChainId={chainId}>

            <LiveRateTicker />

            {/* Wallet connect prompt */}
            {!walletVerified && (
                <div className="glass-card p-4 border-yellow-500/20 flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                        <span className="text-yellow-400 font-medium">Connect & verify</span> your MetaMask wallet to use crypto features
                    </div>
                    <button
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
                    >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                </div>
            )}

            {/* Wallet Balance & Faucet */}
            {walletVerified && (
                <div className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm">
                            <span className="text-gray-400">cxUSDC: </span>
                            <span className="text-white font-mono font-bold">{(cryptoBalances.cxUSDC || 0).toFixed(4)}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-400">ETH: </span>
                            <span className="text-white font-mono">{(cryptoBalances.eth || 0).toFixed(5)}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleFaucet}
                        disabled={faucetLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                    >
                        <Droplets size={14} />
                        {faucetLoading ? 'Claiming...' : 'Get Test Tokens'}
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-gray-900/50 p-1 rounded-2xl flex border border-white/5 relative">
                {['send', 'bridge', 'swap'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                        {tab === 'send' && <><Send size={16} /> Send</>}
                        {tab === 'bridge' && <><ArrowLeftRight size={16} /> Bridge</>}
                        {tab === 'swap' && <><RefreshCw size={16} /> Swap</>}
                    </button>
                ))}
                <motion.div
                    layoutId="activeTab"
                    className="absolute top-1 bottom-1 bg-white/10 rounded-xl"
                    initial={false}
                    animate={{
                        left: activeTab === 'send' ? '4px' : activeTab === 'bridge' ? '33.33%' : '66.66%',
                        width: 'calc(33.33% - 4px)'
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            </div>

            {/* Main Card */}
            <AnimatePresence mode="wait">

                {/* ───────── SEND TAB ───────── */}
                {activeTab === 'send' && (
                    <motion.div key="send" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card p-6 border-purple-500/20">
                        {step === 1 && (
                            <form onSubmit={handleSendSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">Recipient Wallet</label>
                                        <div className="relative mt-2">
                                            <input type="text" placeholder="0x... or cx_..." value={sendForm.recipient}
                                                onChange={e => setSendForm({ ...sendForm, recipient: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono focus:border-purple-500 transition-colors"
                                            />
                                            {recipientInfo?.type === 'user' && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 flex items-center gap-1 text-xs bg-green-500/10 px-2 py-1 rounded">
                                                    <CheckCircle size={12} /> {recipientInfo.user.name}
                                                </div>
                                            )}
                                            {recipientInfo?.type === 'external' && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 flex items-center gap-1 text-xs bg-blue-500/10 px-2 py-1 rounded">
                                                    <ExternalLink size={12} /> External
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">Amount</label>
                                            <input type="number" placeholder="0.00" value={sendForm.amount}
                                                onChange={e => setSendForm({ ...sendForm, amount: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold text-lg mt-2 focus:border-purple-500 transition-colors outline-none"
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">Asset</label>
                                            <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold mt-2 text-center">
                                                cxUSDC
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-sm bg-white/5 p-3 rounded-lg">
                                    <span className="text-gray-400">On-chain balance:</span>
                                    <span className="text-white font-mono">{(cryptoBalances?.cxUSDC || 0).toFixed(4)} cxUSDC</span>
                                </div>
                                <button type="submit" className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all">
                                    Review Transfer
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <div className="text-center space-y-6 py-4">
                                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <Send size={32} className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-gray-400 mb-1">Sending to {recipientInfo?.user?.name || sendForm.recipient.slice(0, 8) + '...'}</h3>
                                    <h1 className="text-4xl font-bold text-white">{sendForm.amount} <span className="text-purple-400 text-2xl">cxUSDC</span></h1>
                                    <p className="text-xs text-gray-500 mt-2">MetaMask will prompt you to sign this transaction</p>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20">Back</button>
                                    <button onClick={confirmSend} disabled={sending || txPending} className="flex-1 py-3 bg-purple-600 rounded-xl text-white font-bold hover:bg-purple-500">
                                        {sending ? 'Signing...' : 'Confirm & Sign'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="text-center space-y-6 py-6">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle size={40} className="text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Transfer Confirmed!</h2>
                                {sendResult?.txHash && (
                                    <div className="space-y-2">
                                        <TransactionStatus status="CONFIRMED" txHash={sendResult.txHash} blockNumber={sendResult.blockNumber} compact={false} />
                                    </div>
                                )}
                                <button onClick={() => { setStep(1); setSendForm({ ...sendForm, amount: '', recipient: '' }); setSendResult(null); }} className="text-purple-400 hover:text-white">
                                    Send Another
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ───────── BRIDGE TAB ───────── */}
                {activeTab === 'bridge' && (
                    <motion.div key="bridge" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card p-6 border-emerald-500/20">
                        {bridgeStep === 1 && (
                            <form onSubmit={handleBridgeReview} className="space-y-5">
                                {/* Direction toggle */}
                                <div className="flex items-center gap-2 mb-2">
                                    <button type="button" onClick={() => setBridgeForm(prev => ({ ...prev, direction: 'CRYPTO_TO_UPI' }))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/20'}`}>
                                        <Wallet size={14} /> Crypto → UPI
                                    </button>
                                    <button type="button" onClick={() => setBridgeForm(prev => ({ ...prev, direction: 'UPI_TO_CRYPTO' }))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${bridgeForm.direction === 'UPI_TO_CRYPTO' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/20'}`}>
                                        <Landmark size={14} /> UPI → Crypto
                                    </button>
                                </div>

                                {/* Info */}
                                <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-blue-500/10 text-blue-300'}`}>
                                    <Zap size={14} className="mt-0.5 shrink-0" />
                                    {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                        ? 'Tokens locked on-chain via escrow contract. Receiver gets INR.'
                                        : 'INR deducted from bank. Tokens released on-chain to receiver.'}
                                </div>

                                {/* Recipient */}
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'Recipient UPI ID' : 'Recipient Wallet (0x...)'}
                                    </label>
                                    <div className="relative mt-2">
                                        <input type="text" placeholder={bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'friend@cxpay' : '0x...'}
                                            value={bridgeForm.recipient}
                                            onChange={e => setBridgeForm({ ...bridgeForm, recipient: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono focus:border-emerald-500 transition-colors"
                                        />
                                        {bridgeRecipientInfo?.type === 'user' && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 flex items-center gap-1 text-xs bg-green-500/10 px-2 py-1 rounded">
                                                <CheckCircle size={12} /> {bridgeRecipientInfo.user.name}
                                            </div>
                                        )}
                                        {bridgeRecipientInfo?.type === 'invalid' && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 flex items-center gap-1 text-xs bg-red-500/10 px-2 py-1 rounded">
                                                <AlertCircle size={12} /> {bridgeRecipientInfo.message}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'Amount (cxUSDC)' : 'Amount (₹ INR)'}
                                    </label>
                                    <input type="number" placeholder="0.00" value={bridgeForm.amount}
                                        onChange={e => setBridgeForm({ ...bridgeForm, amount: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold text-lg mt-2 focus:border-emerald-500 transition-colors outline-none"
                                    />
                                </div>

                                {/* Balance + Estimate */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm bg-white/5 p-3 rounded-lg">
                                        <span className="text-gray-400">Available:</span>
                                        <span className="text-white font-mono">
                                            {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                                ? `${(cryptoBalances?.cxUSDC || 0).toFixed(4)} cxUSDC`
                                                : `₹${bankBalance.toLocaleString('en-IN')}`}
                                        </span>
                                    </div>
                                    {parseFloat(bridgeForm.amount) > 0 && (
                                        <div className="flex items-center justify-between text-sm bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                                            <span className="text-gray-400">Recipient gets ≈</span>
                                            <span className="text-emerald-400 font-bold">{getBridgeEstimate()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-xs text-gray-500 px-2">
                                        <span>Rate</span>
                                        <span>1 cxUSDC = ₹{getBridgeTokenRate().toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <button type="submit" className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all">
                                    Review Bridge Transfer
                                </button>
                            </form>
                        )}

                        {bridgeStep === 2 && (
                            <div className="text-center space-y-6 py-4">
                                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                    <ArrowLeftRight size={32} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-gray-400 mb-1">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                            ? `Lock crypto → Send INR to ${bridgeRecipientInfo?.user?.name || bridgeForm.recipient}`
                                            : `Debit INR → Release crypto to ${bridgeRecipientInfo?.user?.name || bridgeForm.recipient.slice(0, 8) + '...'}`}
                                    </h3>
                                    <h1 className="text-3xl font-bold text-white">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                            ? <>{bridgeForm.amount} <span className="text-emerald-400 text-xl">cxUSDC</span></>
                                            : <>₹{parseFloat(bridgeForm.amount).toLocaleString('en-IN')}</>}
                                    </h1>
                                    <p className="text-sm text-gray-500 mt-2">Recipient gets ≈ {getBridgeEstimate()}</p>
                                    {bridgeForm.direction === 'CRYPTO_TO_UPI' && (
                                        <p className="text-xs text-yellow-400 mt-2">MetaMask will prompt 2 transactions: Approve + Lock</p>
                                    )}
                                </div>

                                <div className="bg-white/5 p-4 rounded-xl text-xs text-left space-y-2">
                                    <div className="flex justify-between"><span className="text-gray-400">From</span><span className="text-white">{bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'On-chain Wallet' : 'Bank (UPI)'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">To</span><span className="text-white">{bridgeRecipientInfo?.user?.name || bridgeForm.recipient}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Settlement</span><span className="text-white">{bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'Escrow Lock → INR Credit' : 'INR Debit → Token Release'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Rate</span><span className="text-white">1 cxUSDC = ₹{getBridgeTokenRate().toLocaleString('en-IN')}</span></div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setBridgeStep(1)} className="flex-1 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-colors">Back</button>
                                    <button onClick={confirmBridge} disabled={sending || txPending} className="flex-1 py-3 bg-emerald-600 rounded-xl text-white font-bold hover:bg-emerald-500 transition-colors">
                                        {sending ? 'Processing...' : bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'Sign & Lock' : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {bridgeStep === 3 && (
                            <div className="text-center space-y-6 py-6">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle size={40} className="text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Bridge Transfer Settled!</h2>

                                {bridgeResult && (
                                    <div className="space-y-3">
                                        <TransactionStatus
                                            status={bridgeResult.status || 'SETTLED'}
                                            txHash={bridgeResult.txHash}
                                            blockNumber={bridgeResult.blockNumber}
                                            confirmations={bridgeResult.confirmations}
                                        />
                                        {bridgeResult.etherscanUrl && (
                                            <a href={bridgeResult.etherscanUrl} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm">
                                                View on Etherscan <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => { setBridgeStep(1); setBridgeForm(prev => ({ ...prev, amount: '', recipient: '' })); setBridgeRecipientInfo(null); setBridgeResult(null); }}
                                    className="text-emerald-400 hover:text-white transition-colors"
                                >
                                    Another Bridge Transfer
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ───────── SWAP TAB ───────── */}
                {activeTab === 'swap' && (
                    <motion.div key="swap" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card p-1 border-blue-500/20 relative">
                        <form onSubmit={handleSwap} className="p-6 space-y-2">
                            {/* FROM */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-xs font-bold uppercase">From</span>
                                    <span className="text-gray-400 text-xs">
                                        Bal: {swapForm.from === 'UPI' ? `₹${bankBalance.toLocaleString('en-IN')}` : `${(cryptoBalances?.cxUSDC || 0).toFixed(4)} cxUSDC`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input type="number" placeholder="0.00" value={swapForm.amount}
                                        onChange={e => setSwapForm({ ...swapForm, amount: e.target.value })}
                                        className="bg-transparent text-3xl font-bold text-white w-full outline-none placeholder-gray-700"
                                    />
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${swapForm.from === 'UPI' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                        {swapForm.from === 'UPI' ? <Landmark size={14} /> : <Wallet size={14} />}
                                        {swapForm.from === 'UPI' ? 'INR' : 'cxUSDC'}
                                    </div>
                                </div>
                            </div>

                            {/* Switch */}
                            <div className="relative h-4">
                                <button type="button" onClick={() => setSwapForm(prev => ({ ...prev, from: prev.from === 'UPI' ? 'CRYPTO' : 'UPI' }))}
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gray-800 border-2 border-gray-900 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors z-10">
                                    <ArrowDown size={16} className="text-white" />
                                </button>
                            </div>

                            {/* TO */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-xs font-bold uppercase">To (Estimate)</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input type="text" readOnly value={getSwapEstimate()} className="bg-transparent text-3xl font-bold text-gray-400 w-full outline-none" />
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${swapForm.from !== 'UPI' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                        {swapForm.from !== 'UPI' ? <Landmark size={14} /> : <Wallet size={14} />}
                                        {swapForm.from !== 'UPI' ? 'INR' : 'cxUSDC'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-xs text-gray-500 px-2 py-2">
                                <span>Rate</span>
                                <span>1 cxUSDC ≈ ₹{getTokenRate().toLocaleString('en-IN')}</span>
                            </div>

                            {swapForm.from !== 'UPI' && (
                                <p className="text-xs text-yellow-400 text-center">MetaMask will prompt you to approve & lock tokens</p>
                            )}

                            <button type="submit" disabled={sending || txPending} className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all">
                                {sending ? 'Processing...' : 'Swap Now'}
                            </button>
                        </form>
                    </motion.div>
                )}

            </AnimatePresence>

            </NetworkGuard>
        </div>
    );
};

export default CryptoPay;
