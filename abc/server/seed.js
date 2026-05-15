const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

dotenv.config();

const seedAccounts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Admin
    const existingAdmin = await User.findOne({ email: "admin@test.com" });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new User({
        name: "Admin",
        email: "admin@test.com",
        password: hashedPassword,
        role: "admin",
        approved: true,
      });
      await admin.save();
      console.log("✅ Đã thêm tài khoản admin.");
    } else {
      console.log("✅ Admin đã tồn tại.");
    }

    // Coordinator
    const existingCoord = await User.findOne({ email: "coordinator@test.com" });
    if (!existingCoord) {
      const hashedPassword = await bcrypt.hash("coord123", 10);
      const coordinator = new User({
        name: "Người Điều Phối",
        email: "coordinator@test.com",
        password: hashedPassword,
        role: "coordinator",
        approved: true,
      });
      await coordinator.save();
      console.log("✅ Đã tạo tài khoản coordinator.");
    } else {
      console.log("✅ Coordinator đã tồn tại.");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  }
};

seedAccounts();
