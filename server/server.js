const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jobRoutes = require("./routes/jobs");
const userRoutes = require("./routes/users");
const contractRoutes = require("./routes/contracts");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

// Routes
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contracts", contractRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Solana Freelance Platform API is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
