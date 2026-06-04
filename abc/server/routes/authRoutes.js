const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// ===============================
// 🛠 HÀM HELPER: XÁC ĐỊNH KHU VỰC (ĐÃ SỬA CHUẨN TÊN FRONTEND)
// ===============================
const determineRegion = (address) => {
  if (!address) return null;
  const lowerAddress = address.toLowerCase();

  if (lowerAddress.includes("hà nội") || lowerAddress.includes("ha noi")) return "Hà Nội";
  if (lowerAddress.includes("hồ chí minh") || lowerAddress.includes("ho chi minh") || lowerAddress.includes("hcm")) return "Hồ Chí Minh";
  if (lowerAddress.includes("đà nẵng") || lowerAddress.includes("da nang")) return "Đà Nẵng";
  if (lowerAddress.includes("hải phòng") || lowerAddress.includes("hai phong")) return "Hải Phòng";
  if (lowerAddress.includes("cần thơ") || lowerAddress.includes("can tho")) return "Cần Thơ";
  if (lowerAddress.includes("bình dương") || lowerAddress.includes("binh duong")) return "Bình Dương";
  if (lowerAddress.includes("đồng nai") || lowerAddress.includes("dong nai")) return "Đồng Nai";
  if (lowerAddress.includes("bắc ninh") || lowerAddress.includes("bac ninh")) return "Bắc Ninh";
  if (lowerAddress.includes("hải dương") || lowerAddress.includes("hai duong")) return "Hải Dương";
  if (lowerAddress.includes("thanh hóa") || lowerAddress.includes("thanh hoa")) return "Thanh Hóa";
  
  return null; 
};

// ==========================================
// 1. API: ĐĂNG KÝ TÀI KHOẢN
// ==========================================
router.post("/register", async (req, res) => {
  try {
    // Nhận thêm phone và address từ frontend
    const { name, email, password, role, phone, address } = req.body;
    
    if (!["customer", "driver", "coordinator"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email đã được sử dụng" });

    // Tự động quét khu vực từ địa chỉ
    const region = determineRegion(address);

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ 
        name, 
        email, 
        password: hashed, 
        phone,           // Lưu số điện thoại
        address,         // Lưu địa chỉ văn bản
        
        // Cấp phát khu vực tùy theo vai trò
        region_id: role === 'driver' ? region : null, 
        managedAreas: role === 'coordinator' && region ? [region] : [], 

        role, 
        approved: false, // Chờ admin duyệt theo logic của bạn
        status: 'active' 
    });
    
    await newUser.save();
    res.json({ message: "Đăng ký thành công. Chờ admin phê duyệt." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 2. API: ĐĂNG NHẬP (ĐÃ BỔ SUNG MANAGED_AREAS)
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });
    
    // Kiểm tra tài khoản có bị khóa không
    if (user.status === 'locked') {
        return res.status(403).json({ 
            code: 'ACCOUNT_LOCKED',
            message: 'Tài khoản của bạn đã bị khóa do vi phạm chính sách.',
            email: user.email 
        });
    }

    // Kiểm tra tài khoản đã được duyệt chưa
    if (!user.approved) return res.status(403).json({ message: "Tài khoản chưa được duyệt." });
    
    // Kiểm tra mật khẩu
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Sai mật khẩu." });

    // Đưa thêm managedAreas vào token
    const payload = { 
      id: user._id, 
      role: user.role,
      region_id: user.region_id,
      managedAreas: user.managedAreas || []
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        region_id: user.region_id,
        managedAreas: user.managedAreas || []
      } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 3. API: KHÁCH HÀNG GỬI YÊU CẦU MỞ KHÓA (PUBLIC)
// ==========================================
router.post("/appeal-unlock", async (req, res) => {
    try {
        const { email, reason } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
        if (user.status !== 'locked') return res.status(400).json({ message: "Tài khoản này không bị khóa." });

        // Cập nhật lý do và đổi trạng thái thành "Đang chờ duyệt"
        user.appealReason = reason;
        user.appealStatus = "pending";
        await user.save();

        res.json({ message: "Đã gửi yêu cầu mở khóa thành công! Admin sẽ xem xét sớm nhất." });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

module.exports = router;