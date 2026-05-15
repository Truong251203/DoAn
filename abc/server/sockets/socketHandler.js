const Order = require("../models/Order");
const Location = require("../models/Location");

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Lắng nghe từ tài xế gửi vị trí
    socket.on("driverLocationUpdate", async ({ orderId, location }) => {
      if (!orderId || !location) return;

      console.log(`📍 Server nhận vị trí đơn ${orderId}:`, location); // Thêm log để dễ debug

      // --- SỬA LỖI Ở ĐÂY ---
      // Trước đây bạn dùng "orderLocationUpdate", nhưng Coordinator đang nghe "driverLocationUpdate"
      // Hãy đổi thành "driverLocationUpdate" cho khớp.
      io.emit("driverLocationUpdate", { orderId, location }); 
      // ---------------------

      // Cập nhật route vào DB (giữ nguyên logic của bạn)
      try {
          await Order.findByIdAndUpdate(orderId, { $push: { route: location } });
      } catch (err) {
          console.error("Lỗi lưu route:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

module.exports = setupSocket;