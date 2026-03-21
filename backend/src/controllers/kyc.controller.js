import Kyc from "../models/Kyc.js";
import User from "../models/User.js";

/**
 * Submit KYC with documents
 * Creates or updates KYC record with files
 * Prevents resubmission if approved or under_review
 */
export const submitKYC = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, dateOfBirth, address, documentType, documentNumber } = req.body;

    // Validate required fields
    if (!fullName || !dateOfBirth || !address || !documentType || !documentNumber) {
      return res.status(400).json({ message: "All personal details are required" });
    }

    // Check if files are uploaded
    if (!req.files || !req.files.docFront || !req.files.docBack || !req.files.selfie) {
      return res.status(400).json({ message: "All three documents (front, back, selfie) are required" });
    }

    // Check existing KYC status
    let kyc = await Kyc.findOne({ userId });

    if (kyc && (kyc.status === "approved" || kyc.status === "under_review")) {
      return res.status(400).json({
        message: `Cannot resubmit KYC. Current status: ${kyc.status}`,
      });
    }

    // Prepare file paths
    const docFrontUrl = `/uploads/kyc/${userId}/${req.files.docFront[0].filename}`;
    const docBackUrl = `/uploads/kyc/${userId}/${req.files.docBack[0].filename}`;
    const selfieUrl = `/uploads/kyc/${userId}/${req.files.selfie[0].filename}`;

    // Create or update KYC
    if (!kyc) {
      kyc = new Kyc({
        userId,
        fullName,
        dateOfBirth,
        address,
        documentType,
        documentNumber,
        documentFrontUrl: docFrontUrl,
        documentBackUrl: docBackUrl,
        selfieUrl: selfieUrl,
        status: "pending",
        submittedAt: new Date(),
      });
    } else {
      // Update existing
      kyc.fullName = fullName;
      kyc.dateOfBirth = dateOfBirth;
      kyc.address = address;
      kyc.documentType = documentType;
      kyc.documentNumber = documentNumber;
      kyc.documentFrontUrl = docFrontUrl;
      kyc.documentBackUrl = docBackUrl;
      kyc.selfieUrl = selfieUrl;
      kyc.status = "pending";
      kyc.submittedAt = new Date();
    }

    await kyc.save();

    res.json({
      success: true,
      message: "KYC submitted successfully. Under review.",
      kycId: kyc._id,
      status: kyc.status,
    });
  } catch (error) {
    console.error("KYC submit error:", error);
    res.status(500).json({ message: "Error submitting KYC", error: error.message });
  }
};

/**
 * Get KYC status for logged-in user
 */
export const getKYCStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const kyc = await Kyc.findOne({ userId });

    if (!kyc) {
      return res.json({
        userId,
        status: "not_submitted",
        kyc: false,
      });
    }

    res.json({
      _id: kyc._id,
      userId,
      status: kyc.status,
      fullName: kyc.fullName,
      dateOfBirth: kyc.dateOfBirth,
      address: kyc.address,
      documentType: kyc.documentType,
      documentNumber: kyc.documentNumber,
      documentFrontUrl: kyc.documentFrontUrl,
      documentBackUrl: kyc.documentBackUrl,
      selfieUrl: kyc.selfieUrl,
      adminRemarks: kyc.adminRemarks,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      kyc: kyc.status === "approved",
    });
  } catch (error) {
    console.error("KYC status error:", error);
    res.status(500).json({ message: "Error fetching KYC status", error: error.message });
  }
};

/**
 * Admin: Get all KYC submissions (paginated)
 */
export const getAllKYCSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "all" } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status !== "all") {
      query.status = status;
    }

    const submissions = await Kyc.find(query)
      .populate("userId", "name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Kyc.countDocuments(query);

    res.json({
      submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all KYC error:", error);
    res.status(500).json({ message: "Error fetching KYC submissions", error: error.message });
  }
};

/**
 * Admin: Approve KYC submission
 * Sets status to approved and updates User.kyc = true
 */
export const approveKYC = async (req, res) => {
  try {
    const { userId } = req.params;

    const kyc = await Kyc.findOne({ userId });
    if (!kyc) {
      return res.status(404).json({ message: "KYC record not found" });
    }

    kyc.status = "approved";
    kyc.reviewedAt = new Date();
    await kyc.save();

    // Update user
    const user = await User.findById(userId);
    if (user) {
      user.kyc = true;
      user.kycVerifiedAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: "KYC approved",
      kyc,
    });
  } catch (error) {
    console.error("KYC approve error:", error);
    res.status(500).json({ message: "Error approving KYC", error: error.message });
  }
};

/**
 * Admin: Reject KYC submission
 * Sets status to rejected and saves admin remarks
 */
export const rejectKYC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminRemarks } = req.body;

    if (!adminRemarks) {
      return res.status(400).json({ message: "Admin remarks are required" });
    }

    const kyc = await Kyc.findOne({ userId });
    if (!kyc) {
      return res.status(404).json({ message: "KYC record not found" });
    }

    kyc.status = "rejected";
    kyc.adminRemarks = adminRemarks;
    kyc.reviewedAt = new Date();
    await kyc.save();

    res.json({
      success: true,
      message: "KYC rejected",
      kyc,
    });
  } catch (error) {
    console.error("KYC reject error:", error);
    res.status(500).json({ message: "Error rejecting KYC", error: error.message });
  }
};
