import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { initializeDatabase } from './db.js';
import studentRoutes from './routes/student.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// API Routes
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'الخادم يعمل بشكل صحيح',
    timestamp: new Date().toISOString()
  });
});

// Database Status
app.get('/api/db-status', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'قاعدة البيانات تعمل بشكل صحيح',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الاتصال بقاعدة البيانات',
      error: error.message
    });
  }
});

// Serve Static Files
app.use(express.static(path.join(__dirname, '../'), {
  index: ['index.html'],
  maxAge: '1h',
  etag: false
}));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'الصفحة غير موجودة'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('خطأ غير متوقع:', err);
  res.status(500).json({
    success: false,
    message: 'خطأ في الخادم',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Initialize Database and Start Server
async function start() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`✅ الخادم يعمل على المنفذ: ${PORT}`);
      console.log(`📍 الرابط: http://localhost:${PORT}`);
      console.log(`🔗 الـ API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ فشل في بدء الخادم:', error);
    process.exit(1);
  }
}

start();

export default app;
