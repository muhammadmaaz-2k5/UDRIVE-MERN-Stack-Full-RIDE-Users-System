import mongoose from "mongoose";
import { setServers } from "node:dns/promises";

const connectDB = async (url) => {
  // Workaround for querySrv ECONNREFUSED error caused by local DNS blocking MongoDB SRV records
  await setServers(["1.1.1.1", "8.8.8.8"]);
  return mongoose.connect(url);
};

export default connectDB;
