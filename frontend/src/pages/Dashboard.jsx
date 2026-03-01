import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { pageVariants, listContainer } from "../lib/animations";
import TransactionItem from "../components/ui/TransactionItem";
import Skeleton from "../components/ui/Skeleton";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCrypto } from "../context/CryptoContext";
import {
  ArrowRight,
  Send,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  Copy,
  TrendingUp,
  Landmark,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import { showToast } from "../utils/toast";
import { Link } from "react-router-dom";
import axios from "../api/client";

const Dashboard = () => {
  const { user } = useAuth();
  const {
    exchangeRates,
    convergeXWallet,
    convergeXBalances,
    metamaskWallet,
    metamaskBalances,
    isConnectingMetaMask,
    connectMetaMask
  } = useCrypto();

  const [balance, setBalance] = useState(0);
  const [upiId, setUpiId] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derived Values
  const cryptoNetWorth =
    (convergeXBalances?.usdc || 0) * (exchangeRates?.usdcToUsd || 1) * (exchangeRates?.usdToInr || 83) +
    (convergeXBalances?.dai || 0) * (exchangeRates?.daiToUsd || 1) * (exchangeRates?.usdToInr || 83) +
    (convergeXBalances?.eth || 0) * (exchangeRates?.ethToUsd || 2500) * (exchangeRates?.usdToInr || 83);

  const totalNetWorth = balance + cryptoNetWorth;

  const fetchData = async () => {
    setLoading(true);
    try {
      const balanceRes = await api.get("/bank/balance");
      setBalance(balanceRes.data.balance);
      setUpiId(balanceRes.data.upiId);

      const txRes = await api.get("/transactions", { params: { limit: 5 } });
      setTransactions((txRes.data.transactions || []).slice(0, 5));
    } catch (error) {
      console.error("Dashboard fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // KYC status badge
  const [kycStatus, setKycStatus] = useState("");
  useEffect(() => {
    axios.get("/kyc/status").then(res => setKycStatus(res.data.kycStatus || "not-submitted")).catch(() => setKycStatus("error"));
  }, []);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8"
    >
      {/* 1. HERO SECTION: NET WORTH */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 border border-white/10 shadow-2xl p-8 text-center"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="relative z-10">
          <h2 className="text-gray-400 text-sm tracking-widest uppercase mb-2">Total Net Worth</h2>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-gray-400 tracking-tight">
              ₹{totalNetWorth.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h1>
          </div>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-1 text-blue-400">
              <Landmark size={14} />
              <span>Fiat: {((balance / totalNetWorth) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1 text-purple-400">
              <Wallet size={14} />
              <span>Crypto: {((cryptoNetWorth / totalNetWorth) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. SPLIT VIEW: FIAT VS CRYPTO */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* LEFT: UNIVERSAL BANK (FIAT) */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Landmark size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">Universal Bank</h3>
          </div>

          <div className="glass-card p-6 bg-gradient-to-br from-blue-900/40 to-slate-900/40 border-blue-500/30 relative overflow-hidden group">
            {/* Decorative background circle */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all"></div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <CreditCard className="text-blue-300" size={32} />
                <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">Active</span>
              </div>

              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-1">Available Balance</p>
                <h2 className="text-3xl font-bold text-white">₹{balance.toLocaleString('en-IN')}</h2>
              </div>

              <div className="flex justify-between items-end border-t border-white/10 pt-4">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">UPI ID</p>
                  <p className="text-gray-300 font-mono flex items-center gap-2">
                    {upiId || 'Loading...'}
                    <button onClick={() => { navigator.clipboard.writeText(upiId); showToast.success("UPI ID Copied") }} className="hover:text-white"><Copy size={12} /></button>
                  </p>
                </div>
                <Link to="/add-money" className="bg-green-500/20 text-green-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors flex items-center gap-1">
                  <PlusCircle size={14} /> Add Money
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT: CONVERGEX VAULT (CRYPTO) */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Wallet size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">ConvergeX Vault</h3>
          </div>

          <div className="glass-card p-6 bg-gradient-to-br from-purple-900/40 to-fuchsia-900/40 border-purple-500/30 relative overflow-hidden group">
            {/* Decorative background circle */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all"></div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <div className="bg-white/10 p-2 rounded-lg">
                    <TrendingUp className="text-purple-300" size={20} />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Internal Wallet</p>
                    <p className="text-purple-300 text-xs flex items-center gap-1">
                      {convergeXWallet?.address ? `${convergeXWallet.address.substring(0, 6)}...${convergeXWallet.address.slice(-4)}` : '...'}
                      <button onClick={() => { navigator.clipboard.writeText(convergeXWallet?.address); showToast.success("Wallet Address Copied") }} className="hover:text-white"><Copy size={10} /></button>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Est. Value (₹)</p>
                  <p className="text-xl font-bold text-white">≈ {cryptoNetWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>

              {/* Token List */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'USDC', balance: convergeXBalances?.usdc, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { name: 'DAI', balance: convergeXBalances?.dai, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { name: 'ETH', balance: convergeXBalances?.eth, color: 'text-gray-300', bg: 'bg-gray-500/10' },
                ].map((token) => (
                  <div key={token.name} className={`${token.bg} rounded-xl p-3 border border-white/5`}>
                    <p className={`text-xs font-bold ${token.color} mb-1`}>{token.name}</p>
                    <p className="text-white font-mono text-sm">{token.balance?.toFixed(2) || '0.00'}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet size={14} className="text-orange-400" />
                  <span className="text-xs text-gray-400">MetaMask:</span>
                  <span className="text-xs text-white">{metamaskWallet ? 'Connected' : 'Not Connected'}</span>
                </div>
                {!metamaskWallet && (
                  <button onClick={connectMetaMask} disabled={isConnectingMetaMask} className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded hover:bg-orange-500/30 transition-colors">
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* 3. QUICK ACTIONS & KYC */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-6 gap-4"
      >
        <Link to="/send" className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group border-blue-500/20 hover:border-blue-500/50 hover:-translate-y-1">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
            <Send size={24} />
          </div>
          <span className="font-medium text-white">Send Money</span>
        </Link>

        <Link to="/add-money" className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group border-green-500/20 hover:border-green-500/50 hover:-translate-y-1">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform shadow-lg shadow-green-500/10">
            <PlusCircle size={24} />
          </div>
          <span className="font-medium text-white">Add Money</span>
        </Link>

        <Link to="/pay-crypto" className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group border-purple-500/20 hover:border-purple-500/50 hover:-translate-y-1">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/10">
            <RefreshCw size={24} />
          </div>
          <span className="font-medium text-white text-center">Swap / Crypto</span>
        </Link>

        <Link to="/requests" className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group border-cyan-500/20 hover:border-cyan-500/50 hover:-translate-y-1">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/10">
            <ArrowLeftRight size={24} />
          </div>
          <span className="font-medium text-white">Requests</span>
        </Link>

        <Link to="/transactions" className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group border-emerald-500/20 hover:border-emerald-500/50 hover:-translate-y-1">
                  {/* KYC STATUS BADGE */}
                  <Link to="/kyc" className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group border-indigo-500/20 hover:border-indigo-500/50 hover:-translate-y-1">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/10"
                      style={{ background: kycStatus === "verified" ? "#22c55e" : kycStatus === "pending" ? "#eab308" : kycStatus === "rejected" ? "#ef4444" : "#6366f1" }}>
                      <ShieldCheck size={24} />
                    </div>
                    <span className="font-medium text-white text-xs">KYC: {kycStatus ? kycStatus.toUpperCase() : "NOT SUBMITTED"}</span>
                  </Link>
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
            <TrendingUp size={24} />
          </div>
          <span className="font-medium text-white">History</span>
        </Link>
      </motion.div>

      {/* 4. RECENT ACTIVITY LIST */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl text-white">Recent Activity</h3>
          <Link to="/transactions" className="text-xs text-blue-400 hover:text-white transition-colors flex items-center gap-1">
            View All <ArrowRight size={14} />
          </Link>
        </div>

        <div className="relative">
          {/* Visual connector line */}
          <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-800 -z-10"></div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading activity...</div>
            ) : transactions.length > 0 ? (
              transactions.map((tx) => {
                const isIncoming = tx.toUser === user?.id || tx.toUser?._id === user?.id;
                return (
                  <TransactionItem
                    key={tx._id}
                    transaction={{ ...tx, isIncoming }}
                    currentUserId={user?.id}
                  />
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">No recent transactions</div>
            )}
          </div>
        </div>
      </div>

    </motion.div>
  );
};

export default Dashboard;
