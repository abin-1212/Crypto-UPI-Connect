import { motion } from 'framer-motion';
import { listItem } from '../../lib/animations';
import { ArrowUpRight, ArrowDownLeft, PlusCircle, Coins, ArrowLeftRight } from 'lucide-react';

const TransactionItem = ({ transaction, onClick }) => {
    const isIncoming = transaction.isIncoming;
    const isDeposit = transaction.type === 'DEPOSIT';
    const isCrypto = transaction.type === 'CRYPTO_TRANSFER' || transaction.paymentMethod === 'BLOCKCHAIN';
    const isHybrid = transaction.type === 'CRYPTO_TO_UPI' || transaction.type === 'UPI_TO_CRYPTO';

    // Determine display label and style
    let label, icon, colorClass, amountPrefix;

    if (isDeposit) {
        label = 'Added Money';
        icon = <PlusCircle size={20} />;
        colorClass = 'bg-green-500/10 text-green-400 group-hover:bg-green-500/20';
        amountPrefix = '+';
    } else if (isCrypto || isHybrid) {
        const name = isIncoming
            ? (transaction.fromUser?.name || transaction.fromUser?.email || 'Unknown')
            : (transaction.toUser?.name || transaction.toUser?.email || 'Unknown');
        label = isIncoming ? `Received from ${name}` : `Sent to ${name}`;
        icon = isHybrid ? <ArrowLeftRight size={20} /> : <Coins size={20} />;
        colorClass = 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20';
        amountPrefix = isIncoming ? '+' : '-';
    } else {
        const name = isIncoming
            ? (transaction.fromUser?.name || transaction.fromUser?.email || 'Unknown')
            : (transaction.toUser?.name || transaction.toUser?.email || 'Unknown');
        label = isIncoming ? `Received from ${name}` : `Sent to ${name}`;
        icon = isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />;
        colorClass = isIncoming
            ? 'bg-green-500/10 text-green-400 group-hover:bg-green-500/20'
            : 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20';
        amountPrefix = isIncoming ? '+' : '-';
    }

    const amountColor = (isDeposit || isIncoming) ? 'text-green-400' : 'text-white';

    return (
        <motion.div
            variants={listItem}
            layoutId={transaction._id}
            onClick={onClick}
            className="flex items-center justify-between p-4 my-1 rounded-xl cursor-pointer transition-all hover:bg-white/10 group active:scale-[0.99] border border-transparent hover:border-white/5"
        >
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${colorClass}`}>
                    {icon}
                </div>
                <div>
                    <h4 className="font-medium text-white group-hover:text-accent transition-colors">
                        {label}
                    </h4>
                    <p className="text-xs text-gray-400">
                        {new Date(transaction.createdAt).toLocaleDateString()} • {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {transaction.paymentMethod === 'STRIPE' && !isDeposit && ' • via Stripe'}
                    </p>
                </div>
            </div>
            <div className={`font-bold text-lg ${amountColor}`}>
                {amountPrefix}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}
            </div>
        </motion.div>
    );
};

export default TransactionItem;
