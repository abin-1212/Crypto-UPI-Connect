/**
 * GasEstimate — Shows estimated gas cost for a transaction
 */
import { Fuel } from 'lucide-react';

const GasEstimate = ({ estimatedCostEth, gasLimit, loading = false }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-1">
        <Fuel size={12} className="animate-pulse" />
        <span>Estimating gas...</span>
      </div>
    );
  }

  if (!estimatedCostEth) return null;

  const costNum = parseFloat(estimatedCostEth);

  return (
    <div className="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-lg">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Fuel size={12} />
        <span>Est. Gas</span>
      </div>
      <div className="text-right">
        <span className="text-gray-300 font-mono">
          {costNum < 0.0001 ? '< 0.0001' : costNum.toFixed(6)} ETH
        </span>
        {gasLimit && (
          <span className="text-gray-500 ml-2">({parseInt(gasLimit).toLocaleString()} gas)</span>
        )}
      </div>
    </div>
  );
};

export default GasEstimate;
