const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const jobRoutes = require("./routes/jobs");
const userRoutes = require("./routes/users");
const contractRoutes = require("./routes/contracts");

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors());
app.use(express.json());

// Debug Middleware – NACH express.json()
app.use((req, res, next) => {
  console.log("A", req.method, req.url, "BODY:", req.body);
  next();
});

// MongoDB Connect (ONLY ONCE)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contracts", contractRoutes);

// Root
app.get("/", (req, res) => {
  res.send("Solana Freelance Platform API is running");
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// const express = require("express"); const cors = require("cors"); const dotenv = require("dotenv"); const mongoose = require("mongoose"); const jobRoutes = require("./routes/jobs"); const userRoutes = require("./routes/users"); const contractRoutes = require("./routes/contracts"); dotenv.config(); const app = express(); const PORT = process.env.PORT || 5000; // Middleware app.use(cors()); app.use(express.json()); // Connect to MongoDB (only ONCE) mongoose .connect(process.env.MONGO_URI) .then(() => console.log("MongoDB connected")) .catch((err) => { console.error("MongoDB connection error:", err); process.exit(1); }); // Routes app.use("/api/jobs", jobRoutes); app.use("/api/users", userRoutes); app.use("/api/contracts", contractRoutes); // Root route app.get("/", (req, res) => { res.send("Solana Freelance Platform API is running"); }); // Start server app.listen(PORT, () => { console.log(Server running on port ${PORT}); });