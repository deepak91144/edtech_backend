import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';

// Import routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import organizationRoutes from './routes/organization';
import classRoutes from './routes/class';
import announcementRoutes from './routes/announcement';
import attendanceRoutes from './routes/attendance';
import assessmentRoutes from './routes/assessment';
import liveClassRoutes from './routes/liveClass';
import resourceRoutes from './routes/resource';
import notesRoutes from './routes/notes';

// Load environment variables
dotenv.config();

// Initialize express app
const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Connect to database
connectDB();

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'EdTech Platform API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/organizations', authenticateToken, organizationRoutes);
app.use('/api/classes', authenticateToken, classRoutes);
app.use('/api/announcements', authenticateToken, announcementRoutes);
app.use('/api/attendance', authenticateToken, attendanceRoutes);
app.use('/api/assessments', authenticateToken, assessmentRoutes);
app.use('/api/live-classes', authenticateToken, liveClassRoutes);
app.use('/api/resources', authenticateToken, resourceRoutes);
app.use('/api/notes', authenticateToken, notesRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
