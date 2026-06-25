import "dotenv/config";

export const ENV = {
  PORT: process.env.PORT || 4000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/deliverhub",
  //mongodb+srv://ayaaaly512_db_user:Aya112233#@cluster0.wyjymq2.mongodb.net/
  // MONGO_URI:
  //   process.env.MONGO_URI ||
  //   "mongodb+srv://ayaaaly512_db_user:Aya112233#@cluster0.wyjymq2.mongodb.net/",
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  NODE_ENV: process.env.NODE_ENV || "development",
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "*",
};
