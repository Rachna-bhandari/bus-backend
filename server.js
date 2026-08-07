// server.js
require('dotenv').config();
const dns = require('dns');
if (process.env.NODE_ENV !== "production") {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    retryWrites: true,
  });
  console.log("MongoDB connected");
  return cachedConnection;
}

app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.log("MongoDB connection error:", err);
    res.status(503).json({ success: false, message: "Database connection failed" });
  }
});
app.use(cors({
  origin: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// RAZORPAY
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.get("/", (req, res) => res.json({ status: "ok", message: "Bus Buddy Server Running ✅" }));
app.get("/health", (req, res) => res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));

// USER MODEL
const UserSchema = new mongoose.Schema({
  email:             { type: String, required: true, unique: true },
  password:          { type: String, required: true },
  role:              { type: String, required: true },
  isProfileComplete: { type: Boolean, default: true }
});
const User = mongoose.model("User", UserSchema);

// STUDENT PROFILE MODEL
const StudentSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  name:       { type: String, default: "" },
  rollNo:     { type: String, default: "" },
  phone:      { type: String, default: "" },
  dob:        { type: String, default: "" },
  course:     { type: String, default: "" },
  college:    { type: String, default: "GEHU – Haldwani" },
  password:   { type: String, default: "" },
  photo:      { type: String, default: "" },
  txnId:      { type: String, default: "" },
  paymentDone:{ type: Boolean, default: false },
  bookedBus:  { type: String, default: "" },
  bookedSeat: { type: Number, default: null }
});
const Student = mongoose.model("Student", StudentSchema);

// BUS BOOKING MODEL
const BookingSchema = new mongoose.Schema({
  bus:              { type: String, required: true },
  name:             { type: String, default: "" },
  course:           { type: String, default: "" },
  studentId:        { type: String, default: "" },
  seatNo:           { type: Number, default: null },
  paymentScreenshot:{ type: String, default: "" },
  bookedAt:         { type: Date, default: Date.now }
});
const Booking = mongoose.model("Booking", BookingSchema);

// COMPLAINT MODEL 
const ComplaintSchema = new mongoose.Schema({
  bus:        { type: String, default: "" },
  name:       { type: String, default: "Anonymous" },
  text:       { type: String, default: "" },
  date:       { type: String, default: "" },
  status:     { type: String, default: "pending" },
  resolved:   { type: Boolean, default: false },
  actionTaken:{ type: String, default: "" },
  resolvedAt: { type: String, default: "" },
  createdAt:  { type: Date, default: Date.now }
});
const Complaint = mongoose.model("Complaint", ComplaintSchema);

// NOTICE MODEL
const NoticeSchema = new mongoose.Schema({
  bus:  { type: String, default: "" },
  text: { type: String, default: "" },
  date: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});
const Notice = mongoose.model("Notice", NoticeSchema);

function checkDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: "Database not connected. Please try again in a moment." });
  }
  next();
}

// AUTH ROUTES
app.post("/auth/login", checkDB, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role)
      return res.json({ success: false, message: "All fields required" });

    if (email === "admin@example.com" && password === "admin@123" && role === "Admin")
      return res.json({ success: true, role: "Admin" });

    const user = await User.findOne({ email, role });
    if (!user)
      return res.json({ redirect: "signup", message: "Account not found. Contact admin." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.json({ success: false, message: "Invalid email or password" });

    const profile = await Student.findOne({ email });
    return res.json({ success: true, role: user.role, student: profile || {} });

  } catch (err) {
    console.log("LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

// =================================================
// ADMIN ROUTES
// =================================================
app.get("/admin/students", checkDB, async (req, res) => {
  try {
    const students = await Student.find({});
    res.json({ success: true, students });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/students/add", checkDB, async (req, res) => {
  try {
    const { name, rollNo, email, phone, dob, course, college, password } = req.body;
    if (!name || !email || !password)
      return res.json({ success: false, message: "Name, Email and Password required" });

    const hashed = await bcrypt.hash(password, 10);

    await User.findOneAndUpdate(
      { email },
      { $set: { email, password: hashed, role: "student", isProfileComplete: true } },
      { upsert: true, new: true }
    );

    await Student.findOneAndUpdate(
      { email },
      { $set: { name, rollNo, email, phone, dob,
                course, college: college || "GEHU – Haldwani", password } },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Student saved successfully" });
  } catch (e) {
    console.log("ADD STUDENT ERROR:", e);
    res.status(500).json({ success: false, message: "Server error: " + e.message });
  }
});

app.put("/admin/students/:email", checkDB, async (req, res) => {
  try {
    const email   = decodeURIComponent(req.params.email);
    const updates = req.body;

    await Student.findOneAndUpdate({ email }, { $set: updates }, { new: true });

    if (updates.password) {
      const hashed = await bcrypt.hash(updates.password, 10);
      await User.findOneAndUpdate({ email }, { $set: { password: hashed } });
    }

    res.json({ success: true, message: "Student updated" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/admin/students/:email", checkDB, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    await Student.findOneAndDelete({ email });
    await User.findOneAndDelete({ email });
    res.json({ success: true, message: "Student deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/admin/fix-passwords", checkDB, async (req, res) => {
  try {
    const students = await Student.find({});
    let fixed = 0;
    for (const s of students) {
      if (s.password) {
        const hashed = await bcrypt.hash(s.password, 10);
        await User.findOneAndUpdate(
          { email: s.email },
          { $set: { password: hashed, isProfileComplete: true, role: "student" } },
          { upsert: true }
        );
        fixed++;
      }
    }
    res.json({ success: true, message: `Fixed ${fixed} student passwords` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// BUS BOOKING ROUTES
app.get("/bus/bookings/:bus", checkDB, async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const bookings = await Booking.find({ bus }).sort({ seatNo: 1 });
    res.json({ success: true, bookings });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/bus/bookings/:bus", checkDB, async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const { name, course, studentId, seatNo, paymentScreenshot } = req.body;

    await Booking.findOneAndUpdate(
      { bus, studentId: String(studentId) },
      { $set: { bus, name, course, studentId: String(studentId),
                seatNo, paymentScreenshot, bookedAt: new Date() } },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Booking saved" });
  } catch (e) {
    console.log("BOOKING ERROR:", e);
    res.status(500).json({ success: false, message: "Server error: " + e.message });
  }
});

app.post("/bus/bookings/:bus/delete", checkDB, async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const { studentId, seatNo } = req.body;

    await Booking.findOneAndDelete({
      bus,
      studentId: String(studentId),
      seatNo: Number(seatNo)
    });

    await Student.findOneAndUpdate(
      { $or: [{ rollNo: String(studentId) }, { email: String(studentId) }] },
      { $set: { bookedBus: "", bookedSeat: null } }
    );

    res.json({ success: true, message: "Booking removed" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/bus/bookings", checkDB, async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ bus: 1, seatNo: 1 });
    res.json({ success: true, bookings });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// COMPLAINT ROUTES
app.get("/complaints", checkDB, async (req, res) => {
  try {
    const complaints = await Complaint.find({}).sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/complaints", checkDB, async (req, res) => {
  try {
    const { bus, name, text, date } = req.body;
    if (!text) return res.json({ success: false, message: "Complaint text required" });

    const complaint = new Complaint({
      bus: bus || "",
      name: name || "Anonymous",
      text,
      date: date || new Date().toLocaleDateString(),
      status: "pending",
      resolved: false
    });
    await complaint.save();
    res.json({ success: true, message: "Complaint submitted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/complaints/save", checkDB, async (req, res) => {
  try {
    const { complaints } = req.body;
    if (!Array.isArray(complaints))
      return res.json({ success: false, message: "Invalid data" });

    for (const c of complaints) {
      if (c._id) {
        await Complaint.findByIdAndUpdate(c._id, {
          $set: {
            resolved:    c.resolved    || false,
            status:      c.status      || "pending",
            actionTaken: c.actionTaken || "",
            resolvedAt:  c.resolvedAt  || ""
          }
        });
      }
    }

    const existingIds = complaints.filter(c => c._id).map(c => c._id);
    if (existingIds.length > 0) {
      await Complaint.deleteMany({ _id: { $nin: existingIds } });
    }

    res.json({ success: true, message: "Complaints synced" });
  } catch (e) {
    console.log("COMPLAINTS SAVE ERROR:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/complaints/:id/resolve", checkDB, async (req, res) => {
  try {
    const { actionTaken } = req.body;
    await Complaint.findByIdAndUpdate(req.params.id, {
      $set: {
        resolved: true, status: "resolved",
        actionTaken: actionTaken || "",
        resolvedAt: new Date().toLocaleString()
      }
    });
    res.json({ success: true, message: "Complaint resolved" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/complaints/:id", checkDB, async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Complaint deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NOTICE ROUTES
app.get("/notices", checkDB, async (req, res) => {
  try {
    const notices = await Notice.find({}).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, notices });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/notices/:bus", checkDB, async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const notices = await Notice.find({
      $or: [{ bus }, { bus: "ALL" }]
    }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, notices });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/notices/save", checkDB, async (req, res) => {
  try {
    const { notices } = req.body;
    if (!Array.isArray(notices))
      return res.json({ success: false, message: "Invalid data" });

    for (const n of notices) {
      if (!n._id) {
        await Notice.create({
          bus: n.bus || "", text: n.text || "", date: n.date || new Date().toLocaleString()
        });
      }
    }
    res.json({ success: true, message: "Notices saved" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// STUDENT ROUTES
app.get("/student/profile/:email", checkDB, async (req, res) => {
  try {
    const email   = decodeURIComponent(req.params.email);
    const student = await Student.findOne({ email });
    if (!student) return res.json({ success: false, message: "Profile not found" });
    res.json({ success: true, student });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/student/photo/:email", checkDB, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    await Student.findOneAndUpdate({ email }, { $set: { photo: req.body.photo } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.put("/student/seat/:email", checkDB, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { bookedBus, bookedSeat, name, course, rollNo, paymentScreenshot } = req.body;

    await Student.findOneAndUpdate({ email }, { $set: { bookedBus, bookedSeat } });

    const student = await Student.findOne({ email });
    if (student) {
      await Booking.findOneAndUpdate(
        { bus: bookedBus, studentId: student.rollNo || email },
        { $set: {
            bus: bookedBus, name: student.name || name || "",
            course: student.course || course || "",
            studentId: student.rollNo || email,
            seatNo: bookedSeat, paymentScreenshot: paymentScreenshot || "",
            bookedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true });
  } catch (e) {
    console.log("SEAT BOOKING ERROR:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PAYMENT ROUTES (Razorpay)
app.post("/payment/create-order", checkDB, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email required" });

    const options = {
      amount: 1500 * 100, // ₹1500 in paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("ORDER CREATE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── VERIFY PAYMENT ──
app.post("/payment/verify", checkDB, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false, message: "Payment verification failed" });
    }

    await Student.findOneAndUpdate(
      { email },
      { $set: { paymentDone: true, txnId: razorpay_payment_id } }
    );

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("PAYMENT VERIFY ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// START SERVER
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;