const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  bus: String,
  studentName: String,
  message: String
}, { timestamps: true });

module.exports = mongoose.model("Complaint", complaintSchema);
