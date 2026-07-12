import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/database/models/User.model.js";
import Office from "./src/database/models/Office.js";
import Offer from "./src/database/models/Offer.model.js";
import Shipment from "./src/database/models/Shipment.model.js";
import Driver from "./src/database/models/Driver.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const phone = "01122140182";
  const user = await User.findOne({ phone });
  if (!user) {
    console.log(`User with phone ${phone} not found`);
    process.exit(1);
  }

  const office = await Office.findOne({ user: user._id });
  if (office) {
    console.log("Found office profile:", office._id);
    
    // Clear pending offers
    const deletedOffers = await Offer.deleteMany({
      offerer: office._id,
      offererType: "Office",
      status: "pending"
    });
    console.log(`Deleted ${deletedOffers.deletedCount} pending offers`);

    // Clear active shipments assigned to office
    const updatedShipments = await Shipment.updateMany(
      { assignedOffice: office._id },
      { $set: { status: "delivered" } } // set to delivered so it's not active
    );
    console.log(`Updated ${updatedShipments.modifiedCount} shipments to 'delivered'`);

    // Clear assigned captains/drivers
    const updatedDrivers = await Driver.updateMany(
      { officeId: office._id },
      { $unset: { officeId: "" } }
    );
    console.log(`Unlinked ${updatedDrivers.modifiedCount} drivers from office`);

    // Import and clear active relations in OfficeCaptain
    try {
      const OfficeCaptain = (await import("./src/database/models/OfficeCaptain.js")).default;
      const deletedRelations = await OfficeCaptain.deleteMany({ officeId: office._id });
      console.log(`Deleted ${deletedRelations.deletedCount} OfficeCaptain relation records`);
    } catch (e) {
      console.log("OfficeCaptain model not found or failed to clean:", e.message);
    }
  }

  console.log("Clean up finished. Re-running eligibility validation...");
  
  // Re-import service to test
  const { default: accountDeletionService } = await import("./src/modules/auth/account-deletion.service.js");
  try {
    await accountDeletionService.validateAccountDeletionEligibility(user._id, user.role);
    console.log("Eligibility check: SUCCESS - Account is now eligible for deletion!");
  } catch (err) {
    console.error("Eligibility check failed:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
