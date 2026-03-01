import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/client";
import { showToast } from "../utils/toast";
import {
  CreditCard,
  IndianRupee,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ==============================================
   Main AddMoney Page — Stripe Checkout (hosted)
============================================== */
const PRESET_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000];

const AddMoney = () => {
  const [step, setStep] = useState("amount"); // amount | verifying | success
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // On mount, check if returning from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const cancelled = params.get("cancelled");

    if (sessionId) {
      verifySession(sessionId);
    } else if (cancelled) {
      showToast.error("Payment was cancelled");
      // Clean URL
      window.history.replaceState({}, "", "/add-money");
    }
  }, []);

  const verifySession = async (sessionId) => {
    setStep("verifying");
    try {
      const res = await api.post("/stripe/verify-session", { sessionId });
      setSuccessData(res.data);
      setStep("success");
      showToast.success(res.data.message || "Money added successfully!");
      // Clean URL
      window.history.replaceState({}, "", "/add-money");
    } catch (err) {
      showToast.error(err.response?.data?.message || "Payment verification failed");
      setStep("amount");
      window.history.replaceState({}, "", "/add-money");
    }
  };

  const handleCheckout = async () => {
    const num = Number(amount);
    if (!num || num < 1) {
      showToast.error("Enter a valid amount (min ₹1)");
      return;
    }
    if (num > 500000) {
      showToast.error("Maximum amount is ₹5,00,000");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/stripe/create-checkout-session", {
        amount: num,
      });

      // Redirect to Stripe's hosted checkout page
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        showToast.error("Failed to get checkout URL");
      }
    } catch (err) {
      showToast.error(err.response?.data?.message || "Failed to initiate payment");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-lg mx-auto space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-sm mb-4 border border-green-500/20">
          <Zap size={16} />
          <span>Instant Add Money</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Add Money to Wallet</h1>
        <p className="text-gray-400 mt-2">
          Securely add funds via card powered by Stripe
        </p>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === "amount" && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="glass-card p-6 space-y-6"
          >
            {/* Amount Input */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Enter Amount
              </label>
              <div className="relative">
                <IndianRupee
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  max="500000"
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-3xl font-bold text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
            </div>

            {/* Preset Amounts */}
            <div>
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">
                Quick Select
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset.toString())}
                    className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                      Number(amount) === preset
                        ? "bg-accent/20 border-accent/50 text-accent"
                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    ₹{preset.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={!amount || Number(amount) < 1 || loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <>
                  <CreditCard size={20} />
                  Pay ₹{Number(amount || 0).toLocaleString("en-IN")} via Stripe
                  <ExternalLink size={16} />
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500">
              You'll be redirected to Stripe's secure checkout page
            </p>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { icon: Shield, label: "Secure", sub: "SSL Encrypted" },
                { icon: Zap, label: "Instant", sub: "Real-time Credit" },
                { icon: CreditCard, label: "Cards", sub: "Visa, MC, RuPay" },
              ].map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="text-center py-3 bg-white/5 rounded-xl border border-white/5"
                >
                  <Icon size={18} className="mx-auto mb-1 text-gray-400" />
                  <p className="text-xs font-medium text-white">{label}</p>
                  <p className="text-[10px] text-gray-500">{sub}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-12 text-center space-y-4"
          >
            <Loader2 size={48} className="animate-spin text-accent mx-auto" />
            <h2 className="text-xl font-bold text-white">Verifying Payment...</h2>
            <p className="text-gray-400">Please wait while we confirm your payment</p>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto"
            >
              <CheckCircle2 size={40} className="text-green-400" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Payment Successful!
              </h2>
              <p className="text-gray-400">
                Money has been added to your ConvergeX wallet
              </p>
            </div>

            {successData && (
              <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount Added</span>
                  <span className="text-green-400 font-bold">
                    +₹
                    {Number(
                      successData.transaction?.amount || 0
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">New Balance</span>
                  <span className="text-white font-bold">
                    ₹{Number(successData.newBalance || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Transaction ID</span>
                  <span className="text-gray-300 text-xs font-mono">
                    {successData.transaction?.transactionId?.slice(0, 16)}...
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link
                to="/dashboard"
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors font-medium text-center"
              >
                Dashboard
              </Link>
              <button
                onClick={() => {
                  setStep("amount");
                  setAmount("");
                  setSuccessData(null);
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-accent to-blue-500 text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Add More
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AddMoney;
