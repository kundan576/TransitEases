import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { db } from './backend/services/db.js';
import { startNotificationWorker } from './backend/services/notificationWorker.js';

import authRoutes from './backend/routes/auth.js';
import busRoutes from './backend/routes/buses.js';
import routeRoutes from './backend/routes/routes.js';
import stopRoutes from './backend/routes/stops.js';
import driverRoutes from './backend/routes/driver.js';
import adminRoutes from './backend/routes/admin.js';
import commuteRoutes from './backend/routes/commutes.js';
import smsRoutes from './backend/routes/sms.js';
import reportRoutes from './backend/routes/reports.js';
import disruptionRoutes from './backend/routes/disruptions.js';

import { loadEnvironment } from './backend/services/envLoader.js';

loadEnvironment();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const server = http.createServer(app);

  // Setup Socket.IO for real-time live map tracking
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  app.set('io', io);

  io.on('connection', (socket) => {
    socket.on('bus:join_tracking', (busId: string) => {
      socket.join(`bus:${busId}`);
    });

    socket.on('bus:leave_tracking', (busId: string) => {
      socket.leave(`bus:${busId}`);
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  // Standard middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Start database initialization in parallel so server listens immediately
  const dbInitPromise = db.init()
    .then(() => {
      // Start background notification & commute checker worker
      startNotificationWorker();
    })
    .catch((err) => {
      console.error('[Database Init Warning]', err);
    });

  // Ensure database is initialized before handling API requests (except health check)
  app.use('/api', async (req, res, next) => {
    if (req.path === '/health') return next();
    try {
      await dbInitPromise;
    } catch {
      // db.init handles errors gracefully internally
    }
    next();
  });

  // Mount API Endpoints
  app.use('/api/auth', authRoutes);
  app.use('/api/buses', busRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/stops', stopRoutes);
  app.use('/api/driver', driverRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/commutes', commuteRoutes);
  app.use('/api/sms', smsRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/disruptions', disruptionRoutes);

  // Health check endpoint (always return HTTP 200 to prevent Nginx error_page 503 warmup.html interception)
  app.get('/api/health', (req, res) => {
    const dbStatus = db.getStatus();
    const hasMongoError = !dbStatus.connectedToMongo && (dbStatus.isMongoConfigured || process.env.REQUIRE_MONGODB === 'true');

    res.status(200).json({
      status: hasMongoError ? 'database_connection_error' : 'healthy',
      app: 'TransitEase',
      time: new Date().toISOString(),
      database: dbStatus,
      ...(hasMongoError && {
        error: `MongoDB Atlas connection failed (${dbStatus.connectionError}). Verify Atlas database user credentials and Network Access IP whitelist (0.0.0.0/0).`
      })
    });
  });

  // Frontend integration: Vite middleware in dev, static files in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Parse CLI args (--port, --host) or fallback to 3000
  let portArg: number | null = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      portArg = parseInt(args[i + 1], 10);
      break;
    }
  }

  // AI Studio requires dev server on port 3000 to avoid conflicting with container proxy (8080)
  const envPort = (process.env.NODE_ENV === 'production' && process.env.PORT && process.env.PORT !== '8080')
    ? parseInt(process.env.PORT, 10)
    : 3000;
  const PORT = portArg || envPort || 3000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[TransitEase Server] Running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('[TransitEase Server Fatal]', err);
  process.exit(1);
});
