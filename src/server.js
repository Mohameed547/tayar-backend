// import app from "./app.js";
// import { connectDB } from "./config/database.js";
// import { ENV } from "./config/env.js";

// const start = async () => {
//     await connectDB();
//     app.listen(ENV.PORT, () => {
//         console.log(`Server running on port ${ENV.PORT}`);
//     });
// };

// start();
import mongoose from 'mongoose';
import app from './app.js';
import { ENV } from './config/env.js';
import logger from './shared/middleware/logger.js';

mongoose.connect(ENV.MONGO_URI)
    .then(() => {
        logger.info('Connected to MongoDB successfully.');
        app.listen(ENV.PORT, () => {
            logger.info(`Server is running on port ${ENV.PORT}`);
        });
    })
    .catch((err) => {
        logger.error(`Database connection failed: ${err.message}`);
        process.exit(1);
    });
