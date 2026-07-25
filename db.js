const mongoose = require("mongoose");
const connectDB = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://himanshukandpalofficial16_db_user:T6VlpitxoDPEeqtq@cluster0.fv5ifpy.mongodb.net/busbuddy?appName=Cluster0"
    );
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
module.exports = connectDB;
