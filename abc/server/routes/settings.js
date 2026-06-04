const express = require("express");
const router = express.Router();
const Setting = require("../models/Setting");
const { verifyToken, verifyAdmin } = require("../middleware/verify"); 

// 1. LẤY GIÁ CƯỚC (Dành cho Khách hàng & Admin)
router.get("/pricing", async (req, res) => {
  try {
    const pricingSetting = await Setting.findOne({ key: "pricing" });
    if (pricingSetting) {
      res.json(pricingSetting.value);
    } else {
      res.json({ pricePerKm: 10000, pricePerKg: 2000 }); // Mặc định nếu chưa có
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CẬP NHẬT GIÁ CƯỚC (Chỉ Admin)
router.put("/pricing", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { pricePerKm, pricePerKg } = req.body;
    const updatedPricing = await Setting.findOneAndUpdate(
      { key: "pricing" },
      { value: { pricePerKm, pricePerKg } },
      { new: true, upsert: true }
    );
    res.json(updatedPricing.value);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi cập nhật giá cước" });
  }
});

module.exports = router;