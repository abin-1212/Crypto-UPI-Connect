import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, RefreshCw, Wifi } from 'lucide-react';
import api from '../../api/client';

const TOKEN_META = {
    BTC: { name: 'Bitcoin', icon: '₿', color: 'from-orange-500 to-amber-500' },
    ETH: { name: 'Ethereum', icon: 'Ξ', color: 'from-blue-500 to-indigo-500' },
    USDC: { name: 'USD Coin', icon: '$', color: 'from-blue-400 to-cyan-400' },
    DAI: { name: 'Dai', icon: '◈', color: 'from-yellow-500 to-amber-400' },
};

const formatINR = (num) => {
    if (!num) return '₹0';
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    return `₹${num.toFixed(2)}`;
};

const formatVolume = (num) => {
    if (!num) return '₹0';
    if (num >= 10000000000000) return `₹${(num / 10000000000000).toFixed(1)}T Cr`;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
};

export default function LiveRateTicker() {
    const [marketData, setMarketData] = useState({});
    const [rates, setRates] = useState({});
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(false);

    const fetchRates = async (showSpinner = false) => {
        if (showSpinner) setIsRefreshing(true);
        try {
            const res = await api.get('/wallet/rates');
            if (res.data.success) {
                setRates(res.data.rates || {});
                setMarketData(res.data.marketData || {});
                setLastUpdated(new Date(res.data.updatedAt));
                setError(false);
            }
        } catch {
            setError(true);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRates();
        const interval = setInterval(() => fetchRates(), 60_000); // auto-refresh every 60s
        return () => clearInterval(interval);
    }, []);

    const tokens = ['BTC', 'ETH', 'USDC', 'DAI'];

    return (
        <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Wifi size={14} className={error ? 'text-red-400' : 'text-emerald-400'} />
                        {!error && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                    </div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Market Rates</span>
                </div>
                <div className="flex items-center gap-2">
                    {lastUpdated && (
                        <span className="text-[10px] text-gray-500">
                            {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchRates(true)}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                        title="Refresh rates"
                    >
                        <RefreshCw size={12} className={`text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Token Cards */}
            <div className="grid grid-cols-2 gap-2">
                <AnimatePresence mode="popLayout">
                    {tokens.map((symbol, i) => {
                        const meta = TOKEN_META[symbol];
                        const data = marketData[symbol] || {};
                        const rate = rates[symbol] || 0;
                        const change = data.change24h || 0;
                        const isUp = change >= 0;

                        return (
                            <motion.div
                                key={symbol}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/5 hover:bg-white/8 border border-white/5 rounded-xl p-3 space-y-2 transition-colors cursor-default group"
                            >
                                {/* Token header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
                                            {meta.icon}
                                        </div>
                                        <div>
                                            <p className="text-white text-xs font-semibold leading-none">{symbol}</p>
                                            <p className="text-gray-500 text-[10px] leading-none mt-0.5">{meta.name}</p>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${isUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                        {isUp ? '+' : ''}{change}%
                                    </div>
                                </div>

                                {/* Price */}
                                <div>
                                    <p className="text-white text-sm font-bold">{formatINR(rate)}</p>
                                    {data.usd && (
                                        <p className="text-gray-500 text-[10px]">${data.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                                    )}
                                </div>

                                {/* Volume (shown on hover) */}
                                <div className="h-0 group-hover:h-auto overflow-hidden transition-all">
                                    <div className="flex justify-between text-[9px] text-gray-500 pt-1 border-t border-white/5">
                                        <span>24h Vol</span>
                                        <span>{formatVolume(data.volume24h)}</span>
                                    </div>
                                    {data.marketCap > 0 && (
                                        <div className="flex justify-between text-[9px] text-gray-500">
                                            <span>Mkt Cap</span>
                                            <span>{formatVolume(data.marketCap)}</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-1 pt-1">
                <span className="text-[9px] text-gray-600">Powered by</span>
                <span className="text-[9px] text-emerald-500 font-medium">CoinGecko API</span>
                <span className="text-[9px] text-gray-600">• Auto-refreshes every 60s</span>
            </div>
        </div>
    );
}
