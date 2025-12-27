import { Request, Response } from 'express';
import ForumPost from '../models/ForumPost';
import User from '../models/User';
import ForumPostRead from '../models/ForumPostRead';
import { AuthRequest } from '../middleware/auth';

// Create a new post
export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;
        const { title, content } = req.body;
        const authorId = req.user?.id;
        const authorRole = req.user?.role;

        if (!authorId || !authorRole) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const user = await User.findById(authorId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const authorName = user.name;

        // Cast authorRole to any to bypass strict enum check if admin is present in token but not in schema
        // Ideally schema should support admin if admin can post
        const newPost = new ForumPost({
            classId,
            author: authorId,
            authorName,
            authorRole: authorRole as any,
            title,
            content,
        });

        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all posts for a class
export const getPostsByClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const { classId } = req.params;
        // Sort by pinned (desc) then createdAt (desc)
        const posts = await ForumPost.find({ classId }).sort({ isPinned: -1, createdAt: -1 }).lean();

        // If user is authenticated (which they should be), fetch their read status
        const userId = (req as AuthRequest).user?.id;
        if (userId) {
            const readRecords = await ForumPostRead.find({
                userId,
                postId: { $in: posts.map(p => p._id) }
            });

            const readMap = new Map(readRecords.map(r => [r.postId.toString(), r.lastReadAt]));

            const postsWithReadStatus = posts.map(post => ({
                ...post,
                lastReadAt: readMap.get(post._id.toString()) || null
            }));

            res.status(200).json(postsWithReadStatus);
            return;
        }

        res.status(200).json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark post as read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { postId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        await ForumPostRead.findOneAndUpdate(
            { userId, postId },
            { lastReadAt: new Date() },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Marked as read' });
    } catch (error) {
        console.error('Error marking post as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get single post by ID
export const getPostById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { postId } = req.params;
        const post = await ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }
        res.status(200).json(post);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add a comment to a post
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const authorId = req.user?.id;
        const authorRole = req.user?.role;

        if (!authorId || !authorRole) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const user = await User.findById(authorId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const authorName = user.name;

        const post = await ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        post.comments.push({
            author: authorId as any,
            authorName,
            authorRole: authorRole as any,
            content,
            createdAt: new Date(),
        });

        await post.save();
        res.status(201).json(post);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Toggle Pin Status (Teachers only)
export const togglePin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { postId } = req.params;

        // Check if user is teacher or org_admin
        if (req.user?.role !== 'teacher' && req.user?.role !== 'org_admin') {
            res.status(403).json({ message: 'Only teachers can pin posts' });
            return;
        }

        const post = await ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        post.isPinned = !post.isPinned;
        await post.save();
        res.status(200).json({ message: 'Pin status updated', isPinned: post.isPinned });
    } catch (error) {
        console.error('Error toggling pin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete Post (Author or Teacher)
export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { postId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        const post = await ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        // Allow deletion if user is the author OR if user is a teacher/admin
        if (post.author.toString() !== userId && userRole !== 'teacher' && userRole !== 'org_admin') {
            res.status(403).json({ message: 'Not authorized to delete this post' });
            return;
        }

        await post.deleteOne();
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete Comment (Author or Teacher)
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        const post = await ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }

        const comment = post.comments.find(c => c._id?.toString() === commentId);
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }

        // Allow deletion if user is the comment author OR if user is a teacher/admin
        if (comment.author.toString() !== userId && userRole !== 'teacher' && userRole !== 'org_admin') {
            res.status(403).json({ message: 'Not authorized to delete this comment' });
            return;
        }

        // Filter out the comment
        post.comments = post.comments.filter(c => c._id?.toString() !== commentId);
        await post.save();
        res.status(200).json({ message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Server error' });
    }
}
