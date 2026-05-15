const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// ==========================================
// 1. API: ĐĂNG KÝ TÀI KHOẢN
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!["customer", "driver", "coordinator"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email đã được sử dụng" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ 
        name, 
        email, 
        password: hashed, 
        role, 
        approved: false, 
        status: 'active' 
    });
    
    await newUser.save();
    res.json({ message: "Đăng ký thành công. Chờ admin phê duyệt." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 2. API: ĐĂNG NHẬP
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });
    
    // Kiểm tra tài khoản có bị khóa không (Trả về mã lỗi đặc thù để bật form kháng cáo)
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

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
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