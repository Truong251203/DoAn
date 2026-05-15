const express = require("express");
const router = express.Router();
const { performance } = require("perf_hooks");

// ==========================================
// 1. HÀM TOÁN HỌC CƠ BẢN
// ==========================================
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcVariance = (arr) => {
    if(arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
};

// ==========================================
// 2. HÀM TẠO DỮ LIỆU
// ==========================================
const generateDataset = (numDrivers, numOrders) => {
    const drivers = Array.from({ length: numDrivers }, (_, i) => ({
        id: `D${i}`,
        loc: {
            lat: 21.02 + (Math.random() - 0.5) * 0.15,
            lng: 105.85 + (Math.random() - 0.5) * 0.15
        },
        ordersCount: 0
    }));

    const orders = Array.from({ length: numOrders }, (_, i) => ({
        id: `O${i}`,
        pickup: {
            lat: 21.02 + (Math.random() - 0.5) * 0.15,
            lng: 105.85 + (Math.random() - 0.5) * 0.15
        },
        price: Math.floor(Math.random() * 80000) + 20000 
    }));

    return { drivers, orders };
};

// ==========================================
// 3. THUẬT TOÁN 1: GREEDY (CÓ GIỚI HẠN TẢI)
// ==========================================
const runGreedy = (driversData, orders) => {
    let drivers = JSON.parse(JSON.stringify(driversData));
    let totalDistance = 0;
    
    // 🔥 NÂNG CẤP: Giới hạn mỗi tài xế chỉ được ôm một số đơn nhất định
    const maxCapacity = Math.ceil(orders.length / drivers.length) + 1; 

    orders.forEach(order => {
        let bestDriver = null;
        let minDistance = Infinity;

        drivers.forEach(d => {
            // Chỉ gán cho tài xế nếu họ chưa "đầy xe"
            if (d.ordersCount < maxCapacity) {
                const dist = getDistance(order.pickup.lat, order.pickup.lng, d.loc.lat, d.loc.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestDriver = d;
                }
            }
        });

        // Nếu đen rủi tất cả đều đầy, bỏ qua luật tải trọng để vét nốt đơn
        if (!bestDriver) {
            drivers.forEach(d => {
                const dist = getDistance(order.pickup.lat, order.pickup.lng, d.loc.lat, d.loc.lng);
                if (dist < minDistance) { minDistance = dist; bestDriver = d; }
            });
        }

        totalDistance += minDistance;
        bestDriver.ordersCount += 1;
    });

    return { 
        name: "Proximity (Tham lam - Có giới hạn)", 
        totalDistance, 
        variance: calcVariance(drivers.map(d => d.ordersCount)) 
    };
};

// ==========================================
// 4. THUẬT TOÁN 2: ROUND-ROBIN
// ==========================================
const runRoundRobin = (driversData, orders) => {
    let drivers = JSON.parse(JSON.stringify(driversData));
    let totalDistance = 0;

    orders.forEach(order => {
        drivers.sort((a, b) => a.ordersCount - b.ordersCount);
        const bestDriver = drivers[0]; 

        totalDistance += getDistance(order.pickup.lat, order.pickup.lng, bestDriver.loc.lat, bestDriver.loc.lng);
        bestDriver.ordersCount += 1;
    });

    return { 
        name: "Round-Robin (Cân bằng khối lượng)", 
        totalDistance, 
        variance: calcVariance(drivers.map(d => d.ordersCount)) 
    };
};

// ==========================================
// 5. THUẬT TOÁN 3: LOCAL SEARCH (TỐI ƯU HOÁN ĐỔI)
// ==========================================
const runLocalSearch = (driversData, orders) => {
    let drivers = JSON.parse(JSON.stringify(driversData));
    let assignments = []; 
    let totalDistance = 0;
    
    // Vẫn dùng giới hạn tải để Local Search "mở trói" cho Greedy
    const maxCapacity = Math.ceil(orders.length / drivers.length) + 1; 

    // Bước 1: Gán khởi tạo bằng Greedy
    orders.forEach(order => {
        let bestDriver = null;
        let minDistance = Infinity;
        drivers.forEach(d => {
            if (d.ordersCount < maxCapacity) {
                const dist = getDistance(order.pickup.lat, order.pickup.lng, d.loc.lat, d.loc.lng);
                if (dist < minDistance) { minDistance = dist; bestDriver = d; }
            }
        });
        if (!bestDriver) {
            drivers.forEach(d => {
                const dist = getDistance(order.pickup.lat, order.pickup.lng, d.loc.lat, d.loc.lng);
                if (dist < minDistance) { minDistance = dist; bestDriver = d; }
            });
        }

        assignments.push({ order, driver: bestDriver, dist: minDistance });
        totalDistance += minDistance;
        bestDriver.ordersCount += 1;
    });

    // Bước 2: Hoán đổi (Tráo đổi đơn giữa các tài xế để chữa lỗi do giới hạn tải gây ra)
    let iterations = 2000; 
    while (iterations > 0) {
        let i = Math.floor(Math.random() * assignments.length);
        let j = Math.floor(Math.random() * assignments.length);
        
        if (assignments[i].driver.id !== assignments[j].driver.id) {
            let currentDist = assignments[i].dist + assignments[j].dist;
            
            let newDistI = getDistance(assignments[i].order.pickup.lat, assignments[i].order.pickup.lng, assignments[j].driver.loc.lat, assignments[j].driver.loc.lng);
            let newDistJ = getDistance(assignments[j].order.pickup.lat, assignments[j].order.pickup.lng, assignments[i].driver.loc.lat, assignments[i].driver.loc.lng);
            
            if ((newDistI + newDistJ) < currentDist) {
                let tempDriver = assignments[i].driver;
                assignments[i].driver = assignments[j].driver;
                assignments[j].driver = tempDriver;
                
                assignments[i].dist = newDistI;
                assignments[j].dist = newDistJ;
                totalDistance = totalDistance - currentDist + (newDistI + newDistJ); 
            }
        }
        iterations--;
    }

    let finalOrderCounts = {};
    drivers.forEach(d => finalOrderCounts[d.id] = 0);
    assignments.forEach(a => finalOrderCounts[a.driver.id]++);

    return { 
        name: "Local Search (Tối ưu hoán đổi)", 
        totalDistance, 
        variance: calcVariance(Object.values(finalOrderCounts)) 
    };
};

// ==========================================
// 6. API EXPORT: CHẠY BENCHMARK
// ==========================================
router.post("/simulate", async (req, res) => {
    try {
        const { numDrivers, numOrders } = req.body;
        const NUM_DATASETS = 5; 
        
        let results = {
            greedy: { dist: 0, var: 0, time: 0 },
            roundRobin: { dist: 0, var: 0, time: 0 },
            localSearch: { dist: 0, var: 0, time: 0 }
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

            t0 = performance.now(); resTemp = runLocalSearch(drivers, orders);
            results.localSearch.time += (performance.now() - t0); results.localSearch.dist += resTemp.totalDistance; results.localSearch.var += resTemp.variance;
        }

        const formatResult = (data) => ({
            distance: (data.dist / NUM_DATASETS).toFixed(2),
            variance: (data.var / NUM_DATASETS).toFixed(2),
            time: (data.time / NUM_DATASETS).toFixed(2)
        });

        res.json({
            message: `Chạy thành công trên ${NUM_DATASETS} bộ dữ liệu`,
            metrics: [
                { id: 1, name: "Greedy (Gần nhất - Bị giới hạn tải)", ...formatResult(results.greedy) },
                { id: 2, name: "Round-Robin (Cân bằng khối lượng)", ...formatResult(results.roundRobin) },
                { id: 3, name: "Local Search 2-opt (Tối ưu hoán đổi)", ...formatResult(results.localSearch) }
            ],
            sampleData: { drivers: lastDrivers, orders: lastOrders }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi mô phỏng", error });
    }
});

module.exports = router;