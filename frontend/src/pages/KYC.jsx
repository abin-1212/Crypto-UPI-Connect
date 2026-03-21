import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Webcam from "react-webcam";
import {
  Upload,
  Camera,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import api from "../api/client";
import { showToast } from "../utils/toast";
import "./KYC.css";

const KYC = () => {
  const navigate = useNavigate();
  const webcamRef = useRef(null);

  // Form steps
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal Details
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [documentType, setDocumentType] = useState("aadhaar");
  const [documentNumber, setDocumentNumber] = useState("");

  // Step 2: Document Upload
  const [docFront, setDocFront] = useState(null);
  const [docFrontPreview, setDocFrontPreview] = useState(null);
  const [docBack, setDocBack] = useState(null);
  const [docBackPreview, setDocBackPreview] = useState(null);

  // Step 3: Selfie
  const [useCam, setUseCam] = useState(false);
  const [selfie, setSelfie] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);

  // Success state
  const [submitted, setSubmitted] = useState(false);

  // ────────────────────────────────────────────────────────
  // Step 1 Handlers
  // ────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!fullName.trim()) {
      showToast("error", "Please enter your full name");
      return false;
    }
    if (!dateOfBirth) {
      showToast("error", "Please select your date of birth");
      return false;
    }
    if (!address.trim()) {
      showToast("error", "Please enter your address");
      return false;
    }
    if (!documentNumber.trim()) {
      showToast("error", `Please enter your ${documentType}`);
      return false;
    }
    return true;
  };

  // ────────────────────────────────────────────────────────
  // Step 2 Handlers (File Upload)
  // ────────────────────────────────────────────────────────
  const handleFileChange = (file, setter, previewSetter) => {
    if (file) {
      setter(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        previewSetter(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep2 = () => {
    if (!docFront) {
      showToast("error", "Please upload document front");
      return false;
    }
    if (!docBack) {
      showToast("error", "Please upload document back");
      return false;
    }
    return true;
  };

  // ────────────────────────────────────────────────────────
  // Step 3 Handlers (Selfie)
  // ────────────────────────────────────────────────────────
  const captureSelfie = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Convert DataURL to Blob
        fetch(imageSrc)
          .then((res) => res.blob())
          .then((blob) => {
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            handleFileChange(file, setSelfie, setSelfiePreview);
            setUseCam(false);
          });
      }
    }
  };

  const handleSelfieUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file, setSelfie, setSelfiePreview);
    }
  };

  const validateStep3 = () => {
    if (!selfie) {
      showToast("error", "Please capture or upload a selfie");
      return false;
    }
    return true;
  };

  // ────────────────────────────────────────────────────────
  // Submit Handler
  // ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("dateOfBirth", dateOfBirth);
      formData.append("address", address);
      formData.append("documentType", documentType);
      formData.append("documentNumber", documentNumber);
      formData.append("docFront", docFront);
      formData.append("docBack", docBack);
      formData.append("selfie", selfie);

      const response = await api.post("/kyc/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setSubmitted(true);
        showToast("success", "KYC submitted successfully!");
        setTimeout(() => {
          navigate("/dashboard");
        }, 3000);
      }
    } catch (error) {
      console.error("KYC submission error:", error);
      showToast("error", error.response?.data?.message || "Failed to submit KYC");
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // Navigation Handlers
  // ────────────────────────────────────────────────────────
  const goToNextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  const goToPrevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // ────────────────────────────────────────────────────────
  // Success Screen
  // ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="kyc-success-container">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="kyc-success-card"
        >
          <CheckCircle size={64} className="success-icon" />
          <h2>KYC Submitted Successfully</h2>
          <p>Your documents are under review</p>
          <p className="status-text">
            We'll notify you once verification is complete
          </p>
          <p className="redirect-text">Redirecting to dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="kyc-container">
      {/* Header */}
      <header className="kyc-header">
        <h1>Complete Your KYC Verification</h1>
        <p>Secure verification in 3 simple steps</p>
      </header>

      {/* Progress Bar */}
      <div className="kyc-progress-wrapper">
        <div className="kyc-progress-bar">
          <motion.div
            className="kyc-progress-fill"
            initial={{ width: "0%" }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="kyc-step-indicators">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`step-indicator ${step === s ? "active" : ""} ${
                s < step ? "completed" : ""
              }`}
            >
              {s < step ? <CheckCircle size={24} /> : s}
            </div>
          ))}
        </div>
      </div>

      {/* Form Container */}
      <motion.div
        className="kyc-form-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        key={step}
      >
        {/* Step 1: Personal Details */}
        {step === 1 && (
          <div className="kyc-step">
            <h2>Step 1: Personal Details</h2>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Date of Birth *</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Address *</label>
              <input
                type="text"
                placeholder="123 Main Street, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Document Type *</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN</option>
                  <option value="passport">Passport</option>
                </select>
              </div>

              <div className="form-group">
                <label>Document Number *</label>
                <input
                  type="text"
                  placeholder={
                    documentType === "pan"
                      ? "ABCDE1234F"
                      : documentType === "aadhaar"
                        ? "123456789012"
                        : "A1234567"
                  }
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="kyc-step">
            <h2>Step 2: Document Upload</h2>

            <div className="document-upload-section">
              <div className="upload-box">
                <label htmlFor="docFrontInput">
                  {docFrontPreview ? (
                    <div className="preview-wrapper">
                      <img src={docFrontPreview} alt="Front" />
                      <button
                        className="remove-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          setDocFront(null);
                          setDocFrontPreview(null);
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <Upload size={32} />
                      <p>Upload Document Front</p>
                      <span>JPG, PNG, or PDF (Max 5MB)</span>
                    </div>
                  )}
                </label>
                <input
                  id="docFrontInput"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file, setDocFront, setDocFrontPreview);
                  }}
                  hidden
                />
              </div>

              <div className="upload-box">
                <label htmlFor="docBackInput">
                  {docBackPreview ? (
                    <div className="preview-wrapper">
                      <img src={docBackPreview} alt="Back" />
                      <button
                        className="remove-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          setDocBack(null);
                          setDocBackPreview(null);
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <Upload size={32} />
                      <p>Upload Document Back</p>
                      <span>JPG, PNG, or PDF (Max 5MB)</span>
                    </div>
                  )}
                </label>
                <input
                  id="docBackInput"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file, setDocBack, setDocBackPreview);
                  }}
                  hidden
                />
              </div>
            </div>

            <div className="info-box">
              <AlertCircle size={20} />
              <p>Make sure documents are clear, not blurry, and properly lit</p>
            </div>
          </div>
        )}

        {/* Step 3: Selfie */}
        {step === 3 && (
          <div className="kyc-step">
            <h2>Step 3: Selfie Verification</h2>

            {!useCam && !selfiePreview && (
              <div className="selfie-options">
                <button
                  className="option-btn camera"
                  onClick={() => setUseCam(true)}
                >
                  <Camera size={32} />
                  <span>Capture Selfie</span>
                </button>
                <p className="or-divider">OR</p>
                <label className="option-btn upload">
                  <Upload size={32} />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleSelfieUpload}
                    hidden
                  />
                </label>
              </div>
            )}

            {useCam && !selfiePreview && (
              <div className="webcam-section">
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="webcam-feed"
                  videoConstraints={{ facingMode: "user" }}
                />
                <div className="webcam-actions">
                  <button
                    className="btn-capture"
                    onClick={captureSelfie}
                  >
                    <Camera size={20} />
                    Capture
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => setUseCam(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {selfiePreview && (
              <div className="selfie-preview-section">
                <img src={selfiePreview} alt="Selfie" className="selfie-preview" />
                <button
                  className="btn-retake"
                  onClick={() => {
                    setSelfie(null);
                    setSelfiePreview(null);
                    setUseCam(false);
                  }}
                >
                  Retake Selfie
                </button>
              </div>
            )}

            <div className="info-box">
              <AlertCircle size={20} />
              <p>Make sure your face is clearly visible against a plain background</p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="kyc-form-footer">
          {step > 1 && (
            <button className="btn-secondary" onClick={goToPrevStep} disabled={loading}>
              <ChevronLeft size={20} />
              Previous
            </button>
          )}

          {step < 3 ? (
            <button className="btn-primary" onClick={goToNextStep} disabled={loading}>
              Next
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              className="btn-primary btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit KYC"}
              <CheckCircle size={20} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default KYC;
