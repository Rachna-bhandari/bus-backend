const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  bus: { type: String, required: true },
  name: String,
  course: String,
  studentId: String,
  seatNo: String,
  amount: String,
  paymentScreenshot: String,
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
