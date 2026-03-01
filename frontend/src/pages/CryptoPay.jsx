import { useState, useEffect } from 'react';
import { useCrypto } from '../context/CryptoContext';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '../utils/toast';
import LiveRateTicker from '../components/ui/LiveRateTicker';
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
    Zap
} from 'lucide-react';

const CryptoPay = () => {
    const {
        convergeXWallet,
        convergeXBalances,
        metamaskWallet,
        activeWallet,
        loading,
        isConnectingMetaMask,
        connectMetaMask,
        transferConvergeXCrypto,
        findConvergeXWallet,
        getActiveBalances,
        getActiveWalletAddress,
        setActiveWallet,
        convertFunds,
        exchangeRates,
        bankBalance,
        fetchBankBalance,
        fetchConvergeXWallet,
        hybridCryptoToUpi,
        hybridUpiToCrypto,
        findUserByUpi
    } = useCrypto();

    const [activeTab, setActiveTab] = useState('send'); // 'send', 'swap', or 'bridge'

    // Send Form State
    const [sendForm, setSendForm] = useState({
        recipient: '',
        amount: '',
        token: 'USDC'
    });

    // Swap Form State
    const [swapForm, setSwapForm] = useState({
        from: 'UPI', // 'UPI' or 'CRYPTO'
        amount: '',
        token: 'USDC'
    });

    // Bridge Form State (Hybrid Cross-User Transfers)
    const [bridgeForm, setBridgeForm] = useState({
        direction: 'CRYPTO_TO_UPI', // 'CRYPTO_TO_UPI' or 'UPI_TO_CRYPTO'
        recipient: '',              // UPI ID or cx_ wallet address
        amount: '',
        token: 'USDC'
    });
    const [bridgeRecipientInfo, setBridgeRecipientInfo] = useState(null);
    const [bridgeStep, setBridgeStep] = useState(1); // 1=form, 2=review, 3=success

    const [sending, setSending] = useState(false);
    const [step, setStep] = useState(1);
    const [recipientInfo, setRecipientInfo] = useState(null);

    // --- Logic Helpers ---

    // Validate Address
    const validateConvergeXAddress = (address) => {
        return address && address.startsWith('cx_') && address.length >= 20;
    };

    // Lookup recipient effect
    useEffect(() => {
        const lookupRecipient = async () => {
            if (!sendForm.recipient || !validateConvergeXAddress(sendForm.recipient)) {
                setRecipientInfo(null);
                return;
            }
            try {
                const response = await findConvergeXWallet(sendForm.recipient);
                if (response.found) {
                    setRecipientInfo({ type: 'user', user: response.user });
                } else {
                    setRecipientInfo({ type: 'invalid', message: 'Invalid Address' });
                }
            } catch (error) {
                setRecipientInfo(null);
            }
        };
        const delayDebounce = setTimeout(lookupRecipient, 500);
        return () => clearTimeout(delayDebounce);
    }, [sendForm.recipient]);

    // Handlers
    const handleSendSubmit = async (e) => {
        e.preventDefault();
        if (!validateConvergeXAddress(sendForm.recipient)) {
            showToast.error('Invalid address format');
            return;
        }
        if (!sendForm.amount || parseFloat(sendForm.amount) <= 0) {
            showToast.error('Enter valid amount');
            return;
        }
        const balance = getActiveBalances()[sendForm.token.toLowerCase()] || 0;
        if (parseFloat(sendForm.amount) > balance) {
            showToast.error('Insufficient balance');
            return;
        }
        if (!recipientInfo || recipientInfo.type !== 'user') {
            showToast.error('Valid recipient required');
            return;
        }
        setStep(2);
    };

    const confirmSend = async () => {
        setSending(true);
        try {
            await transferConvergeXCrypto(sendForm.recipient, sendForm.amount, sendForm.token);
            showToast.success('Transfer Successful');
            setStep(3);
        } catch (error) {
            showToast.error(error.message || 'Failed');
        } finally {
            setSending(false);
        }
    };

    const handleSwap = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            const fromType = swapForm.from === 'UPI' ? 'upi' : 'crypto';
            await convertFunds(fromType, swapForm.amount, swapForm.token);
            setSwapForm(prev => ({ ...prev, amount: '' }));
            // Refresh balances after swap
            fetchBankBalance();
            fetchConvergeXWallet();
        } catch (error) {
            showToast.error(error.message || 'Swap failed');
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
                    // Recipient is a UPI ID — look up via bank route
                    if (!val.includes('@')) { setBridgeRecipientInfo(null); return; }
                    const res = await findUserByUpi(val);
                    if (res.found) {
                        setBridgeRecipientInfo({ type: 'user', user: res.user });
                    } else {
                        setBridgeRecipientInfo({ type: 'invalid', message: 'UPI ID not found' });
                    }
                } else {
                    // Recipient is a ConvergeX wallet address — look up via wallet route
                    if (!validateConvergeXAddress(val)) { setBridgeRecipientInfo(null); return; }
                    const res = await findConvergeXWallet(val);
                    if (res.found) {
                        setBridgeRecipientInfo({ type: 'user', user: res.user });
                    } else {
                        setBridgeRecipientInfo({ type: 'invalid', message: 'Wallet not found' });
                    }
                }
            } catch {
                setBridgeRecipientInfo(null);
            }
        };
        const timer = setTimeout(lookupBridgeRecipient, 600);
        return () => clearTimeout(timer);
    }, [bridgeForm.recipient, bridgeForm.direction]);

    // Reset bridge recipient when direction changes
    useEffect(() => {
        setBridgeRecipientInfo(null);
        setBridgeForm(prev => ({ ...prev, recipient: '' }));
        setBridgeStep(1);
    }, [bridgeForm.direction]);

    // Bridge: Review handler
    const handleBridgeReview = (e) => {
        e.preventDefault();
        if (!bridgeRecipientInfo || bridgeRecipientInfo.type !== 'user') {
            showToast.error('Valid recipient required');
            return;
        }
        const amt = parseFloat(bridgeForm.amount);
        if (!amt || amt <= 0) {
            showToast.error('Enter a valid amount');
            return;
        }
        if (bridgeForm.direction === 'CRYPTO_TO_UPI') {
            const bal = getActiveBalances()[bridgeForm.token.toLowerCase()] || 0;
            if (amt > bal) { showToast.error(`Insufficient ${bridgeForm.token} balance`); return; }
        } else {
            if (amt > bankBalance) { showToast.error('Insufficient bank balance'); return; }
        }
        setBridgeStep(2);
    };

    // Bridge: Confirm handler
    const confirmBridge = async () => {
        setSending(true);
        try {
            if (bridgeForm.direction === 'CRYPTO_TO_UPI') {
                await hybridCryptoToUpi(
                    bridgeRecipientInfo.user.upiId || bridgeForm.recipient,
                    bridgeForm.amount,
                    bridgeForm.token
                );
            } else {
                await hybridUpiToCrypto(
                    bridgeRecipientInfo.user.id,
                    bridgeForm.amount,
                    bridgeForm.token
                );
            }
            setBridgeStep(3);
            fetchBankBalance();
            fetchConvergeXWallet();
        } catch (error) {
            showToast.error(error?.response?.data?.message || error.message || 'Bridge transfer failed');
        } finally {
            setSending(false);
        }
    };

    // Bridge: Estimate display
    const getBridgeEstimate = () => {
        const amt = parseFloat(bridgeForm.amount) || 0;
        if (amt === 0) return '0';
        const rate = getBridgeTokenRate();
        if (bridgeForm.direction === 'CRYPTO_TO_UPI') {
            return `₹${(amt * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
        } else {
            return `${(amt / rate).toFixed(6)} ${bridgeForm.token}`;
        }
    };

    const getBridgeTokenRate = () => {
        const key = bridgeForm.token.toLowerCase();
        return exchangeRates[key] || 90;
    };

    // Calculations for Swap
    const getTokenRate = () => {
        const token = swapForm.token.toLowerCase();
        return exchangeRates[token] || 90;
    };

    const getSwapEstimate = () => {
        const amt = parseFloat(swapForm.amount) || 0;
        if (amt === 0) return 0;

        const rate = getTokenRate();

        if (swapForm.from === 'UPI') {
            // INR -> Crypto
            return (amt / rate).toFixed(4);
        } else {
            // Crypto -> INR
            return (amt * rate).toFixed(2);
        }
    };

    if (loading) return <div className="text-center p-10 text-gray-400">Loading Vault...</div>;

    return (
        <div className="max-w-xl mx-auto space-y-8">

            {/* 1. HEADER */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    Crypto Hub
                </h1>
                <p className="text-gray-400 text-sm">Seamlessly bridge your worlds</p>
            </div>

            {/* LIVE MARKET RATES */}
            <LiveRateTicker />

            {/* 2. TABS */}
            <div className="bg-gray-900/50 p-1 rounded-2xl flex border border-white/5 relative">
                <button
                    onClick={() => setActiveTab('send')}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'send' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                >
                    <Send size={16} /> Send Crypto
                </button>
                <button
                    onClick={() => setActiveTab('bridge')}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'bridge' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                >
                    <ArrowLeftRight size={16} /> Bridge
                </button>
                <button
                    onClick={() => setActiveTab('swap')}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'swap' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                >
                    <RefreshCw size={16} /> Swap
                </button>

                {/* Animated Background for Tab */}
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

            {/* 3. MAIN CARD */}
            <AnimatePresence mode="wait">

                {/* === SEND INTERFACE === */}
                {activeTab === 'send' && (
                    <motion.div
                        key="send"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card p-6 border-purple-500/20"
                    >
                        {step === 1 && (
                            <form onSubmit={handleSendSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">Recipient</label>
                                        <div className="relative mt-2">
                                            <input
                                                type="text"
                                                placeholder="cx_..."
                                                value={sendForm.recipient}
                                                onChange={e => setSendForm({ ...sendForm, recipient: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono focus:border-purple-500 transition-colors"
                                            />
                                            {recipientInfo?.type === 'user' && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 flex items-center gap-1 text-xs bg-green-500/10 px-2 py-1 rounded">
                                                    <CheckCircle size={12} /> {recipientInfo.user.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">Amount</label>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={sendForm.amount}
                                                onChange={e => setSendForm({ ...sendForm, amount: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold text-lg mt-2 focus:border-purple-500 transition-colors outline-none"
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">Asset</label>
                                            <select
                                                value={sendForm.token}
                                                onChange={e => setSendForm({ ...sendForm, token: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold mt-2 focus:border-purple-500 transition-colors outline-none"
                                            >
                                                <option>USDC</option>
                                                <option>DAI</option>
                                                <option>ETH</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm bg-white/5 p-3 rounded-lg">
                                    <span className="text-gray-400">Available:</span>
                                    <span className="text-white font-mono">
                                        {(getActiveBalances()[sendForm.token.toLowerCase()] || 0).toFixed(4)} {sendForm.token}
                                    </span>
                                </div>

                                <button type="submit" className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all">
                                    Review Transfer
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <div className="text-center space-y-6 py-4">
                                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                    <Send size={32} className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-gray-400 mb-1">Sending to {recipientInfo?.user?.name}</h3>
                                    <h1 className="text-4xl font-bold text-white">{sendForm.amount} <span className="text-purple-400 text-2xl">{sendForm.token}</span></h1>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20">Back</button>
                                    <button onClick={confirmSend} disabled={sending} className="flex-1 py-3 bg-purple-600 rounded-xl text-white font-bold hover:bg-purple-500">
                                        {sending ? 'Sending...' : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="text-center space-y-6 py-6">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle size={40} className="text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Sent Successfully!</h2>
                                <button onClick={() => { setStep(1); setSendForm({ ...sendForm, amount: '' }) }} className="text-purple-400 hover:text-white">Send Another</button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* === BRIDGE INTERFACE (Crypto ↔ UPI Cross-User) === */}
                {activeTab === 'bridge' && (
                    <motion.div
                        key="bridge"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card p-6 border-emerald-500/20"
                    >
                        {bridgeStep === 1 && (
                            <form onSubmit={handleBridgeReview} className="space-y-5">
                                {/* Direction Toggle */}
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setBridgeForm(prev => ({ ...prev, direction: 'CRYPTO_TO_UPI' }))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${bridgeForm.direction === 'CRYPTO_TO_UPI'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                            : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/20'}`}
                                    >
                                        <Wallet size={14} /> Crypto → UPI
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBridgeForm(prev => ({ ...prev, direction: 'UPI_TO_CRYPTO' }))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${bridgeForm.direction === 'UPI_TO_CRYPTO'
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                            : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/20'}`}
                                    >
                                        <Landmark size={14} /> UPI → Crypto
                                    </button>
                                </div>

                                {/* Info banner */}
                                <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-blue-500/10 text-blue-300'}`}>
                                    <Zap size={14} className="mt-0.5 shrink-0" />
                                    {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                        ? 'Your crypto will be converted and sent as INR to the recipient\'s UPI account.'
                                        : 'Your INR will be deducted from your bank and sent as crypto to the recipient\'s wallet.'}
                                </div>

                                {/* Token selector */}
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Token</span>
                                    <div className="flex gap-2">
                                        {['USDC', 'DAI', 'ETH'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setBridgeForm(prev => ({ ...prev, token: t }))}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${bridgeForm.token === t
                                                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                                    : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/20'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Recipient Input */}
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'Recipient UPI ID' : 'Recipient Wallet Address'}
                                    </label>
                                    <div className="relative mt-2">
                                        <input
                                            type="text"
                                            placeholder={bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'friend@cxpay' : 'cx_...'}
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

                                {/* Amount Input */}
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider ml-1">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI' ? `Amount (${bridgeForm.token})` : 'Amount (₹ INR)'}
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={bridgeForm.amount}
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
                                                ? `${(getActiveBalances()[bridgeForm.token.toLowerCase()] || 0).toFixed(4)} ${bridgeForm.token}`
                                                : `₹${bankBalance.toLocaleString('en-IN')}`
                                            }
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
                                        <span>1 {bridgeForm.token} = ₹{getBridgeTokenRate().toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all"
                                >
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
                                            ? `Sending crypto to ${bridgeRecipientInfo?.user?.name}'s UPI`
                                            : `Sending INR to ${bridgeRecipientInfo?.user?.name}'s Wallet`}
                                    </h3>
                                    <h1 className="text-3xl font-bold text-white">
                                        {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                            ? <>{bridgeForm.amount} <span className="text-emerald-400 text-xl">{bridgeForm.token}</span></>
                                            : <>₹{parseFloat(bridgeForm.amount).toLocaleString('en-IN')}</>
                                        }
                                    </h1>
                                    <p className="text-sm text-gray-500 mt-2">Recipient gets ≈ {getBridgeEstimate()}</p>
                                </div>

                                <div className="bg-white/5 p-4 rounded-xl text-xs text-left space-y-2">
                                    <div className="flex justify-between"><span className="text-gray-400">From</span><span className="text-white">{bridgeForm.direction === 'CRYPTO_TO_UPI' ? 'Your Crypto Wallet' : 'Your Bank (UPI)'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">To</span><span className="text-white">{bridgeRecipientInfo?.user?.name} ({bridgeForm.direction === 'CRYPTO_TO_UPI' ? bridgeForm.recipient : 'Wallet'})</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Token</span><span className="text-white">{bridgeForm.token}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Rate</span><span className="text-white">1 {bridgeForm.token} = ₹{getBridgeTokenRate().toLocaleString('en-IN')}</span></div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setBridgeStep(1)} className="flex-1 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-colors">Back</button>
                                    <button onClick={confirmBridge} disabled={sending} className="flex-1 py-3 bg-emerald-600 rounded-xl text-white font-bold hover:bg-emerald-500 transition-colors">
                                        {sending ? 'Processing...' : 'Confirm Bridge'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {bridgeStep === 3 && (
                            <div className="text-center space-y-6 py-6">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle size={40} className="text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Bridge Transfer Complete!</h2>
                                <p className="text-gray-400 text-sm">
                                    {bridgeForm.direction === 'CRYPTO_TO_UPI'
                                        ? `${bridgeForm.amount} ${bridgeForm.token} converted & sent as INR`
                                        : `₹${bridgeForm.amount} converted & sent as ${bridgeForm.token}`}
                                </p>
                                <button
                                    onClick={() => { setBridgeStep(1); setBridgeForm(prev => ({ ...prev, amount: '', recipient: '' })); setBridgeRecipientInfo(null); }}
                                    className="text-emerald-400 hover:text-white transition-colors"
                                >
                                    Send Another Bridge Transfer
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* === SWAP INTERFACE === */}
                {activeTab === 'swap' && (
                    <motion.div
                        key="swap"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card p-1 border-blue-500/20 relative"
                    >
                        <form onSubmit={handleSwap} className="p-6 space-y-2">
                            {/* TOKEN SELECTOR */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Select Token</span>
                                <div className="flex gap-2">
                                    {['USDC', 'DAI', 'ETH'].map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setSwapForm(prev => ({ ...prev, token: t }))}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${swapForm.token === t
                                                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                                                : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* FROM SECTION */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-xs font-bold uppercase">From</span>
                                    <span className="text-gray-400 text-xs">
                                        Bal: {swapForm.from === 'UPI' ? `₹${bankBalance.toLocaleString('en-IN')}` : `${(getActiveBalances()[swapForm.token.toLowerCase()] || 0).toFixed(4)} ${swapForm.token}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={swapForm.amount}
                                        onChange={e => setSwapForm({ ...swapForm, amount: e.target.value })}
                                        className="bg-transparent text-3xl font-bold text-white w-full outline-none placeholder-gray-700"
                                    />
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${swapForm.from === 'UPI' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                        {swapForm.from === 'UPI' ? <Landmark size={14} /> : <Wallet size={14} />}
                                        {swapForm.from === 'UPI' ? 'INR' : swapForm.token}
                                    </div>
                                </div>
                            </div>

                            {/* SWITCH BUTTON */}
                            <div className="relative h-4">
                                <button
                                    type="button"
                                    onClick={() => setSwapForm(prev => ({ ...prev, from: prev.from === 'UPI' ? 'CRYPTO' : 'UPI' }))}
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gray-800 border-2 border-gray-900 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors z-10"
                                >
                                    <ArrowDown size={16} className="text-white" />
                                </button>
                            </div>

                            {/* TO SECTION */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400 text-xs font-bold uppercase">To (Rough Estimate)</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="text"
                                        readOnly
                                        value={getSwapEstimate()}
                                        className="bg-transparent text-3xl font-bold text-gray-400 w-full outline-none"
                                    />
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${swapForm.from !== 'UPI' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                        {swapForm.from !== 'UPI' ? <Landmark size={14} /> : <Wallet size={14} />}
                                        {swapForm.from !== 'UPI' ? 'INR' : swapForm.token}
                                    </div>
                                </div>
                            </div>

                            {/* Rate Info */}
                            <div className="flex justify-between items-center text-xs text-gray-500 px-2 py-2">
                                <span>Rate</span>
                                <span>1 {swapForm.token} ≈ ₹{getTokenRate().toLocaleString('en-IN')}</span>
                            </div>

                            <button type="submit" disabled={sending} className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all">
                                {sending ? 'Swapping...' : 'Swap Now'}
                            </button>
                        </form>
                    </motion.div>
                )}

            </AnimatePresence>

        </div>
    );
};

export default CryptoPay;
