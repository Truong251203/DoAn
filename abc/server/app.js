const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// Middleware JSON
app.use(express.json());

// Các route
const driverRouter = require("./routes/driverRoutes");
app.use("/api/drivers", driverRouter);
const coordinatorRoutes = require("./routes/coordinator.routes");
app.use("/api/coordinator", coordinatorRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/algo", require("./routes/algoLab"));
module.exports = app;
