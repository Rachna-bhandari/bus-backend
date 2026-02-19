const express = require("express");
const router = express.Router();
const User = require("../models/user");

router.post("/student", async (req, res) => {
  const { email, name, rollNo, course, phone } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ UPDATE PROFILE + MARK COMPLETE
    user.name = name;
    user.rollNo = rollNo;
    user.course = course;
    user.phone = phone;
    user.isProfileComplete = true;

    await user.save();

    // ✅ THIS IS THE KEY LINE
    return res.json({
      success: true
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
