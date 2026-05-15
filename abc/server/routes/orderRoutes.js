const express = require("express");
const axios = require("axios");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User"); // Đảm bảo import User
const { verifyToken, verifyCustomer, verifyCoordinator, verifyDriver } = require("../middleware/verify");
const { batchAssignOrders } = require("../services/autoAssignService");

// ==========================================
// 1. TẠO ĐƠN HÀNG (ĐÃ SỬA: KHỚP GIÁ VỚI FRONTEND)
// ==========================================
router.post("/", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const customer = await User.findById(req.user.id);

    if (!customer || !customer.pickupCoords || !customer.pickupCoords.lat) {
      return res.status(400).json({
        message: "Bạn cần cập nhật điểm xuất phát trong hồ sơ trước khi tạo đơn hàng.",
      });
    }

    // Lấy dữ liệu từ Frontend gửi lên (bao gồm cả giá và lộ trình đã tính)
    const { 
        pickupCoords, 
        deliveryCoords, 
        weight, 
        distance: clientDistance, 
        price: clientPrice, 
        route: clientRoute,
        description ,
        pickupTime,       
        recipientPhone
    } = req.body;

    if (!weight || weight <= 0) {
      return res.status(400).json({ message: "Vui lòng nhập cân nặng hợp lệ." });
    }

    let route = clientRoute || [];
    let distance = clientDistance || 0;

    // Chỉ tự tính lại nếu Frontend KHÔNG gửi lên (Fallback an toàn)
    if (!distance || !route || route.length === 0) {
        console.log("⚠️ Frontend thiếu dữ liệu lộ trình, Server tự tính toán lại...");
        try {
          const routeRes = await axios.get(
            `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lng},${pickupCoords.lat};${deliveryCoords.lng},${deliveryCoords.lat}?overview=full&geometries=geojson`
          );
          if (routeRes.data.routes && routeRes.data.routes[0]) {
            route = routeRes.data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            distance = routeRes.data.routes[0].distance / 1000; // km
          }
        } catch (error) {
          console.warn("⚠️ Lỗi API OSRM Server:", error.message);
        }
    }

    // ƯU TIÊN LẤY GIÁ TỪ FRONTEND ĐỂ ĐỒNG BỘ
    let finalCost = 0;
    if (clientPrice) {
        finalCost = clientPrice;
    } else {
        // Công thức tính nếu không có giá: 10k/km + 2k/kg
        finalCost = distance * 10000 + weight * 2000;
    }

    const newOrder = new Order({
      customerId: req.user.id,
      pickupCoords,
      deliveryCoords,
      pickupAddress: req.body.pickupAddress,   // Lưu địa chỉ dạng text
      deliveryAddress: req.body.deliveryAddress, // Lưu địa chỉ dạng text
      weight,
      description,
      route,      // Lộ trình (để vẽ map)
      distance,   // Khoảng cách
      cost: finalCost, // Giá gốc (backend dùng)
      price: finalCost, // Giá hiển thị (khớp frontend)
      status: "pending",
      pickupTime,        // <--- LƯU VÀO DB
      recipientPhone
    });

    await newOrder.save();

    // Phát socket thông báo có đơn mới
    try {
        const io = req.app.get("io");
        if(io) io.emit("orderCreated", newOrder);
    } catch(e) {}

    res.json(newOrder);
  } catch (err) {
    console.error("❌ Lỗi tạo đơn hàng:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 2. KHÁCH HÀNG HỦY ĐƠN
// ==========================================
router.put("/:id/request-cancel", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    if (!["pending", "confirmed", "assigned"].includes(order.status)) {
      return res.status(400).json({ message: "Chỉ có thể hủy khi đơn chưa bắt đầu giao" });
    }

    if (order.status === "pending" || order.status === "confirmed") {
      order.status = "cancelled";
      order.cancelRequest = false;
      order.cancelReason = "Khách hàng tự hủy";
    } else if (order.status === "assigned") {
      order.cancelRequest = true; // Nếu đã có tài xế thì phải chờ duyệt
      order.cancelFee = req.body.cancelFee || 0;
    }

    await order.save();

    try {
      const io = req.app.get("io");
      if (io) io.emit("orderUpdated", order);
    } catch (e) {}

    res.json({ message: "Đã gửi yêu cầu hủy đơn hàng", order });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// ==========================================
// 3. THỐNG KÊ CHO TÀI XẾ (DRIVER STATS)
// ==========================================
router.get("/stats/driver", verifyToken, verifyDriver, async (req, res) => {
  try {
    const driverId = req.user.id;
    const { type, date } = req.query;

    let startDate = null;
    let endDate = new Date();

    if (type === "day" && date) {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    }

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

    const rawOrders = await Order.find({ driverId, status: "completed" });
    const orders = rawOrders.map(o => ({
      ...o._doc,
      completedAt: o.completedAt || o.updatedAt || o.createdAt
    }));

    const filtered = orders.filter(o => {
      if (!startDate) return true;
      const t = new Date(o.completedAt);
      return t >= startDate && t <= endDate;
    });

    const totalOrders = filtered.length;
    const totalKm = filtered.reduce((s, o) => s + (o.distance || 0), 0);
    const fuelUsed = filtered.reduce((s, o) => s + (o.fuelUsed || 0), 0);
    const revenue = filtered.reduce((s, o) => s + (o.price || o.cost || 0), 0); // Lấy price hoặc cost

    res.json({ startDate, endDate, totalOrders, totalKm, fuelUsed, revenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. THỐNG KÊ ADMIN
// ==========================================
router.get("/admin", async (req, res) => {
  try {
    const { type, date, weekStart } = req.query;
    let start, end;

    if (type === "day") {
      start = new Date(date); start.setHours(0, 0, 0, 0);
      end = new Date(date); end.setHours(23, 59, 59, 999);
    }
    if (type === "week") {
      start = new Date(weekStart); start.setHours(0, 0, 0, 0);
      end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999);
    }

    const orders = await Order.find(start ? { createdAt: { $gte: start, $lte: end } } : {});

    res.json({
      start, end,
      total: orders.length,
      completed: orders.filter(o => o.status === "completed").length,
      failed: orders.filter(o => o.status === "failed").length,
      cancelled: orders.filter(o => o.status === "cancelled").length,
      pending: orders.filter(o => o.status === "pending").length,
      delivering: orders.filter(o => o.status === "delivering").length,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================================
// 5. LẤY DANH SÁCH ĐƠN HÀNG
// ==========================================
router.get("/", verifyToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "driver") {
      query.driverId = req.user.id;
      query.status = { $in: ["assigned", "delivering", "in_progress", "completed"] };
    } else if (req.user.role === "customer") {
      query.customerId = req.user.id;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("driverId", "name phone email")
      .populate("customerId", "name phone email");
      
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 6. GÁN ĐƠN VÀ HỦY GÁN (COORDINATOR)
// ==========================================
router.put("/assign/:id", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const { driverId } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn" });
    // CHẶN ĐỔI TÀI XẾ NẾU ĐƠN ĐÃ GIAO / HOÀN THÀNH / HỦY
    const lockedStatuses = ["delivering", "completed", "cancelled"];
    if (lockedStatuses.includes(order.status)) {
        return res.status(400).json({ 
            message: `Không thể đổi tài xế. Đơn hàng đang ở trạng thái: ${order.status}` 
        });
    }

    if (!driverId) {
      // TRƯỜNG HỢP HỦY GÁN: Xóa tài xế và đưa về confirmed
      order.driverId = null;
      order.status = "confirmed";
      order.history = order.history || [];
      order.history.push({ status: "confirmed", reason: "Coordinator unassigned driver", timestamp: new Date() });
    } else {
      // TRƯỜNG HỢP GÁN TÀI XẾ
      order.driverId = driverId;
      order.status = "assigned";
      order.history = order.history || [];
      order.history.push({ status: "assigned", reason: `Assigned to ${driverId}`, timestamp: new Date() });
    }

    await order.save();
    const populated = await Order.findById(order._id).populate("driverId").populate("customerId");

    try {
      const io = req.app.get("io");
      if (io) io.emit("orderUpdated", populated);
    } catch (e) {}

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ==========================================
// API MỚI: ĐIỀU PHỐI VIÊN XÁC NHẬN / TỪ CHỐI ĐƠN
// ==========================================
router.put("/:id/coordinator-status", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const { status } = req.body; // Nhận 'confirmed' hoặc 'cancelled' từ Frontend
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn" });

    order.status = status;
    order.history = order.history || [];
    order.history.push({ status: status, reason: `Coordinator updated status`, timestamp: new Date() });

    await order.save();
    const updatedOrder = await Order.findById(order._id).populate("driverId").populate("customerId");

    try {
      const io = req.app.get("io");
      if (io) io.emit("orderUpdated", updatedOrder);
    } catch (e) {}

    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 7. CẬP NHẬT TRẠNG THÁI (DRIVER)
// ==========================================
router.put("/:id/status", verifyToken, verifyDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, distance, fuelUsed, revenue, route, failedReason } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn" });

    order.history = order.history || [];

    // TỪ CHỐI
    if (status === "rejected") {
      order.history.push({ status: "rejected", reason: failedReason, timestamp: new Date() });
      order.status = "pending";
      order.driverId = null;
      order.failedReason = failedReason;
    }
    // THẤT BẠI
    else if (status === "failed") {
      order.history.push({ status: "failed", reason: failedReason, timestamp: new Date() });
      order.status = "pending";
      order.driverId = null;
      order.failedReason = failedReason;
    }
    // ĐANG GIAO
    else if (status === "delivering" || status === "in_progress") {
      order.history.push({ status: "delivering", timestamp: new Date() });
      order.status = "delivering";
    }
    // HOÀN THÀNH
    else if (status === "completed") {
      order.history.push({ status: "completed", timestamp: new Date() });
      order.status = "completed";
      order.completedAt = new Date();
      order.distance = distance || order.distance;
      order.fuelUsed = fuelUsed || order.fuelUsed;
      order.revenue = revenue || order.price || order.cost; // Ưu tiên revenue gửi lên, không thì lấy giá gốc
      
      // Cập nhật lại lộ trình thực tế nếu có
      if (Array.isArray(route) && route.length > 0) {
        order.route = route;
      }
    }

    await order.save();
    const updatedOrder = await Order.findById(id).populate("driverId").populate("customerId");

    try {
      const io = req.app.get("io");
      if (io) io.emit("orderUpdated", updatedOrder);
    } catch (e) {}

    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. DUYỆT HỦY ĐƠN (COORDINATOR)
// ==========================================
router.put("/:id/cancel/approve", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn" });

    if (order.status === "completed") return res.status(400).json({ message: "Đơn đã hoàn thành" });

    order.status = "cancelled";
    order.cancelRequest = false;
    order.driverId = null;
    order.history = order.history || [];
    order.history.push({ status: "cancelled", reason: "Coordinator approved", timestamp: new Date() });

    await order.save();

    try {
      const io = req.app.get("io");
      if (io) io.emit("orderUpdated", order);
    } catch (e) {}

    res.json({ message: "Đã hủy đơn", order });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});
// ---------------------------------------------------------
// 🔥 API MỚI: GÁN ĐƠN HÀNG LOẠT (BATCH ASSIGN)
// ---------------------------------------------------------
router.post("/auto-assign-batch", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const { strategy } = req.body; // 'proximity' hoặc 'revenue'
    
    // Gọi service xử lý logic gán nhiều đơn cùng lúc
    const result = await batchAssignOrders(strategy);

    // Phát socket cập nhật Frontend cho từng đơn thành công
    // Để danh sách đơn hàng trên giao diện tự động nhảy sang trạng thái "Assigned"
    const io = req.app.get("io");
    if (io && result.orders.length > 0) {
        result.orders.forEach(order => {
            io.emit("orderUpdated", order);
        });
    }

    res.json({ 
        message: `Đã gán thành công ${result.count} đơn hàng.`, 
        count: result.count,
        orders: result.orders
    });

  } catch (err) {
    console.error("Batch assign error:", err);
    res.status(500).json({ message: err.message });
  }
});
// ==========================================
// API: ĐIỀU PHỐI VIÊN GÁN ĐƠN THỦ CÔNG 
// ==========================================
router.put("/:id/assign", verifyToken, verifyCoordinator, async (req, res) => {
    try {
        const { driverId } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        if (order.status !== "pending" && order.status !== "confirmed") {
            return res.status(400).json({ message: "Đơn này không ở trạng thái có thể gán" });
        }

        order.driverId = driverId;
        order.status = "assigned";
        order.history = order.history || [];
        order.history.push({ 
            status: "assigned", 
            reason: "Điều phối viên gán thủ công từ Bản đồ", 
            timestamp: new Date() 
        });

        await order.save();

        // Populate để gửi qua Socket
        const populatedOrder = await Order.findById(order._id)
            .populate("driverId", "name phone email")
            .populate("customerId", "name phone email");

        // Bắn socket báo cho tài xế biết
        const io = req.app.get("io");
        if (io) io.emit("orderUpdated", populatedOrder);

        res.json({ message: "Đã gán đơn thành công!", order: populatedOrder });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});
// ---------------------------------------------------------
// ==========================================
// THÊM MỚI: XÓA NHIỀU ĐƠN HÀNG ĐÃ CHỌN
// ==========================================
router.post("/batch-delete", verifyToken, verifyCoordinator, async (req, res) => {
  try {
    const { orderIds } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 đơn hàng để xóa." });
    }

    // Xóa tất cả các đơn hàng có ID nằm trong mảng orderIds
    const result = await Order.deleteMany({ _id: { $in: orderIds } });

    // Phát socket để các màn hình khác tự cập nhật (nếu cần)
    try {
        const io = req.app.get("io");
        if (io) io.emit("ordersDeleted", orderIds);
    } catch(e) {}

    res.json({ 
      message: `Đã xóa vĩnh viễn ${result.deletedCount} đơn hàng thành công.`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi xóa đơn hàng: " + err.message });
  }
});
module.exports = router;