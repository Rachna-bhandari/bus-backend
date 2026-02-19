const express = require("express");
const router = express.Router();
const User = require("../models/user");

// POST /auth/login
router.post("/login", async (req,res)=>{
  const { email, password, role } = req.body;
  console.log("Login Attempt:", { email, role });

  try{
    const user = await User.findOne({ email, role });
    console.log("Found User:", user);

    if(!user) return res.json({ success:false, redirect:"signup" });

    if(user.password !== password) 
      return res.json({ success:false, message:"Incorrect password" });

    if(!user.isProfileComplete)
      return res.json({ success:false, redirect:"signup" });

    res.json({ success:true, message:"Login success", userId:user._id });
  }catch(err){
    console.error(err);
    res.json({ success:false, message:"Server error" });
  }
});

module.exports = router;
