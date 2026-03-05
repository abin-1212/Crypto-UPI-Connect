import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../api/client";
import { showToast } from "../utils/toast";
import { Download, Coins, CreditCard, ArrowUpRight, ArrowDownLeft, Landmark, ArrowLeftRight, PlusCircle } from "lucide-react";

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get("/pay/history");
      setTransactions(response.data);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Apply type filter
    if (filterType !== "all") {
      if (filterType === "sent" && !tx.isSent) return false;
      if (filterType === "received" && tx.isSent) return false;
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tx.fromUserName?.toLowerCase().includes(query) ||
        tx.toUserName?.toLowerCase().includes(query) ||
        tx.fromUpi?.toLowerCase().includes(query) ||
        tx.toUpi?.toLowerCase().includes(query) ||
        tx.amount?.toString().includes(query)
      );
    }

    return true;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleExport = () => {
    const csvContent = [
      ['Date', 'From', 'To', 'Amount', 'Status', 'Type'],
      ...filteredTransactions.map(txn => [
        new Date(txn.date).toLocaleDateString(),
        txn.fromUserName || txn.fromUpi,
        txn.toUserName || txn.toUpi,
        txn.amount,
        txn.status || 'COMPLETED',
        txn.isSent ? 'Sent' : 'Received'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    showToast.success('Transactions exported successfully!');
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
            <p className="text-gray-400">
              View all your payments and receipts in one place
            </p>
          </div>
          {filteredTransactions.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download size={18} />
              Export CSV
            </button>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, UPI ID, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-lg ${filterType === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300"
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("sent")}
              className={`px-4 py-2 rounded-lg ${filterType === "sent"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-300"
                }`}
            >
              Sent
            </button>
            <button
              onClick={() => setFilterType("received")}
              className={`px-4 py-2 rounded-lg ${filterType === "received"
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-300"
                }`}
            >
              Received
            </button>
          </div>
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="text-left p-4">Transaction</th>
                    <th className="text-left p-4">Date & Time</th>
                    <th className="text-left p-4">Amount</th>
                    <th className="text-left p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    // Determine transaction category for display
                    const isDeposit = tx.type === 'DEPOSIT';
                    const isCrypto = tx.paymentMethod === 'BLOCKCHAIN' || tx.type === 'CRYPTO_TRANSFER';
                    const isHybrid = tx.type === 'CRYPTO_TO_UPI' || tx.type === 'UPI_TO_CRYPTO';
                    const isStripe = tx.paymentMethod === 'STRIPE' && !isDeposit;
                    const isIncoming = !tx.isSent;

                    // Choose icon & colors based on type
                    let icon, iconBg, iconColor, label, sublabel, amountColor, amountPrefix;

                    if (isDeposit) {
                      icon = <PlusCircle size={20} />;
                      iconBg = 'bg-green-900/30';
                      iconColor = 'text-green-400';
                      label = 'Added Money';
                      sublabel = `via ${tx.paymentMethod === 'STRIPE' ? 'Stripe' : 'Deposit'}`;
                      amountColor = 'text-green-400';
                      amountPrefix = '+';
                    } else if (isCrypto || isHybrid) {
                      icon = <Coins size={20} />;
                      iconBg = isIncoming ? 'bg-purple-900/30' : 'bg-purple-900/40';
                      iconColor = 'text-purple-400';
                      if (tx.type === 'CRYPTO_TO_UPI') {
                        label = isIncoming ? 'Received (Crypto→UPI)' : 'Sent (Crypto→UPI)';
                      } else if (tx.type === 'UPI_TO_CRYPTO') {
                        label = isIncoming ? 'Received (UPI→Crypto)' : 'Sent (UPI→Crypto)';
                      } else {
                        label = isIncoming ? 'Received Crypto' : 'Sent Crypto';
                      }
                      sublabel = isIncoming
                        ? `From: ${tx.fromUserName || tx.fromUpi || 'Unknown'}`
                        : `To: ${tx.toUserName || tx.toUpi || 'Unknown'}`;
                      amountColor = isIncoming ? 'text-green-400' : 'text-white';
                      amountPrefix = isIncoming ? '+' : '-';
                    } else {
                      // UPI / Stripe send / Request payment
                      icon = tx.isSent ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />;
                      iconBg = tx.isSent ? 'bg-red-900/30' : 'bg-green-900/30';
                      iconColor = tx.isSent ? 'text-red-400' : 'text-green-400';
                      label = tx.isSent
                        ? `To: ${tx.toUserName || tx.toUpi || 'Unknown'}`
                        : `From: ${tx.fromUserName || tx.fromUpi || 'Unknown'}`;
                      sublabel = tx.isSent ? (tx.toUpi || '') : (tx.fromUpi || '');
                      if (isStripe) sublabel += ' (via Stripe)';
                      if (tx.type === 'REQUEST_ACCEPTED') sublabel = 'Request payment';
                      amountColor = tx.isSent ? 'text-red-400' : 'text-green-400';
                      amountPrefix = tx.isSent ? '-' : '+';
                    }

                    // Status badge
                    const statusColor = {
                      COMPLETED: 'bg-green-900/30 text-green-400',
                      SETTLED: 'bg-green-900/30 text-green-400',
                      CONFIRMED: 'bg-green-900/30 text-green-400',
                      PENDING: 'bg-yellow-900/30 text-yellow-400',
                      FAILED: 'bg-red-900/30 text-red-400',
                    }[tx.status] || 'bg-gray-700 text-gray-300';

                    // Display amount — for crypto show token, for fiat show ₹
                    const displayAmount = (isCrypto && !isHybrid)
                      ? `${amountPrefix} ${Math.abs(tx.amount)} ${tx.tokenType || 'cxUSDC'}`
                      : `${amountPrefix}${formatAmount(tx.amount)}`;

                    return (
                      <motion.tr
                        key={tx.id || tx._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`border-b border-gray-700 hover:bg-gray-750 ${(isCrypto || isHybrid) ? 'bg-purple-900/5' : ''}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}>
                              {icon}
                            </div>
                            <div>
                              <p className="font-medium">{label}</p>
                              <p className="text-sm text-gray-400">{sublabel}</p>
                              {tx.tokenType && (isCrypto || isHybrid) && (
                                <p className="text-xs text-purple-400/70 font-mono">{tx.tokenType}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-gray-300">{formatDate(tx.date || tx.createdAt)}</p>
                        </td>
                        <td className="p-4">
                          <p className={`font-semibold ${amountColor}`}>
                            {displayAmount}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                            {tx.status || 'Completed'}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 rounded-2xl">
            <div className="w-24 h-24 mx-auto mb-6 text-gray-600">
              <svg
                className="w-full h-full"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium mb-2">
              {searchQuery || filterType !== "all"
                ? "No matching transactions"
                : "No transactions yet"}
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {searchQuery
                ? "Try a different search term"
                : "Your transaction history will appear here once you start sending or receiving money"}
            </p>
            {!searchQuery && filterType === "all" && (
              <button
                onClick={() => (window.location.href = "/send")}
                className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                Send Your First Payment
              </button>
            )}
          </div>
        )}

        {/* Summary Stats */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold">{filteredTransactions.length}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Total Sent</p>
              <p className="text-2xl font-bold text-red-400">
                {formatAmount(
                  filteredTransactions
                    .filter((tx) => tx.isSent)
                    .reduce((sum, tx) => sum + tx.amount, 0)
                )}
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Total Received</p>
              <p className="text-2xl font-bold text-green-400">
                {formatAmount(
                  filteredTransactions
                    .filter((tx) => !tx.isSent)
                    .reduce((sum, tx) => sum + tx.amount, 0)
                )}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default Transactions;
