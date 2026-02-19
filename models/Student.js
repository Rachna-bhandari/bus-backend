const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  rollNo: { type: String, required: true },
  course: { type: String, required: true },
  phone: { type: String, required: true },
  busRoute: { type: String, default: "" },
  busStop: { type: String, default: "" },
  busNumber: { type: String, default: "" },
  amount: { type: Number, default: 1500 },
  paymentDone: { type: Boolean, default: false },
  complaints: [{ type: Object }],
});

module.exports = mongoose.models.Student || mongoose.model("Student", studentSchema);
