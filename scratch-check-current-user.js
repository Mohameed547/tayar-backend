import mongoose from "mongoose";
import "./src/config/env.js";
import User from "./src/database/models/User.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://gehadatef414_db_user:gehadatef12@ac-julmrxk-shard-00-00.7odeuov.mongodb.net:27017,ac-julmrxk-shard-00-01.7odeuov.mongodb.net:27017,ac-julmrxk-shard-00-02.7odeuov.mongodb.net:27017/deliveryhub?ssl=true&replicaSet=atlas-xjitnf-shard-0&authSource=admin&appName=Cluster0";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully to DB!");

  const users = await User.find({}).sort({ createdAt: -1 });
  console.log("\nRegistered Users:");
  for (const u of users) {
    console.log(`ID: ${u._id} | Name: ${u.fullName} | Email: ${u.email} | Role: ${u.role} | Status: ${u.status}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
