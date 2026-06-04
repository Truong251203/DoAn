const express = require("express");
const router = express.Router();
const { performance } = require("perf_hooks");

// 1. HÀM TOÁN HỌC CƠ BẢN

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcVariance = (arr) => {
    if(arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
};

// Hàm phụ trợ: Tính tổng quãng đường của 1 chuỗi lộ trình (Trip Chaining)
const calcRouteDistance = (startLoc, ordersArray) => {
    let dist = 0;
    let currLoc = startLoc;
    for (const o of ordersArray) {
        dist += getDistance(currLoc.lat, currLoc.lng, o.pickup.lat, o.pickup.lng); // Chạy đi đón
        dist += getDistance(o.pickup.lat, o.pickup.lng, o.dropoff.lat, o.dropoff.lng); // Chạy đi giao
        currLoc = o.dropoff; // Cập nhật vị trí
    }
    return dist;
};

// 2. HÀM TẠO DỮ LIỆU (CÓ ĐIỂM ĐÓN & ĐIỂM GIAO)

const generateDataset = (numDrivers, numOrders) => {
    const drivers = Array.from({ length: numDrivers }, (_, i) => ({
        id: `D${i}`,
        initialLoc: { // Tọa độ chốt trực ban đầu
            lat: 21.02 + (Math.random() - 0.5) * 0.15,
            lng: 105.85 + (Math.random() - 0.5) * 0.15
        },
        loc: {}, // Tọa độ thực tế sẽ bị dời đi trong quá trình mô phỏng
        ordersCount: 0,
        route: [] // Danh sách lưu các đơn để tối ưu VRP
    }));

    drivers.forEach(d => d.loc = { ...d.initialLoc });

    const orders = Array.from({ length: numOrders }, (_, i) => ({
        id: `O${i}`,
        pickup: {
            lat: 21.02 + (Math.random() - 0.5) * 0.15,
            lng: 105.85 + (Math.random() - 0.5) * 0.15
        },
        dropoff: {
            lat: 21.02 + (Math.random() - 0.5) * 0.15,
            lng: 105.85 + (Math.random() - 0.5) * 0.15
        },
        price: Math.floor(Math.random() * 80000) + 20000 
    }));

    return { drivers, orders };
};

// 3. THUẬT TOÁN 1: GREEDY (Tham lam + Cập nhật vị trí)

const runGreedy = (driversData, orders) => {
    let drivers = JSON.parse(JSON.stringify(driversData));
    let totalDistance = 0;
    const maxCapacity = Math.ceil(orders.length / drivers.length) + 1; 

    orders.forEach(order => {
        let bestDriver = null;
        let minDistance = Infinity;

        drivers.forEach(d => {
            if (d.ordersCount < maxCapacity) {
                const distToPickup = getDistance(order.pickup.lat, order.pickup.lng, d.loc.lat, d.loc.lng);
                if (distToPickup < minDistance) { 
                    minDistance = distToPickup; 
                    bestDriver = d; 
                }
            }
        });

        if (!bestDriver) { // Fallback nếu ai cũng đầy xe
            drivers.forEach(d => {
                const distToPickup = getDistance(order.pickup.lat, order.pickup.lng, d.loc.lat, d.loc.lng);
                if (distToPickup < minDistance) { minDistance = distToPickup; bestDriver = d; }
            });
        }

        const deliveryDist = getDistance(order.pickup.lat, order.pickup.lng, order.dropoff.lat, order.dropoff.lng);
        
        totalDistance += (minDistance + deliveryDist);
        bestDriver.ordersCount += 1;
        
        // Dời tài xế đến điểm trả hàng
        bestDriver.loc = { lat: order.dropoff.lat, lng: order.dropoff.lng };
    });

    return { 
        name: "Proximity (Tham lam - Cập nhật vị trí)", 
        totalDistance, 
        variance: calcVariance(drivers.map(d => d.ordersCount)) 
    };
};

// 4. THUẬT TOÁN 2: ROUND-ROBIN (Cân bằng tuyệt đối)

const runRoundRobin = (driversData, orders) => {
    let drivers = JSON.parse(JSON.stringify(driversData));
    let totalDistance = 0;

    orders.forEach(order => {
        // Ưu tiên người có ít đơn nhất
        drivers.sort((a, b) => a.ordersCount - b.ordersCount);
        const bestDriver = drivers[0]; 

        const distToPickup = getDistance(order.pickup.lat, order.pickup.lng, bestDriver.loc.lat, bestDriver.loc.lng);
        const deliveryDist = getDistance(order.pickup.lat, order.pickup.lng, order.dropoff.lat, order.dropoff.lng);

        totalDistance += (distToPickup + deliveryDist);
        bestDriver.ordersCount += 1;
        
        // Dời tài xế đến điểm trả hàng
        bestDriver.loc = { lat: order.dropoff.lat, lng: order.dropoff.lng };
    });

    return { 
        name: "Round-Robin (Cân bằng - Cập nhật vị trí)", 
        totalDistance, 
        variance: calcVariance(drivers.map(d => d.ordersCount)) 
    };
};

// 5. THUẬT TOÁN 3: ULTIMATE VRP 

const runUltimateVRP = (driversData, orders) => {
    let drivers = JSON.parse(JSON.stringify(driversData));
    const maxCapacity = Math.ceil(orders.length / drivers.length) + 1; 

    // BƯỚC 1: KHỞI TẠO BẰNG GREEDY
    orders.forEach(order => {
        let bestDriver = null;
        let minDistance = Infinity;
        
        drivers.forEach(d => {
            if (d.route.length < maxCapacity) {
                const currentLoc = d.route.length > 0 ? d.route[d.route.length - 1].dropoff : d.initialLoc;
                const dist = getDistance(order.pickup.lat, order.pickup.lng, currentLoc.lat, currentLoc.lng);
                if (dist < minDistance) { minDistance = dist; bestDriver = d; }
            }
        });
        
        if (!bestDriver) {
            drivers.forEach(d => {
                const currentLoc = d.route.length > 0 ? d.route[d.route.length - 1].dropoff : d.initialLoc;
                const dist = getDistance(order.pickup.lat, order.pickup.lng, currentLoc.lat, currentLoc.lng);
                if (dist < minDistance) { minDistance = dist; bestDriver = d; }
            });
        }
        bestDriver.route.push(order);
    });

    // BƯỚC 2: LOCAL SEARCH 
    let iterations = 2000; 
    while (iterations > 0) {
        let driverA = drivers[Math.floor(Math.random() * drivers.length)];
        let driverB = drivers[Math.floor(Math.random() * drivers.length)];

        // Ép lấy đơn của người giàu chia cho người nghèo
        if (driverA.id !== driverB.id && driverA.route.length > driverB.route.length + 1) {
            let i = Math.floor(Math.random() * driverA.route.length);
            let orderToMove = driverA.route[i];

            let oldDistA = calcRouteDistance(driverA.initialLoc, driverA.route);
            let oldDistB = calcRouteDistance(driverB.initialLoc, driverB.route);
            let oldTotal = oldDistA + oldDistB;

            driverA.route.splice(i, 1);
            let newDistA = calcRouteDistance(driverA.initialLoc, driverA.route);

            let bestInsertIndex = 0;
            let bestNewDistB = Infinity;

            for (let j = 0; j <= driverB.route.length; j++) {
                let tempRouteB = [...driverB.route];
                tempRouteB.splice(j, 0, orderToMove); 
                
                let distB = calcRouteDistance(driverB.initialLoc, tempRouteB);
                if (distB < bestNewDistB) {
                    bestNewDistB = distB;
                    bestInsertIndex = j;
                }
            }

            let newTotal = newDistA + bestNewDistB;

            // Chấp nhận hi sinh 15% quãng đường để cân bằng tải
            if (newTotal <= oldTotal * 1.15) {
                driverB.route.splice(bestInsertIndex, 0, orderToMove);
            } else {
                driverA.route.splice(i, 0, orderToMove); // Hoàn tác
            }
        }
        iterations--;
    }

    // BƯỚC 3: TSP 2-OPT HIỆU NĂNG CAO - Bẻ gãy bẫy tối ưu cục bộ
    drivers.forEach(d => {
        // Bỏ qua các xe không có đơn hoặc chỉ có 1 đơn
        if (d.route.length < 2) return; 

        let improved = true;
        while (improved) {
            improved = false;
            // Chỉ tính một lần ở ngoài vòng lặp
            let currentDist = calcRouteDistance(d.initialLoc, d.route);
            
            for (let i = 0; i < d.route.length - 1; i++) {
                for (let j = i + 1; j < d.route.length; j++) {
                    
                    let newRoute = [
                        ...d.route.slice(0, i),
                        ...d.route.slice(i, j + 1).reverse(), // Đảo ngược đoạn cắt
                        ...d.route.slice(j + 1)
                    ];

                    let newDist = calcRouteDistance(d.initialLoc, newRoute);
                    
                    if (newDist < currentDist) {
                        d.route = newRoute;
                        improved = true;
                        break; // Thoát vòng j
                    }
                }
                if (improved) break; // Thoát vòng i để quét lại từ đầu
            }
        }
    });

    // BƯỚC 4: TỔNG HỢP
    let finalTotalDistance = 0;
    let finalOrderCounts = {};
    
    drivers.forEach(d => {
        finalTotalDistance += calcRouteDistance(d.initialLoc, d.route);
        finalOrderCounts[d.id] = d.route.length;
    });

    return { 
        name: "Ultimate VRP (Cân bằng tải + TSP)", 
        totalDistance: finalTotalDistance, 
        variance: calcVariance(Object.values(finalOrderCounts)) 
    };
};

// 6. API EXPORT: CHẠY BENCHMARK

router.post("/simulate", async (req, res) => {
    try {
        const { numDrivers, numOrders } = req.body;
        const NUM_DATASETS = 5; 
        
        let results = {
            greedy: { dist: 0, var: 0, time: 0 },
            roundRobin: { dist: 0, var: 0, time: 0 },
            ultimateVRP: { dist: 0, var: 0, time: 0 }
        };

        let lastDrivers = [];
        let lastOrders = [];

        for (let i = 0; i < NUM_DATASETS; i++) {
            const { drivers, orders } = generateDataset(numDrivers, numOrders);
            
            if (i === NUM_DATASETS - 1) {
                lastDrivers = drivers;
                lastOrders = orders;
            }

            let t0, resTemp;
            
            t0 = performance.now(); resTemp = runGreedy(drivers, orders);
            results.greedy.time += (performance.now() - t0); results.greedy.dist += resTemp.totalDistance; results.greedy.var += resTemp.variance;

            t0 = performance.now(); resTemp = runRoundRobin(drivers, orders);
            results.roundRobin.time += (performance.now() - t0); results.roundRobin.dist += resTemp.totalDistance; results.roundRobin.var += resTemp.variance;

            t0 = performance.now(); resTemp = runUltimateVRP(drivers, orders);
            results.ultimateVRP.time += (performance.now() - t0); results.ultimateVRP.dist += resTemp.totalDistance; results.ultimateVRP.var += resTemp.variance;
        }

        const formatResult = (data) => ({
            distance: (data.dist / NUM_DATASETS).toFixed(2),
            variance: (data.var / NUM_DATASETS).toFixed(2),
            time: (data.time / NUM_DATASETS).toFixed(2)
        });

        res.json({
            message: `Chạy thành công trên ${NUM_DATASETS} bộ dữ liệu (Đã bật Trip Chaining)`,
            metrics: [
                { id: 1, name: "Greedy (Gần nhất - Có cập nhật vị trí)", ...formatResult(results.greedy) },
                { id: 2, name: "Round-Robin (Cân bằng - Có cập nhật vị trí)", ...formatResult(results.roundRobin) },
                { id: 3, name: "Ultimate VRP (Cân bằng tải + TSP)", ...formatResult(results.ultimateVRP) }
            ],
            sampleData: { drivers: lastDrivers, orders: lastOrders }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi mô phỏng", error });
    }
});
// ==========================================================
// 7. API EXPORT: ĐÁNH GIÁ ĐỐI CHIẾU DỮ LIỆU THẬT (HUMAN VS AI)
// ==========================================================

router.post("/evaluate-real-data", async (req, res) => {
    try {
        const { date, orders, drivers } = req.body;

        if (!orders || orders.length === 0 || !drivers || drivers.length === 0) {
            return res.status(400).json({ message: "Dữ liệu đầu vào không hợp lệ (cần orders và drivers)" });
        }

        // BƯỚC 1: CHUẨN HÓA DỮ LIỆU TỪ MONGODB VỀ ĐỊNH DẠNG CỦA THUẬT TOÁN
        const mappedDrivers = drivers.map(d => {
            // Trích xuất tọa độ an toàn từ DB (fallback về tọa độ mặc định nếu lỗi)
            const lat = d.pickupCoords?.lat || d.warehouse?.lat || 21.0285;
            const lng = d.pickupCoords?.lng || d.warehouse?.lng || 105.8542;
            return {
                id: d._id.toString(),
                initialLoc: { lat, lng },
                loc: { lat, lng },
                ordersCount: 0,
                route: []
            };
        });

        const mappedOrders = orders.map(o => {
            // Lấy tọa độ lấy/giao từ cấu trúc DB thật của dự án
            const pLat = o.pickupCoords?.lat || o.pickup?.lat || 21.0285;
            const pLng = o.pickupCoords?.lng || o.pickup?.lng || 105.8542;
            const dLat = o.dropoffCoords?.lat || o.deliveryCoords?.lat || o.dropoff?.lat || 21.0285;
            const dLng = o.dropoffCoords?.lng || o.deliveryCoords?.lng || o.dropoff?.lng || 105.8542;

            return {
                id: o._id.toString(),
                pickup: { lat: pLat, lng: pLng },
                dropoff: { lat: dLat, lng: dLng },
                price: o.price || o.cost || 0,
                originalDriverId: o.driverId?._id ? o.driverId._id.toString() : (o.driverId ? o.driverId.toString() : null)
            };
        });

        // BƯỚC 2: TÍNH TOÁN HIỆU QUẢ THỰC TẾ CỦA ĐIỀU PHỐI VIÊN (HUMAN)
        let humanTotalDistance = 0;
        let humanDriversState = JSON.parse(JSON.stringify(mappedDrivers));
        
        // Sắp xếp đơn hàng theo thời gian tạo để mô phỏng timeline thực tế người điều phối đã làm
        const sortedOrders = [...mappedOrders]; // Giả định frontend đã sort hoặc DB trả về theo thời gian

        sortedOrders.forEach(order => {
            if (order.originalDriverId) {
                let d = humanDriversState.find(x => x.id === order.originalDriverId);
                if (d) {
                    const distToPickup = getDistance(d.loc.lat, d.loc.lng, order.pickup.lat, order.pickup.lng);
                    const deliveryDist = getDistance(order.pickup.lat, order.pickup.lng, order.dropoff.lat, order.dropoff.lng);
                    
                    humanTotalDistance += (distToPickup + deliveryDist);
                    d.ordersCount += 1;
                    d.loc = { lat: order.dropoff.lat, lng: order.dropoff.lng }; // Cập nhật vị trí sau khi giao
                }
            }
        });

        const humanVariance = calcVariance(humanDriversState.map(d => d.ordersCount));

        const humanResult = {
            name: "Điều Phối Viên (Lịch sử)",
            isHuman: true,
            distance: humanTotalDistance,
            variance: humanVariance,
            time: "N/A", // Con người không đo bằng ms
            totalOrders: mappedOrders.length
        };

        // BƯỚC 3: CHẠY CÁC THUẬT TOÁN AI TRÊN CÙNG TẬP DỮ LIỆU ĐÓ
        let t0;
        
        t0 = performance.now();
        const greedyRes = runGreedy(mappedDrivers, mappedOrders);
        const greedyTime = (performance.now() - t0).toFixed(2);

        t0 = performance.now();
        const rrRes = runRoundRobin(mappedDrivers, mappedOrders);
        const rrTime = (performance.now() - t0).toFixed(2);

        t0 = performance.now();
        const vrpRes = runUltimateVRP(mappedDrivers, mappedOrders);
        const vrpTime = (performance.now() - t0).toFixed(2);

        // BƯỚC 4: TỔNG HỢP VÀ DÁN NHÃN "TỐI ƯU NHẤT"
        const comparison = [
            humanResult,
            { name: "Thuật toán Greedy", distance: greedyRes.totalDistance, variance: greedyRes.variance, time: `${greedyTime} ms` },
            { name: "Thuật toán Round-Robin", distance: rrRes.totalDistance, variance: rrRes.variance, time: `${rrTime} ms` },
            { name: "Thuật toán AI VRP (Local Search)", distance: vrpRes.totalDistance, variance: vrpRes.variance, time: `${vrpTime} ms` }
        ];

        // Tìm thuật toán/người có tổng quãng đường ngắn nhất
        const minDistance = Math.min(...comparison.map(c => c.distance));
        comparison.forEach(c => {
            if (Math.abs(c.distance - minDistance) < 0.01) { // Sai số làm tròn float
                c.isBestDistance = true;
            }
        });

        res.status(200).json({ comparison });

    } catch (error) {
        console.error("Lỗi khi đánh giá dữ liệu thật:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi đánh giá dữ liệu", error: error.message });
    }
});
module.exports = router;