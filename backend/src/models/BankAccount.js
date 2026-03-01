import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    upiId: {
      type: String,
      required: true,
      unique: true,
    },
    accountNumber: {
      type: String,
      default: () => Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("BankAccount", bankAccountSchema);
