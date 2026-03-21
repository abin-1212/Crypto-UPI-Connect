import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["not_submitted", "pending", "under_review", "approved", "rejected"],
      default: "not_submitted",
    },
    fullName: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    address: {
      type: String,
      trim: true,
    },
    documentType: {
      type: String,
      enum: ["aadhaar", "pan", "passport"],
    },
    documentNumber: {
      type: String,
    },
    documentFrontUrl: {
      type: String,
    },
    documentBackUrl: {
      type: String,
    },
    selfieUrl: {
      type: String,
    },
    adminRemarks: {
      type: String,
      trim: true,
    },
    submittedAt: {
      type: Date,
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Kyc = mongoose.model("Kyc", kycSchema);
export default Kyc;
