import mongoose from "mongoose";
import "./src/config/env.js"; // to load environment variables
import User from "./src/database/models/User.model.js";
import Driver from "./src/database/models/Driver.js";
import Shipment from "./src/database/models/Shipment.model.js";
import Office from "./src/database/models/Office.js";
import Escrow from "./src/database/models/Escrow.model.js";
import { Wallet, Transaction } from "./src/database/models/Wallet.model.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://gehadatef414_db_user:gehadatef12@ac-julmrxk-shard-00-00.7odeuov.mongodb.net:27017,ac-julmrxk-shard-00-01.7odeuov.mongodb.net:27017,ac-julmrxk-shard-00-02.7odeuov.mongodb.net:27017/deliveryhub?ssl=true&replicaSet=atlas-xjitnf-shard-0&authSource=admin&appName=Cluster0";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully to DB!");

  // Find delivered shipments with assigned office
  const shipments = await Shipment.find({
    status: "delivered",
    assignedOffice: { $ne: null }
  }).populate("assignedOffice").populate("captain");

  console.log(`Found ${shipments.length} delivered shipments with assignedOffice`);

  for (const s of shipments) {
    console.log(`\nShipment ID: ${s._id}, Tracking: ${s.trackingNumber}`);
    console.log(`Assigned Office ID: ${s.assignedOffice?._id}, Owner User ID: ${s.assignedOffice?.user}`);
    console.log(`Captain User ID: ${s.captain?._id} (${s.captain?.fullName})`);
    console.log(`Price: ${s.price}, CaptainPrice: ${s.captainPrice}, officeDiscountPercentage: ${s.officeDiscountPercentage}`);

    // check escrow
    const escrow = await Escrow.findOne({ shipment: s._id });
    if (escrow) {
      console.log(`Escrow Status: ${escrow.status}, Amount: ${escrow.amount}, NetAmount: ${escrow.netAmount}`);
    } else {
      console.log("No escrow record found!");
    }

    // check office wallet
    if (s.assignedOffice?.user) {
      const officeWallet = await Wallet.findOne({ userId: s.assignedOffice.user });
      console.log(`Office Wallet: Balance = ${officeWallet?.balance}, Locked = ${officeWallet?.lockedBalance}`);
      const officeTxs = await Transaction.find({ walletId: officeWallet?._id });
      console.log(`Office Transactions: ${officeTxs.length}`);
      for (const t of officeTxs) {
        console.log(` - Type: ${t.type}, Purpose: ${t.purpose}, Amount: ${t.amount}, Status: ${t.status}`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
