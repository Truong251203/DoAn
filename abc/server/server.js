const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const setupSocket = require("./sockets/socketHandler");

require("dotenv").config();

const server = http.createServer(app);6
const io = new Server(server, {
  cors: { origin: "*" },
});

setupSocket(io);

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("Đã kết nối MongoDB");
  server.listen(process.env.PORT || 5000, () =>
    console.log(`Server đang chạy tại http://localhost:${process.env.PORT || 5000}`)
  );
});
