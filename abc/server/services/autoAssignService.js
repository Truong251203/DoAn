const User = require("../models/User");
const Order = require("../models/Order");

// --- Helper: Tính khoảng cách (Haversine) ---
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --- Helper: Lấy vị trí an toàn của tài xế ---
const getDriverEffectiveLocation = async (driver) => {
    if (driver.currentLocation && driver.currentLocation.lat) return driver.currentLocation;
    
    const lastOrder = await Order.findOne({ driverId: driver._id, status: 'completed' }).sort({ completedAt: -1 });
    if (lastOrder && lastOrder.deliveryCoords) return lastOrder.deliveryCoords;
    
    // Nếu vẫn không có, trả về tọa độ giả định (Hà Nội) có dích dắc nhẹ để tránh đè nhau
    return { 
        lat: 21.0285 + (Math.random() * 0.02 - 0.01), 
        lng: 105.8542 + (Math.random() * 0.02 - 0.01) 
    };
};

// ============================================================
// 1. TÌM 1 XE GẦN NHẤT (CHO GÁN LẺ)
// ============================================================
const findNearestDriver = async (pickupCoords) => {
  const drivers = await User.find({ role: "driver", status: "active" });
  let nearest = null, min = Infinity;
  for (const d of drivers) {
    const loc = await getDriverEffectiveLocation(d);
    if (!loc) continue;
    const dist = getDistanceFromLatLonInKm(pickupCoords.lat, pickupCoords.lng, loc.lat, loc.lng);
    if (dist < min) { min = dist; nearest = d; }
  }
  return nearest;
};

// ============================================================
// 2. TÌM 1 XE DOANH THU THẤP (CHO GÁN LẺ)
// ============================================================
const findLowestRevenueDriver = async () => {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);
  const drivers = await User.find({ role: "driver", status: "active" });
  const stats = [];
  
  for (const d of drivers) {
    const orders = await Order.find({ 
        driverId: d._id, 
        $or: [
            { status: { $in: ["assigned", "delivering", "in_progress"] } },
            { status: "completed", updatedAt: { $gte: start, $lte: end } }
        ]
    });
    const rev = orders.reduce((s, o) => s + (o.price || o.cost || 0), 0);
    stats.push({ driver: d, revenue: rev });
  }
  
  stats.sort((a, b) => a.revenue - b.revenue);
  return stats[0]?.driver;
};

// ============================================================
// 3. GÁN HÀNG LOẠT (ĐỒNG BỘ LOGIC VỚI ALGO LAB)
// ============================================================
const batchAssignOrders = async (strategy) => {
    // 1. Lấy danh sách Đơn hàng & Tài xế ĐANG HOẠT ĐỘNG
    let pendingOrders = await Order.find({ 
        status: { $in: ['pending', 'confirmed', 'unconfirmed'] } 
    });
    const drivers = await User.find({ role: "driver", status: "active" });

    if (pendingOrders.length === 0 || drivers.length === 0) return { count: 0, orders: [] };

    // 🔥 TÍNH TOÁN GIỚI HẠN TẢI TRỌNG (Max Capacity)
    // Tính số đơn tối đa mỗi xe được ôm để tránh tình trạng 1 người ôm hết
    const maxCapacity = Math.ceil(pendingOrders.length / drivers.length) + 1;

    // 2. Chuẩn bị dữ liệu xếp hàng
    let driverQueue = [];
    const activeOrders = await Order.find({ status: { $in: ['assigned', 'delivering'] } });

    for (const d of drivers) {
        const location = await getDriverEffectiveLocation(d);
        const currentHoldingOrders = activeOrders.filter(o => o.driverId?.toString() === d._id.toString()).length;
        
        const info = { 
            _id: d._id,
            location: location,
            currentRevenue: 0,
            ordersCount: currentHoldingOrders // Thêm biến đếm số đơn đang ôm
        };

        // Tính doanh thu ngày hôm nay (Nếu chạy AI Cân Bằng)
        if (strategy === 'revenue') {
            const start = new Date(); start.setHours(0,0,0,0);
            const end = new Date(); end.setHours(23,59,59,999);
            const orders = await Order.find({ 
                driverId: d._id, 
                $or: [
                    { status: { $in: ["assigned", "delivering", "in_progress"] } },
                    { status: "completed", updatedAt: { $gte: start, $lte: end } }
                ]
            });
            info.currentRevenue = orders.reduce((s, o) => s + (o.price || o.cost || 0), 0);
        }
        
        driverQueue.push(info);
    }

    const assignedResults = [];
    
    // 3. VÒNG LẶP CHIA ĐƠN THEO BẢN CHẤT ALGO LAB
    // Sửa lại logic: Lặp qua TỪNG ĐƠN HÀNG, tìm tài xế tốt nhất cho đơn đó
    let i = pendingOrders.length - 1;
    
    while (i >= 0) {
        const order = pendingOrders[i];
        
        // Loại bỏ đơn thiếu tọa độ
        if (!order.pickupCoords || !order.pickupCoords.lat) {
            i--; continue;
        }

        let bestDriver = null;
        let minDistance = Infinity;

        // CHIẾN THUẬT 1: THAM LAM (AI GẦN NHẤT & CHƯA ĐẦY TẢI)
        if (strategy === 'proximity') {
            driverQueue.forEach(d => {
                if (d.ordersCount < maxCapacity) {
                    const dist = getDistanceFromLatLonInKm(order.pickupCoords.lat, order.pickupCoords.lng, d.location.lat, d.location.lng);
                    if (dist < minDistance) { minDistance = dist; bestDriver = d; }
                }
            });
        } 
        
        // CHIẾN THUẬT 2: ROUND-ROBIN (AI DOANH THU THẤP NHẤT HOẶC ĐANG ÔM ÍT ĐƠN NHẤT)
        else if (strategy === 'revenue') {
            driverQueue.sort((a, b) => {
                if (a.ordersCount !== b.ordersCount) return a.ordersCount - b.ordersCount;
                return a.currentRevenue - b.currentRevenue;
            });
            bestDriver = driverQueue[0];
        }

        // NẾU TÌM ĐƯỢC XE -> CHỐT GÁN
        if (bestDriver) {
            // Cập nhật Database
            order.driverId = bestDriver._id;
            order.status = "assigned";
            order.history.push({ 
                status: "assigned", 
                reason: `AI Auto-Assign (${strategy === 'revenue' ? 'Balance Revenue' : 'Proximity'})`, 
                timestamp: new Date() 
            });
            await order.save();

            const populated = await Order.findById(order._id).populate("driverId", "name phone email").populate("customerId", "name phone email");
            assignedResults.push(populated);

            // Tăng gánh nặng cho tài xế để vòng lặp sau AI biết đường né
            bestDriver.ordersCount += 1;
            if (strategy === 'revenue') {
                bestDriver.currentRevenue += (order.price || order.cost || 0);
            }
            
            // Dời vị trí tài xế đến điểm giao hàng của đơn này
            if (order.deliveryCoords && order.deliveryCoords.lat) {
                bestDriver.location = order.deliveryCoords;
            }
        }

        // Chuyển sang đơn tiếp theo
        i--;
    }

    return { count: assignedResults.length, orders: assignedResults };
};

module.exports = { findNearestDriver, findLowestRevenueDriver, batchAssignOrders };