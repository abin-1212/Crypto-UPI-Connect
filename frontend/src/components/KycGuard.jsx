import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../utils/toast";
import api from "../api/client";

/**
 * KycGuard — Higher Order Component
 * Ensures user's KYC is approved before accessing protected features
 *
 * If KYC is not approved, redirects to /kyc with a toast notification
 *
 * Usage:
 * <KycGuard>
 *   <CryptoPay />
 * </KycGuard>
 */
const KycGuard = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isKycApproved, setIsKycApproved] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const verifyKyc = async () => {
      try {
        const response = await api.get("/kyc/status");
        const approved = response.data?.kyc === true;
        setIsKycApproved(approved);

        if (!approved) {
          showToast("error", "Complete KYC verification to access payments");
          navigate("/kyc");
        }
      } catch (error) {
        console.error("Error verifying KYC:", error);
        showToast("error", "Unable to verify KYC status");
        navigate("/kyc");
      } finally {
        setLoading(false);
      }
    };

    verifyKyc();
  }, [user, navigate]);

  // Still loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
          </div>
          <p className="mt-4 text-gray-400">Verifying KYC status...</p>
        </div>
      </div>
    );
  }

  // KYC not approved
  if (!isKycApproved) {
    return null; // Redirect happens in useEffect
  }

  // KYC is approved, render children
  return children;
};

export default KycGuard;
