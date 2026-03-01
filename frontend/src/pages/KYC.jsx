import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import axios from "../api/client.js";

const KYC = () => {
  const { user } = useContext(AuthContext);
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [kycReason, setKycReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchKycStatus();
  }, [user]);

  const fetchKycStatus = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/kyc/status");
      setKycStatus(res.data.kycStatus);
      setPanNumber(res.data.panNumber || "");
      setAadhaarNumber(res.data.aadhaarNumber || "");
    } catch (err) {
      setKycStatus("error");
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post("/kyc/submit", { panNumber, aadhaarNumber });
      setKycStatus(res.data.status);
      setKycReason(res.data.reason);
    } catch (err) {
      setKycStatus("error");
      setKycReason("Submission failed");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">KYC Verification</h2>
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded text-white ${kycStatus === "verified" ? "bg-green-500" : kycStatus === "pending" ? "bg-yellow-500" : kycStatus === "rejected" ? "bg-red-500" : "bg-gray-400"}`}>
          {kycStatus ? kycStatus.toUpperCase() : "NOT SUBMITTED"}
        </span>
        {kycReason && <div className="text-sm text-gray-600 mt-2">{kycReason}</div>}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">PAN Number</label>
          <input
            type="text"
            value={panNumber}
            onChange={e => setPanNumber(e.target.value)}
            className="w-full border rounded px-3 py-2 mt-1"
            placeholder="ABCDE1234F"
            disabled={kycStatus === "verified" || loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Aadhaar Number</label>
          <input
            type="text"
            value={aadhaarNumber}
            onChange={e => setAadhaarNumber(e.target.value)}
            className="w-full border rounded px-3 py-2 mt-1"
            placeholder="123456789012"
            disabled={kycStatus === "verified" || loading}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold mt-2"
          disabled={kycStatus === "verified" || loading}
        >
          {loading ? "Submitting..." : "Submit KYC"}
        </button>
      </form>
    </div>
  );
};

export default KYC;
