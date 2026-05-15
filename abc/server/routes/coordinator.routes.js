const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Order = require("../models/Order");
const { verifyToken, verifyCoordinator } = require("../middleware/verify");

// Thống kê doanh thu theo tài xế (Coordinator)
router.get("/stats", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $match: { 
          driverId: { $ne: null },
          status: "completed"
        }
      },
      {
        $group: {
          _id: "$driverId",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$revenue" },
          totalKm: { $sum: "$distance" },
          totalFuel: { $sum: "$fuelUsed" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",      // ObjectId của driver
          foreignField: "_id",    // khớp với _id của User
          as: "driver"
        }
      },
      { $unwind: "$driver" },
      {
        $project: {
          driverId: "$_id",
          driverName: "$driver.name",
          phone: "$driver.phone",
          totalOrders: 1,
          totalRevenue: 1,
          totalKm: 1,
          totalFuel: 1
        }
      }
    ]);

    res.json(stats);
  } catch (err) {
    console.error("❌ Lỗi thống kê coordinator:", err);
    res.status(500).json({ message: err.message });
  }
});
// Thống kê hôm nay của 1 tài xế dành cho Coordinator
router.get("/driver/:id/stats-today", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const driverId = req.params.id;

    // ===== Lấy ngày hôm nay =====
    let start = new Date();
    start.setHours(0, 0, 0, 0);

    let end = new Date();
    end.setHours(23, 59, 59, 999);

    // ===== Lấy đơn hoàn thành hôm nay =====
    const orders = await Order.find({
      driverId,
      status: "completed",
      completedAt: { $gte: start, $lte: end }
    });

    const totalOrders = orders.length;
    const totalKm = orders.reduce((sum, o) => sum + (o.distance || 0), 0);
    const totalFuel = orders.reduce((sum, o) => sum + (o.fuelUsed || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + (o.revenue || 0), 0);

    res.json({
      driverId,
      totalOrders,
      totalKm,
      totalFuel,
      totalRevenue
    });

  } catch (err) {
    console.error("❌ Lỗi thống kê theo driver hôm nay:", err);
    res.status(500).json({ message: err.message });
  }
});
router.post("/assign/pending", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const { driverId, orderIds } = req.body;

    const pending = await PendingAssign.create({
      driverId,
      orderIds,
      createdAt: new Date(),
      status: "waiting"
    });

    // Gửi qua socket để Driver biết đang chờ xác nhận
    req.io.emit("pending_assign_created", pending);

    res.json({ message: "Tạo yêu cầu phân công, chờ xác nhận", pending });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router.post("/assign/confirm", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const { pendingId, confirm } = req.body;

    const pending = await PendingAssign.findById(pendingId);
    if (!pending) return res.status(404).json({ message: "Không tìm thấy yêu cầu" });

    if (confirm) {
      // Cập nhật thật sự
      await Order.updateMany(
        { _id: { $in: pending.orderIds } },
        {
          driverId: pending.driverId,
          status: "assigned",
          assignedAt: new Date()
        }
      );
      pending.status = "approved";
    } else {
      pending.status = "rejected";
    }

    await pending.save();

    req.io.emit("pending_assign_update", pending);

    res.json({ message: "Cập nhật thành công", pending });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
