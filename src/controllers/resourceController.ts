import { Request, Response } from 'express';
import Resource from '../models/Resource';
import fs from 'fs';
import path from 'path';

// Get resources for a class
export const getResourcesByClass = async (req: Request, res: Response) => {
    try {
        const { classId } = req.params;
        const resources = await Resource.find({ classId }).sort({ createdAt: -1 });
        res.status(200).json(resources);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get all resources uploaded by the logged-in teacher
export const getResourcesByTeacher = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const resources = await Resource.find({ uploadedBy: userId })
            .sort({ createdAt: -1 })
            .populate('classId', 'name')
            .populate('organizationId', 'name');
        res.status(200).json(resources);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get all resources for the logged-in student (from all their classes)
export const getResourcesByStudent = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;

        // Import Class model to find student's classes
        const Class = require('../models/Class').default;

        // Find all classes where the student is enrolled
        const studentClasses = await Class.find({ studentIds: userId }).select('_id');
        const classIds = studentClasses.map((cls: any) => cls._id);

        // Find all resources from those classes
        const resources = await Resource.find({ classId: { $in: classIds } })
            .sort({ createdAt: -1 })
            .populate('classId', 'name')
            .populate('organizationId', 'name');

        res.status(200).json(resources);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Create a new resource (File, Link, or Video)
export const createResource = async (req: Request, res: Response) => {
    try {
        const { title, type, url, classId } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        // Fetch class to get the correct organizationId
        const Class = require('../models/Class').default;
        const targetClass = await Class.findById(classId);
        if (!targetClass) {
            return res.status(404).json({ message: 'Class not found' });
        }
        const organizationId = targetClass.organizationId;

        const createdResources = [];

        // Handle Multiple Files
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            for (const file of req.files as Express.Multer.File[]) {
                const resourceUrl = `/uploads/${file.filename}`;
                // Determine type based on mimetype
                const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'file';

                // Use provided title as prefix if multiple files, or just filename
                const resourceTitle = title ? `${title} - ${file.originalname}` : file.originalname;

                const newResource = new Resource({
                    title: resourceTitle,
                    type: resourceType,
                    url: resourceUrl,
                    classId,
                    uploadedBy: userId,
                    organizationId
                });

                await newResource.save();
                createdResources.push(newResource);
            }
        } else {
            // Handle Single Link or Single File (fallback)
            let resourceUrl = url;
            let resourceType = type;
            let resourceTitle = title;

            if (req.file) {
                resourceUrl = `/uploads/${req.file.filename}`;
                resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'file';
                resourceTitle = title || req.file.originalname;
            }

            const newResource = new Resource({
                title: resourceTitle,
                type: resourceType,
                url: resourceUrl,
                classId,
                uploadedBy: userId,
                organizationId
            });

            await newResource.save();
            createdResources.push(newResource);
        }

        res.status(201).json(createdResources);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error });
    }
};

// Delete a resource
export const deleteResource = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const resource = await Resource.findById(id);

        if (!resource) {
            return res.status(404).json({ message: 'Resource not found' });
        }

        // Check if the user is the owner (optional but good practice)
        // @ts-ignore
        if (resource.uploadedBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this resource' });
        }

        // If it's a file, delete from filesystem
        if (resource.type === 'file' || resource.type === 'video') {
            const filePath = path.join(__dirname, '../../', resource.url); // url starts with /uploads/
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await resource.deleteOne();
        res.status(200).json({ message: 'Resource deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
