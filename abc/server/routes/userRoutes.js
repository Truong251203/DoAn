const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { verifyToken, verifyAdmin, verifyCoordinator } = require("../middleware/verify");

// ===============================
// 🟢 Lấy danh sách tài khoản chưa được duyệt (Admin)
// ===============================
router.get("/pending", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({ approved: false }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// 🟢 Lấy danh sách tài khoản đã duyệt (Admin)
// ===============================
router.get("/approved", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({ approved: true }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 Lấy thông tin bản thân
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// 🟢 Lấy tất cả người dùng (tùy role)
// ===============================
router.get("/", verifyToken, async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};
    const users = await User.find(query).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 Cập nhật thông tin cá nhân
router.put("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    // ✅ Cập nhật thông tin cơ bản
    user.name = req.body.name ?? user.name;
    user.phone = req.body.phone ?? user.phone;
    user.cccd = req.body.cccd ?? user.cccd;
    // ✅ Lưu địa chỉ lấy hàng mặc định
    if (req.body.address) user.address = req.body.address;

    // ✅ Lưu tọa độ lấy hàng
    if (req.body.pickupCoords) {
      user.pickupCoords = {
        lat: req.body.pickupCoords.lat,
        lng: req.body.pickupCoords.lng,
      };
    }

    // ✅ Lưu danh sách địa chỉ lấy hàng
    if (req.body.pickupLocations) {
      user.pickupLocations = req.body.pickupLocations;
    }

    // ✅ Lưu warehouse nếu có
    if (req.body.warehouse) {
      user.warehouse = user.warehouse || {};
      user.warehouse.address = req.body.warehouse.address ?? user.warehouse.address;
      user.warehouse.lat = req.body.warehouse.lat ?? user.warehouse.lat;
      user.warehouse.lng = req.body.warehouse.lng ?? user.warehouse.lng;
    }

    // ✅ Cập nhật password nếu có
    if (req.body.password) {
      user.password = await bcrypt.hash(req.body.password, 10);
    }

    await user.save();
    const updatedUser = await User.findById(req.user.id).select("-password");
    res.json({ message: "Cập nhật thành công", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ➤ Thêm địa chỉ lấy hàng
router.post("/pickup-location", verifyToken, async (req, res) => {
  try {
    const { address, lat, lng } = req.body;
    if (!address || lat == null || lng == null)
      return res.status(400).json({ message: "Thiếu dữ liệu" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    user.pickupLocations = user.pickupLocations || [];
    user.pickupLocations.push({ address, lat, lng });
    await user.save();

    const updatedUser = await User.findById(req.user.id).select("-password");
    res.json({ message: "Đã thêm địa chỉ", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ➤ Xóa địa chỉ lấy hàng
router.delete("/pickup-location/:index", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const index = parseInt(req.params.index);
    if (!user.pickupLocations || index < 0 || index >= user.pickupLocations.length)
      return res.status(400).json({ message: "Index không hợp lệ" });

    user.pickupLocations.splice(index, 1);
    await user.save();

    const updatedUser = await User.findById(req.user.id).select("-password");
    res.json({ message: "Đã xóa địa chỉ", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// 🟢 Phê duyệt tài khoản (Admin)
// ===============================
router.put("/approve/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ message: "Đã phê duyệt tài khoản." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// API: ADMIN TỪ CHỐI / XÓA VĨNH VIỄN TÀI KHOẢN (THÊM MỚI)
// ==========================================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json({ message: "Đã xóa tài khoản thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// ==========================================
// API: ADMIN KHÓA TÀI KHOẢN (BAN USER)
// ==========================================
router.put("/:id/lock", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

        // 🔥 Chỉ đổi status thành 'locked', KHÔNG ĐỘNG VÀO approved
        user.status = "locked"; 
        await user.save();
        
        // Trả về user sạch (không có password)
        const updatedUser = await User.findById(user._id).select("-password");
        res.json({ message: "Đã khóa tài khoản thành công!", user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

// ==========================================
// API: ADMIN MỞ KHÓA TÀI KHOẢN (THÊM MỚI TỪ BÊN AUTH QUA)
// ==========================================
router.put("/:id/unlock", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });

        user.status = "active";         // Mở khóa
        user.appealStatus = "resolved"; // Đã giải quyết
        user.appealReason = "";         // Xóa lý do
        await user.save();
        
        const updatedUser = await User.findById(user._id).select("-password");
        res.json({ message: "Đã mở khóa tài khoản thành công!", user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

// ===============================
// 🟢 Danh sách tài xế (Coordinator)
// ===============================
router.get("/drivers", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const drivers = await User.find({ role: "driver", approved: true }).select("-password");
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;