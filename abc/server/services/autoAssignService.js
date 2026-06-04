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

// --- Helper: Tính quãng đường chuỗi lộ trình (Dùng cho VRP) ---
const calcRouteDistanceDB = (startLoc, ordersArray) => {
    let dist = 0;
    let currLoc = startLoc;
    for (const o of ordersArray) {
        if (!o.pickupCoords || !o.deliveryCoords) continue;
        dist += getDistanceFromLatLonInKm(currLoc.lat, currLoc.lng, o.pickupCoords.lat, o.pickupCoords.lng);
        dist += getDistanceFromLatLonInKm(o.pickupCoords.lat, o.pickupCoords.lng, o.deliveryCoords.lat, o.deliveryCoords.lng);
        currLoc = o.deliveryCoords;
    }
    return dist;
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
// 3. GÁN HÀNG LOẠT (TÍCH HỢP PROXIMITY, REVENUE & ULTIMATE VRP)
// ============================================================
const batchAssignOrders = async (strategy) => {
    // 1. Lấy danh sách Đơn hàng & Tài xế ĐANG HOẠT ĐỘNG
    let pendingOrders = await Order.find({ 
        status: { $in: ['pending', 'confirmed', 'unconfirmed'] } 
    });
    const drivers = await User.find({ role: "driver", status: "active" });

    if (pendingOrders.length === 0 || drivers.length === 0) return { count: 0, orders: [] };

    const maxCapacity = Math.ceil(pendingOrders.length / drivers.length) + 1;
    const assignedResults = [];

    // 🔥 TÍNH NĂNG MỚI: TỐI ƯU AI BẰNG THUẬT TOÁN VRP
    if (strategy === 'vrp') {
        let vrpDrivers = [];
        for (const d of drivers) {
            vrpDrivers.push({
                _id: d._id,
                initialLoc: await getDriverEffectiveLocation(d),
                route: []
            });
        }

        // BƯỚC 1: Khởi tạo bằng Tham Lam (Greedy)
        pendingOrders.forEach(order => {
            if (!order.pickupCoords || !order.pickupCoords.lat || !order.deliveryCoords) return;
            
            let bestDriver = null;
            let minDistance = Infinity;
            
            vrpDrivers.forEach(d => {
                if (d.route.length < maxCapacity) {
                    const currentLoc = d.route.length > 0 ? d.route[d.route.length - 1].deliveryCoords : d.initialLoc;
                    const dist = getDistanceFromLatLonInKm(order.pickupCoords.lat, order.pickupCoords.lng, currentLoc.lat, currentLoc.lng);
                    if (dist < minDistance) { minDistance = dist; bestDriver = d; }
                }
            });
            
            if (!bestDriver) { // Fallback quét lại
                vrpDrivers.forEach(d => {
                    const currentLoc = d.route.length > 0 ? d.route[d.route.length - 1].deliveryCoords : d.initialLoc;
                    const dist = getDistanceFromLatLonInKm(order.pickupCoords.lat, order.pickupCoords.lng, currentLoc.lat, currentLoc.lng);
                    if (dist < minDistance) { minDistance = dist; bestDriver = d; }
                });
            }
            if (bestDriver) bestDriver.route.push(order);
        });

        // BƯỚC 2: Local Search Relocate (Ép cân bằng tải)
        let iterations = 1000;
        while (iterations > 0) {
            let driverA = vrpDrivers[Math.floor(Math.random() * vrpDrivers.length)];
            let driverB = vrpDrivers[Math.floor(Math.random() * vrpDrivers.length)];

            if (driverA._id !== driverB._id && driverA.route.length > driverB.route.length + 1) {
                let i = Math.floor(Math.random() * driverA.route.length);
                let orderToMove = driverA.route[i];

                let oldTotal = calcRouteDistanceDB(driverA.initialLoc, driverA.route) + calcRouteDistanceDB(driverB.initialLoc, driverB.route) + 0.001; // Tránh lỗi chia 0
                
                // Tạm thời xóa khỏi A
                driverA.route.splice(i, 1);
                
                // Tìm vị trí chèn tốt nhất cho B
                let bestInsertIndex = 0;
                let bestNewDistB = Infinity;
                for (let j = 0; j <= driverB.route.length; j++) {
                    let tempRouteB = [...driverB.route];
                    tempRouteB.splice(j, 0, orderToMove);
                    let distB = calcRouteDistanceDB(driverB.initialLoc, tempRouteB);
                    if (distB < bestNewDistB) { bestNewDistB = distB; bestInsertIndex = j; }
                }

                // Chấp nhận hy sinh tối đa 15% đường đi để lấy công bằng
                if (calcRouteDistanceDB(driverA.initialLoc, driverA.route) + bestNewDistB <= oldTotal * 1.15) {
                    driverB.route.splice(bestInsertIndex, 0, orderToMove);
                } else {
                    driverA.route.splice(i, 0, orderToMove); // Hoàn tác
                }
            }
            iterations--;
        }

        // BƯỚC 3: Tối ưu Nội bộ (TSP 2-opt) - Cắt giảm quãng đường đi vòng vèo
        vrpDrivers.forEach(d => {
            if (d.route.length < 2) return;
            let improved = true;
            while (improved) {
                improved = false;
                let currentDist = calcRouteDistanceDB(d.initialLoc, d.route);
                for (let i = 0; i < d.route.length - 1; i++) {
                    for (let j = i + 1; j < d.route.length; j++) {
                        let newRoute = [
                            ...d.route.slice(0, i),
                            ...d.route.slice(i, j + 1).reverse(),
                            ...d.route.slice(j + 1)
                        ];
                        let newDist = calcRouteDistanceDB(d.initialLoc, newRoute);
                        if (newDist < currentDist) {
                            d.route = newRoute;
                            improved = true;
                            break;
                        }
                    }
                    if (improved) break;
                }
            }
        });

        // BƯỚC 4: Lưu kết quả VRP vào Database
        for (const d of vrpDrivers) {
            for (const order of d.route) {
                order.driverId = d._id;
                order.status = "assigned";
                order.history.push({ 
                    status: "assigned", 
                    reason: "AI Auto-Assign (Ultimate VRP)", 
                    timestamp: new Date() 
                });
                await order.save();
                
                const populated = await Order.findById(order._id).populate("driverId", "name phone email").populate("customerId", "name phone email");
                assignedResults.push(populated);
            }
        }
    } 
    // 🔥 CHIẾN THUẬT CŨ: PROXIMITY VÀ REVENUE (Giữ nguyên logic gốc của bạn)
    else {
        let driverQueue = [];
        const activeOrders = await Order.find({ status: { $in: ['assigned', 'delivering'] } });

        for (const d of drivers) {
            const location = await getDriverEffectiveLocation(d);
            const currentHoldingOrders = activeOrders.filter(o => o.driverId?.toString() === d._id.toString()).length;
            
            const info = { 
                _id: d._id,
                location: location,
                currentRevenue: 0,
                ordersCount: currentHoldingOrders
            };

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

        let i = pendingOrders.length - 1;
        while (i >= 0) {
            const order = pendingOrders[i];
            if (!order.pickupCoords || !order.pickupCoords.lat) {
                i--; continue;
            }

            let bestDriver = null;
            let minDistance = Infinity;

            if (strategy === 'proximity') {
                driverQueue.forEach(d => {
                    if (d.ordersCount < maxCapacity) {
                        const dist = getDistanceFromLatLonInKm(order.pickupCoords.lat, order.pickupCoords.lng, d.location.lat, d.location.lng);
                        if (dist < minDistance) { minDistance = dist; bestDriver = d; }
                    }
                });
            } 
            else if (strategy === 'revenue') {
                driverQueue.sort((a, b) => {
                    if (a.ordersCount !== b.ordersCount) return a.ordersCount - b.ordersCount;
                    return a.currentRevenue - b.currentRevenue;
                });
                bestDriver = driverQueue[0];
            }

            if (bestDriver) {
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

                bestDriver.ordersCount += 1;
                if (strategy === 'revenue') {
                    bestDriver.currentRevenue += (order.price || order.cost || 0);
                }
                
                if (order.deliveryCoords && order.deliveryCoords.lat) {
                    bestDriver.location = order.deliveryCoords;
                }
            }
            i--;
        }
    }

    return { count: assignedResults.length, orders: assignedResults };
};

module.exports = { findNearestDriver, findLowestRevenueDriver, batchAssignOrders };