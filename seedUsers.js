const mongoose = require("mongoose");

// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/busbuddy")
  .then(async () => {
    console.log("MongoDB Connected");

    // Define User model
    const User = mongoose.model("User", new mongoose.Schema({
      email: String,
      password: String,
      role: String
    }));

    // Clear existing users
    await User.deleteMany({});

    // Insert test users
    const users = [
      { email: "student@example.com", password: "1234", role: "Student" },
      { email: "teacher@example.com", password: "abcd", role: "Teacher" },
      { email: "driver@example.com", password: "bus123", role: "Driver" }
    ];

    const inserted = await User.create(users);

    console.log("Inserted users:", inserted.map(u => ({ email: u.email, role: u.role })));
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
