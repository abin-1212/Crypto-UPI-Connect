import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api/client';
import { showToast } from '../utils/toast';

/**
 * TransactionGuard - Prevents users from transacting without KYC approval
 * Wraps transaction pages (Send Money, Add Money, Crypto Pay, etc.)
 */
const TransactionGuard = ({ children, featureName = 'This feature' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkKYCStatus = async () => {
      try {
        const response = await api.get('/kyc/status');
        setKycStatus(response.data);

        // If user doesn't have KYC approved, don't allow access
        if (!response.data.kyc || response.data.status !== 'approved') {
          showToast('error', `⚠️ KYC verification required to use ${featureName}`);
          navigate('/kyc');
        }
      } catch (error) {
        console.error('KYC status check failed:', error);
        showToast('error', 'Failed to verify KYC status');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkKYCStatus();
    }
  }, [user, featureName, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // User doesn't have KYC approved - show block message
  if (!kycStatus?.kyc || kycStatus?.status !== 'approved') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex items-center justify-center px-4"
      >
        <div className="glass p-8 rounded-lg border border-red-500/30 max-w-md text-center">
          <AlertCircle size={64} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2 text-white">KYC Required</h2>
          <p className="text-gray-400 mb-6">
            {featureName} requires KYC (Know Your Customer) verification for security and compliance.
          </p>
          {kycStatus?.status === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-4 mb-6">
              <p className="text-red-300 text-sm">
                <strong>Rejection Reason:</strong> {kycStatus?.adminRemarks || 'Your submission was rejected'}
              </p>
            </div>
          )}
          <button
            onClick={() => navigate('/kyc')}
            className="w-full px-6 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg font-semibold transition"
          >
            Complete KYC Verification
          </button>
        </div>
      </motion.div>
    );
  }

  // User has KYC approved - show content
  return <>{children}</>;
};

export default TransactionGuard;
