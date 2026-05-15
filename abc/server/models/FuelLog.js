const mongoose = require("mongoose");

const fuelLogSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    required: true,
  },
  fuelAmount: Number,
  date: Date,
});

module.exports = mongoose.model("FuelLog", fuelLogSchema);