const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { verifyToken, verifyDriver } = require("../middleware/verify");

// API thống kê tài xế có lọc ngày / tuần / tất cả
router.get("/stats", verifyToken, verifyDriver, async (req, res) => {
  try {
    const driverId = req.user.id;
    const { type, date } = req.query;

    let startDate = null;
    let endDate = new Date();

    // ====== THỐNG KÊ THEO NGÀY ======
    if (type === "day" && date) {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    }

    // ====== THỐNG KÊ THEO TUẦN ======
    if (type === "week" && date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);

      startDate = new Date(d.setDate(diff));
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    // ====== MATCH ======
    const filter = { 
      driverId: driverId, 
      status: "completed" 
    };

    if (startDate) {
      filter.completedAt = { $gte: startDate, $lte: endDate };
    }

    // ====== QUERY ======
    const orders = await Order.find(filter);

    const totalOrders = orders.length;
    const totalKm = orders.reduce((sum, o) => sum + (o.distance || 0), 0);
    const fuelUsed = orders.reduce((sum, o) => sum + (o.fuelUsed || 0), 0);
    const revenue = orders.reduce((sum, o) => sum + (o.revenue || o.price || o.cost || 0), 0);

    res.json({ 
      startDate,
      endDate,
      totalOrders,
      totalKm,
      fuelUsed,
      revenue 
    });

  } catch (err) {
    console.error("Lỗi khi thống kê driver:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
