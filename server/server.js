const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./docs/swagger.json');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const contractRoutes = require('./routes/contracts');
const PORT = Number(process.env.PORT) || 5000;
const app = express();

// Core Middleware
app.use(cors());
app.use(express.json());

// Debug Middleware – NACH express.json()
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('A', req.method, req.url, 'BODY:', req.body);
  }
  next();
});

// MongoDB Connect (ONLY ONCE)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/auth', authRoutes);

// Root
app.get('/', (req, res) => {
  res.send('Solana Freelance Platform API is running');
});

// Api Docs, run from docs folder
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
