const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  cancelRequest: {
  type: Boolean,
  default: false,
},
  failedReason: { type: String, default: null },
  history: [
    {
      status: String,
      reason: String,
      timestamp: { type: Date, default: Date.now },
    }
  ],
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  pickupAddress: String,
  pickupCoords: {
    lat: { type: Number },
    lng: { type: Number },
  },
  deliveryAddress: { type: String, required: true },
  deliveryCoords: {
    lat: { type: Number },
    lng: { type: Number },
  },
  weight: { type: Number, required: true }, // ⚖️ Cân nặng (kg)
  distance: { type: Number, default: 0 }, // 📏 Quãng đường (km)
  cost: { type: Number, default: 0 }, // 💰 Chi phí dựa trên cân nặng & quãng đường
  description: String,
  status: {
    type: String,
    enum: ["unconfirmed", "pending", "confirmed", "assigned", "in_progress", "delivering", "completed", "cancelled", "failed"],
    default: "pending",
  },
  completedAt: { type: Date, default: null },
  route: [[Number]], // 🗺️ Danh sách toạ độ tuyến đường
  fuelUsed: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  pickupTime: { type: Date },         // Lưu thời gian yêu cầu lấy/giao hàng
  recipientPhone: { type: String },   // Lưu SĐT người nhận
  cancelFee: { type: Number, default: 0 }, // Lưu phí phạt nếu huỷ đơn
 }, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
