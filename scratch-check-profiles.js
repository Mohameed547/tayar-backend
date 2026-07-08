import mongoose from "mongoose";
import "./src/config/env.js";
import User from "./src/database/models/User.model.js";
import Driver from "./src/database/models/Driver.js";
import Office from "./src/database/models/Office.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://gehadatef414_db_user:gehadatef12@ac-julmrxk-shard-00-00.7odeuov.mongodb.net:27017,ac-julmrxk-shard-00-01.7odeuov.mongodb.net:27017,ac-julmrxk-shard-00-02.7odeuov.mongodb.net:27017/deliveryhub?ssl=true&replicaSet=atlas-xjitnf-shard-0&authSource=admin&appName=Cluster0";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully to DB!");

  const drivers = await Driver.find({}).populate("user");
  console.log("\nDriver Profiles:");
  for (const d of drivers) {
    console.log(`ID: ${d._id} | User Name: ${d.user?.fullName} | User Email: ${d.user?.email} | Status: ${d.status} | IsActive: ${d.isActive}`);
  }

  const offices = await Office.find({}).populate("user");
  console.log("\nOffice Profiles:");
  for (const o of offices) {
    console.log(`ID: ${o._id} | User Name: ${o.user?.fullName} | User Email: ${o.user?.email} | Status: ${o.status}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
