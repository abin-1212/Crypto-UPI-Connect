/**
 * EtherscanLink — Clickable Etherscan link for tx hashes / addresses
 */
import { ExternalLink } from 'lucide-react';
import { BLOCK_EXPLORER } from '../../config/contracts';

const EtherscanLink = ({ txHash, address, label, className = '' }) => {
  const url = txHash
    ? `${BLOCK_EXPLORER}/tx/${txHash}`
    : address
      ? `${BLOCK_EXPLORER}/address/${address}`
      : null;

  if (!url) return null;

  const displayText = label || (txHash
    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
    : `${address.slice(0, 6)}...${address.slice(-4)}`);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors text-sm font-mono ${className}`}
    >
      {displayText}
      <ExternalLink size={12} />
    </a>
  );
};

export default EtherscanLink;
