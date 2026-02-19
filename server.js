// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= DATABASE =================
mongoose.connect("mongodb://127.0.0.1:27017/busdb")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ MongoDB error:", err));

// ================= USER MODEL =================
const UserSchema = new mongoose.Schema({
  email:             { type: String, required: true, unique: true },
  password:          { type: String, required: true },
  role:              { type: String, required: true },
  isProfileComplete: { type: Boolean, default: true }
});
const User = mongoose.model("User", UserSchema);

// ================= STUDENT PROFILE MODEL =================
const StudentSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  name:       { type: String, default: "" },
  rollNo:     { type: String, default: "" },
  phone:      { type: String, default: "" },
  dob:        { type: String, default: "" },
  course:     { type: String, default: "" },
  college:    { type: String, default: "GEHU – Haldwani" },
  password:   { type: String, default: "" }, // plain text — admin display only
  photo:      { type: String, default: "" },
  txnId:      { type: String, default: "" },
  bookedBus:  { type: String, default: "" },
  bookedSeat: { type: Number, default: null }
});
const Student = mongoose.model("Student", StudentSchema);

// ================= BUS BOOKING MODEL =================
// ✅ NEW — Server restart ke baad bhi data safe rahega MongoDB mein
const BookingSchema = new mongoose.Schema({
  bus:              { type: String, required: true },   // "A", "B", etc.
  name:             { type: String, default: "" },
  course:           { type: String, default: "" },
  studentId:        { type: String, default: "" },
  seatNo:           { type: Number, default: null },
  paymentScreenshot:{ type: String, default: "" },      // base64 image
  bookedAt:         { type: Date, default: Date.now }
});
const Booking = mongoose.model("Booking", BookingSchema);

// ================= COMPLAINT MODEL =================
// ✅ NEW — Server restart ke baad bhi complaints safe rahegi
const ComplaintSchema = new mongoose.Schema({
  bus:        { type: String, default: "" },
  name:       { type: String, default: "Anonymous" },
  text:       { type: String, default: "" },
  date:       { type: String, default: "" },
  status:     { type: String, default: "pending" },    // "pending" | "resolved"
  resolved:   { type: Boolean, default: false },
  actionTaken:{ type: String, default: "" },
  resolvedAt: { type: String, default: "" },
  createdAt:  { type: Date, default: Date.now }
});
const Complaint = mongoose.model("Complaint", ComplaintSchema);

// ================= NOTICE MODEL =================
// ✅ NEW — Notices bhi MongoDB mein save hongi
const NoticeSchema = new mongoose.Schema({
  bus:  { type: String, default: "" },
  text: { type: String, default: "" },
  date: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});
const Notice = mongoose.model("Notice", NoticeSchema);

// =================================================
// ================= AUTH ROUTES ===================
// =================================================

// ── LOGIN ──────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role)
      return res.json({ success: false, message: "All fields required" });

    // Hardcoded admin
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
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =================================================
// ================= ADMIN ROUTES ==================
// =================================================

// ── GET ALL STUDENTS ───────────────────────────────
app.get("/admin/students", async (req, res) => {
  try {
    const students = await Student.find({});
    res.json({ success: true, students });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── ADD STUDENT ────────────────────────────────────
app.post("/admin/students/add", async (req, res) => {
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

// ── UPDATE STUDENT ─────────────────────────────────
app.put("/admin/students/:email", async (req, res) => {
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

// ── DELETE STUDENT ─────────────────────────────────
app.delete("/admin/students/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    await Student.findOneAndDelete({ email });
    await User.findOneAndDelete({ email });
    res.json({ success: true, message: "Student deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── FIX ALL PASSWORDS (one-time utility) ──────────
app.get("/admin/fix-passwords", async (req, res) => {
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

// =================================================
// ================= BUS BOOKING ROUTES ============
// ✅ NEW — MongoDB mein permanent save
// =================================================

// ── GET bookings for a specific bus ───────────────
app.get("/bus/bookings/:bus", async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const bookings = await Booking.find({ bus }).sort({ seatNo: 1 });
    res.json({ success: true, bookings });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── ADD / UPDATE a booking ─────────────────────────
// Called by student app when they book a seat
app.post("/bus/bookings/:bus", async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const { name, course, studentId, seatNo, paymentScreenshot } = req.body;

    // Ek student ek hi seat book kar sake — upsert by studentId + bus
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

// ── DELETE a specific booking (admin use) ─────────
app.post("/bus/bookings/:bus/delete", async (req, res) => {
  try {
    const bus = req.params.bus.toUpperCase();
    const { studentId, seatNo } = req.body;

    await Booking.findOneAndDelete({
      bus,
      studentId: String(studentId),
      seatNo: Number(seatNo)
    });

    // Student ke bookedBus + bookedSeat bhi clear karo
    await Student.findOneAndUpdate(
      { $or: [
          { rollNo: String(studentId) },
          { email: String(studentId) }
        ]
      },
      { $set: { bookedBus: "", bookedSeat: null } }
    );

    res.json({ success: true, message: "Booking removed" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET all bookings across all buses (admin overview) ──
app.get("/bus/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ bus: 1, seatNo: 1 });
    res.json({ success: true, bookings });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =================================================
// ================= COMPLAINT ROUTES ==============
// ✅ NEW — MongoDB mein permanent save
// =================================================

// ── GET all complaints ─────────────────────────────
app.get("/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find({}).sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST a new complaint (student app se) ──────────
app.post("/complaints", async (req, res) => {
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

// ── SAVE / SYNC all complaints (admin bulk update) ─
// Admin resolve ya delete kare to ye route call hoga
app.post("/complaints/save", async (req, res) => {
  try {
    const { complaints } = req.body;
    if (!Array.isArray(complaints))
      return res.json({ success: false, message: "Invalid data" });

    // Har complaint ko individually update karo (_id se match)
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

    // IDs jo nahi hain unhe delete karo (admin ne delete kiya)
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

// ── RESOLVE a single complaint by ID ──────────────
app.put("/complaints/:id/resolve", async (req, res) => {
  try {
    const { actionTaken } = req.body;
    await Complaint.findByIdAndUpdate(req.params.id, {
      $set: {
        resolved:    true,
        status:      "resolved",
        actionTaken: actionTaken || "",
        resolvedAt:  new Date().toLocaleString()
      }
    });
    res.json({ success: true, message: "Complaint resolved" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── DELETE a single complaint by ID ───────────────
app.delete("/complaints/:id", async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Complaint deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =================================================
// ================= NOTICE ROUTES =================
// ✅ NEW — Notices bhi MongoDB mein
// =================================================

// ── GET all notices ────────────────────────────────
app.get("/notices", async (req, res) => {
  try {
    const notices = await Notice.find({}).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, notices });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET notices for a specific bus ────────────────
app.get("/notices/:bus", async (req, res) => {
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

// ── SAVE notices (admin panel se) ─────────────────
app.post("/notices/save", async (req, res) => {
  try {
    const { notices } = req.body;
    if (!Array.isArray(notices))
      return res.json({ success: false, message: "Invalid data" });

    // Sirf naye notices add karo (jo MongoDB mein nahi hain)
    for (const n of notices) {
      if (!n._id) {
        // New notice — save karo
        await Notice.create({
          bus:  n.bus  || "",
          text: n.text || "",
          date: n.date || new Date().toLocaleString()
        });
      }
    }
    res.json({ success: true, message: "Notices saved" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =================================================
// ================= STUDENT ROUTES ================
// =================================================

// ── GET profile ────────────────────────────────────
app.get("/student/profile/:email", async (req, res) => {
  try {
    const email   = decodeURIComponent(req.params.email);
    const student = await Student.findOne({ email });
    if (!student) return res.json({ success: false, message: "Profile not found" });
    res.json({ success: true, student });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── UPDATE photo ───────────────────────────────────
app.put("/student/photo/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    await Student.findOneAndUpdate({ email }, { $set: { photo: req.body.photo } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── SET txn ID ─────────────────────────────────────
app.put("/student/txn/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    await Student.findOneAndUpdate({ email }, { $set: { txnId: req.body.txnId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── SAVE seat booking ──────────────────────────────
app.put("/student/seat/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { bookedBus, bookedSeat, name, course, rollNo, paymentScreenshot } = req.body;

    // Student profile update karo
    await Student.findOneAndUpdate(
      { email },
      { $set: { bookedBus, bookedSeat } }
    );

    // ✅ Booking collection mein bhi save karo (admin dashboard ke liye)
    const student = await Student.findOne({ email });
    if (student) {
      await Booking.findOneAndUpdate(
        { bus: bookedBus, studentId: student.rollNo || email },
        { $set: {
            bus:              bookedBus,
            name:             student.name || name || "",
            course:           student.course || course || "",
            studentId:        student.rollNo || email,
            seatNo:           bookedSeat,
            paymentScreenshot: paymentScreenshot || "",
            bookedAt:         new Date()
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

// =================================================
// ================= START SERVER ==================
// =================================================
app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));