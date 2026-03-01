/**
 * TransactionStatus — Visual status indicator for blockchain transactions
 *
 * States: PENDING → CONFIRMED → SETTLED (or FAILED)
 */
import { motion } from 'framer-motion';
import { Clock, CheckCircle, ShieldCheck, XCircle, Loader2 } from 'lucide-react';
import EtherscanLink from './EtherscanLink';

const statusConfig = {
  PENDING: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'Pending',
    description: 'Waiting for on-chain confirmation...',
    pulse: true,
  },
  CONFIRMED: {
    icon: CheckCircle,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    label: 'Confirmed',
    description: 'Transaction confirmed on-chain',
    pulse: false,
  },
  SETTLED: {
    icon: ShieldCheck,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'Settled',
    description: 'Fully settled and verified',
    pulse: false,
  },
  COMPLETED: {
    icon: ShieldCheck,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'Completed',
    description: 'Transaction complete',
    pulse: false,
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Failed',
    description: 'Transaction failed',
    pulse: false,
  },
};

const TransactionStatus = ({
  status = 'PENDING',
  txHash,
  confirmations = 0,
  blockNumber,
  compact = false,
}) => {
  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} ${config.border} border`}>
        {config.pulse
          ? <Loader2 size={12} className="animate-spin" />
          : <Icon size={12} />
        }
        {config.label}
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${config.border} ${config.bg}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          {config.pulse
            ? <Loader2 size={20} className={`${config.color} animate-spin`} />
            : <Icon size={20} className={config.color} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium ${config.color}`}>{config.label}</span>
            {confirmations > 0 && (
              <span className="text-xs text-gray-500">
                {confirmations} confirmation{confirmations !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-2">{config.description}</p>
          {txHash && <EtherscanLink txHash={txHash} />}
          {blockNumber && (
            <p className="text-xs text-gray-500 mt-1">Block #{blockNumber}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default TransactionStatus;
