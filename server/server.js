const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./docs/swagger.json');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const contractRoutes = require('./routes/contracts');
const verifyTxRoutes = require('./routes/verifyTx');
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

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isDevLocalOrigin = (origin) => {
  // In dev, allow localhost/127.0.0.1 on any port, http or https
  if (process.env.NODE_ENV === 'production') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, etc.)
    if (!origin) return callback(null, true);
    if (isDevLocalOrigin(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

// CORS must go before helmet so preflight OPTIONS requests are handled first
app.use(cors(corsOptions));
// Explicitly handle preflight in Express 5 (avoid '*' path-to-regexp issues)
app.options(/.*/, cors(corsOptions));

// Security Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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
app.use('/api/verify-tx', verifyTxRoutes);

// Root
app.get('/', (req, res) => {
  res.send('Solana Freelance Platform API is running');
});

// Api Docs, run from docs folder
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
}

// Error handler (keep last)
app.use((err, _req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS blocked: Origin not allowed' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ message: 'Server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
