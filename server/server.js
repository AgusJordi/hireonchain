const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const bulletjson = require('bulletproof-json');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./docs/swagger.json');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const contractRoutes = require('./routes/contracts');
const PORT = Number(process.env.PORT) || 5000;
const app = express();

const sanitizeInput = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = sanitizeInput(value);
  }
  return clean;
};

// Security Middleware
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
});

// Debug Middleware – NACH express.json()
const SENSITIVE_FIELDS = ['password', 'token', 'signature', 'secret', 'nonce'];
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    const safeBody = req.body && typeof req.body === 'object'
      ? Object.fromEntries(
          Object.entries(req.body).map(([k, v]) =>
            SENSITIVE_FIELDS.includes(k) ? [k, '[REDACTED]'] : [k, v]
          )
        )
      : req.body;
    console.log('A', req.method, req.url, 'BODY:', safeBody);
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
