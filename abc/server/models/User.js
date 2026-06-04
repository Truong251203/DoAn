const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ["admin", "coordinator", "customer", "driver"],
    required: true,
  },
  phone: { type: String, default: "" },
  cccd: { type: String, default: "" },

  // ===============================
  // 🟢 ĐỊA CHỈ & KHU VỰC
  // ===============================
  address: { type: String, default: "" }, 
  
  // Vẫn giữ region_id nếu bạn cần dùng cho Tài xế (Driver - 1 người 1 khu vực)
  region_id: { 
    type: String, 
    default: null 
  },

  // 🔥 THÊM MỚI TRƯỜNG NÀY ĐỂ LƯU NHIỀU KHU VỰC CHO COORDINATOR
  managedAreas: {
    type: [String], // Khai báo dạng mảng (Array) để lưu nhiều khu vực
    default: []
  },
  // ===============================

  // Quyền phê duyệt
  approved: { type: Boolean, default: false },

  // Trạng thái tài khoản
  status: { type: String, enum: ['active', 'locked'], default: 'active' },

  // Kháng cáo
  appealReason: { type: String, default: "" }, 
  appealStatus: { type: String, enum: ["none", "pending", "resolved"], default: "none" },

  // 🟢 ĐỊA CHỈ KHO
  warehouse: {
    address: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },

  // 🟢 TỌA ĐỘ LẤY HÀNG MẶC ĐỊNH
  pickupCoords: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },

  // 🟢 DANH SÁCH ĐỊA CHỈ LẤY HÀNG
  pickupLocations: [
    {
      address: { type: String, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    }
  ],

  // 🟢 THỐNG KÊ TÀI XẾ
  totalKm: { type: Number, default: 0 },
  totalFuel: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },

}, { timestamps: true }); 

module.exports = mongoose.model("User", UserSchema);