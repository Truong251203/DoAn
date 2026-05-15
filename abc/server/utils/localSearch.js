// Mô phỏng thuật toán Swap (Hoán đổi) trong Local Search
const optimizeWithLocalSearch = (initialAssignments) => {
    let currentBest = [...initialAssignments];
    let improved = true;
    let maxIterations = 1000;

    // Hàm tính tổng quãng đường của toàn bộ hệ thống
    const calculateTotalDistance = (assignments) => {
        let total = 0;
        assignments.forEach(a => {
            total += getDistanceFromLatLonInKm(a.driverLat, a.driverLng, a.orderLat, a.orderLng);
        });
        return total;
    };

    let bestDistance = calculateTotalDistance(currentBest);

    // Vòng lặp Local Search
    while (improved && maxIterations > 0) {
        improved = false;
        
        // Thử hoán đổi đơn hàng giữa 2 tài xế bất kỳ
        for (let i = 0; i < currentBest.length - 1; i++) {
            for (let j = i + 1; j < currentBest.length; j++) {
                
                // Tráo đổi thử
                let testSwap = [...currentBest];
                let tempOrder = testSwap[i].order;
                testSwap[i].order = testSwap[j].order;
                testSwap[j].order = tempOrder;

                let newDistance = calculateTotalDistance(testSwap);

                // Nếu tốt hơn, chấp nhận phương án mới và chạy lại từ đầu
                if (newDistance < bestDistance) {
                    currentBest = testSwap;
                    bestDistance = newDistance;
                    improved = true;
                }
            }
        }
        maxIterations--;
    }

    return currentBest; // Trả về kết quả đã được tối ưu
};