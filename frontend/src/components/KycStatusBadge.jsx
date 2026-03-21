import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
} from "lucide-react";
import api from "../api/client";
import "./KycStatusBadge.css";

const KycStatusBadge = ({ onStatusChange }) => {
  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchKycStatus = useCallback(async () => {
    try {
      const response = await api.get("/kyc/status");
      console.log('KYC Status fetched:', response.data);
      setKycData(response.data);
      onStatusChange?.(response.data);
    } catch (error) {
      console.error("Error fetching KYC status:", error);
      setKycData({ status: "not_submitted" });
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    // Initial fetch
    fetchKycStatus();

    // Set up polling - check every 5 seconds for status updates
    const pollingInterval = setInterval(() => {
      fetchKycStatus();
    }, 5000);

    // Also listen for page visibility - refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing KYC status');
        fetchKycStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchKycStatus]);

  if (loading) {
    return <div className="kyc-badge loading" />;
  }

  const status = kycData?.status || "not_submitted";
  const adminRemarks = kycData?.adminRemarks;
  const isApproved = kycData?.kyc === true && status === "approved";
  const isRejected = status === "rejected";
  const isPending = status === "pending" || status === "under_review";
  const isNotSubmitted = status === "not_submitted";

  const statusConfig = {
    not_submitted: {
      icon: AlertCircle,
      label: "KYC NOT SUBMITTED",
      color: "red",
      action: "Complete KYC",
      actionPath: "/kyc",
      description: "Complete your KYC to access transactions",
      clickable: true,
    },
    pending: {
      icon: Clock,
      label: "PENDING VERIFICATION",
      color: "yellow",
      action: null,
      subtext: "Your KYC is being reviewed by our team",
      clickable: false,
    },
    under_review: {
      icon: Clock,
      label: "UNDER REVIEW",
      color: "yellow",
      action: null,
      subtext: "Your KYC is being reviewed by our team",
      clickable: false,
    },
    approved: {
      icon: CheckCircle,
      label: "KYC VERIFIED ✓",
      color: "green",
      action: null,
      subtext: "Your account is fully verified and ready to transact",
      clickable: false,
    },
    rejected: {
      icon: XCircle,
      label: "KYC REJECTED",
      color: "red",
      action: "Resubmit KYC",
      actionPath: "/kyc",
      subtext: "Your submission was rejected. Please resubmit.",
      clickable: true,
    },
  };

  const config = statusConfig[status] || statusConfig.not_submitted;
  const Icon = config.icon;
  const isClickable = config.clickable;

  return (
    <div className={`kyc-badge kyc-${config.color} ${isApproved ? 'approved-state' : ''} ${!isClickable ? 'cursor-not-allowed opacity-90' : ''}`}>
      <div className="badge-header relative">
        <Icon size={24} className={`badge-icon ${isApproved ? 'animate-pulse' : ''}`} />
        <div className="flex-1">
          <span className="badge-label font-bold">{config.label}</span>
          {config.description && (
            <p className="text-xs text-gray-400 mt-1">{config.description}</p>
          )}
        </div>
        {isApproved && (
          <Lock size={16} className="text-green-400 opacity-50" />
        )}
      </div>

      {config.subtext && (
        <p className="badge-subtext mt-2 text-sm">{config.subtext}</p>
      )}

      {adminRemarks && isRejected && (
        <div className="badge-remarks mt-3 bg-red-500/10 rounded p-3 border-l-2 border-red-500">
          <p className="remarks-label text-xs font-semibold text-red-400 mb-1">Rejection Reason:</p>
          <p className="remarks-text text-xs text-red-200">{adminRemarks}</p>
        </div>
      )}

      {config.action && config.actionPath && isClickable && (
        <Link 
          to={config.actionPath} 
          className="badge-action-btn mt-3 block text-center px-4 py-2 rounded bg-accent/20 hover:bg-accent/30 text-accent font-medium text-sm transition"
        >
          {config.action}
        </Link>
      )}

      {isApproved && (
        <div className="mt-3 p-3 bg-green-500/10 rounded border border-green-500/30">
          <p className="text-xs text-green-300 flex items-center gap-2">
            <CheckCircle size={14} />
            ✓ Transaction access enabled
          </p>
        </div>
      )}

      {isPending && (
        <div className="mt-3 p-3 bg-yellow-500/10 rounded border border-yellow-500/30">
          <p className="text-xs text-yellow-300">
            Please wait while your documents are being verified...
          </p>
        </div>
      )}
    </div>
  );
};

export default KycStatusBadge;
