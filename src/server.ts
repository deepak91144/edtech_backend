import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();

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
import calendarRoutes from './routes/calendar';
import holidayRoutes from './routes/holiday';
import forumRoutes from './routes/forum.routes';
import payrollRoutes from './routes/payroll';
import feeRoutes from './routes/feeRoutes';

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
app.use('/api/calendar', authenticateToken, calendarRoutes);
app.use('/api/holidays', authenticateToken, holidayRoutes);
app.use('/api/forums', authenticateToken, forumRoutes);
app.use('/api', payrollRoutes);
app.use('/api/fees', authenticateToken, feeRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Socket.io Setup
import { Server } from 'socket.io';
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

const whiteboardStates = new Map<string, boolean>();
const whiteboardElements = new Map<string, any[]>();

io.on('connection', (socket) => {
    socket.on('join-whiteboard', (roomId) => {
        socket.join(roomId);
        // Send current visibility state and elements to the user who just joined
        socket.emit('whiteboard-visibility', whiteboardStates.get(roomId) || false);
        socket.emit('whiteboard-init', whiteboardElements.get(roomId) || []);
    });

    socket.on('toggle-whiteboard', ({ roomId, isOpen }) => {
        whiteboardStates.set(roomId, isOpen);
        io.to(roomId).emit('whiteboard-visibility', isOpen);
    });

    socket.on('whiteboard-update', ({ roomId, elements }) => {
        // 'elements' is now expected to be an object representing an operation: { type: 'add'|'delete', element: ... }
        if (!whiteboardElements.has(roomId)) {
            whiteboardElements.set(roomId, []);
        }

        const roomElements = whiteboardElements.get(roomId)!;

        if (elements.type === 'add') {
            roomElements.push(elements.element);
        } else if (elements.type === 'delete') {
            const index = roomElements.findIndex(el => el.id === elements.elementId);
            if (index !== -1) roomElements.splice(index, 1);
        }

        socket.to(roomId).emit('whiteboard-update', elements);
    });

    socket.on('cursor-move', ({ roomId, cursor }) => {
        socket.to(roomId).emit('cursor-move', {
            userId: socket.id,
            ...cursor
        });
    });

    socket.on('whiteboard-clear', (roomId) => {
        whiteboardElements.set(roomId, []);
        io.to(roomId).emit('whiteboard-clear');
    });

    socket.on('disconnect', () => {
    });
});

export default app;
