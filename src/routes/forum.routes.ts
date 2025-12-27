import express from 'express';
import {
    createPost,
    getPostsByClass,
    getPostById,
    addComment,
    togglePin,
    deletePost,
    deleteComment,
    markAsRead,
} from '../controllers/forum.controller';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all posts for a class (Public to class members - for now authenticating user)
router.get('/:classId/posts', authenticateToken, getPostsByClass);

// Get single post
// Get single post
router.get('/posts/:postId', authenticateToken, getPostById);

// Mark as read
router.post('/posts/:postId/read', authenticateToken, markAsRead);



// Create a post
router.post('/:classId/posts', authenticateToken, createPost);

// Add a comment
router.post('/posts/:postId/comments', authenticateToken, addComment);

// Toggle Pin (Teacher/Admin only - logic in controller, but route needs auth)
router.patch('/posts/:postId/pin', authenticateToken, togglePin);

// Delete Post
router.delete('/posts/:postId', authenticateToken, deletePost);

// Delete Comment
router.delete('/posts/:postId/comments/:commentId', authenticateToken, deleteComment);

export default router;
