import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Organization from '../models/Organization';
import User from '../models/User';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

const router = Router();

// All routes require admin or org_admin authentication
router.use(requireRole('admin', 'org_admin'));

// Get all organizations
router.get('/organizations', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let query = {};
        if (req.user?.role === 'org_admin') {
            query = { adminId: req.user.id };
        }

        const organizations = await Organization.find(query)
            .select('name type createdAt updatedAt')
            .sort({ createdAt: -1 });

        // Get counts for each organization
        const organizationsWithCounts = await Promise.all(
            organizations.map(async (org) => {
                const teacherCount = await User.countDocuments({ organizationId: org._id, role: 'teacher' });
                const studentCount = await User.countDocuments({ organizationId: org._id, role: 'student' });
                const classCount = await Class.countDocuments({ organizationId: org._id });

                return {
                    ...org.toObject(),
                    stats: {
                        teachers: teacherCount,
                        students: studentCount,
                        classes: classCount
                    }
                };
            })
        );

        res.json({
            success: true,
            count: organizations.length,
            organizations: organizationsWithCounts
        });
    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single organization
router.get('/organizations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const organization = await Organization.findById(req.params.id);

        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }

        const teacherCount = await User.countDocuments({ organizationId: organization._id, role: 'teacher' });
        const studentCount = await User.countDocuments({ organizationId: organization._id, role: 'student' });
        const classCount = await Class.countDocuments({ organizationId: organization._id });

        res.json({
            success: true,
            organization: {
                ...organization.toObject(),
                stats: {
                    teachers: teacherCount,
                    students: studentCount,
                    classes: classCount
                }
            }
        });
    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create organization
router.post('/organizations',
    [
        body('name').notEmpty().withMessage('Organization name is required'),
        body('type').isIn(['school', 'college', 'university']).withMessage('Valid organization type is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { name, description, photo, address, type } = req.body;

            // The current logged-in user will be the organization admin
            if (!req.user?.id) {
                res.status(401).json({ message: 'User not authenticated' });
                return;
            }

            // Create Organization with the current user as admin
            const organization = new Organization({
                name,
                description,
                photo,
                address,
                type,
                adminId: req.user.id
            });

            await organization.save();

            // Update the user's organizationId
            await User.findByIdAndUpdate(req.user.id, {
                organizationId: organization._id
            });

            res.status(201).json({
                success: true,
                message: 'Organization and admin created successfully',
                organization
            });
        } catch (error) {
            console.error('Create organization error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update organization
router.put('/organizations/:id',
    [
        body('name').optional().notEmpty().withMessage('Organization name cannot be empty'),
        body('type').optional().isIn(['school', 'college', 'university']).withMessage('Valid organization type is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { name, description, photo, address, type } = req.body;
            const updateData: any = {};

            if (name) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (photo !== undefined) updateData.photo = photo;
            if (address !== undefined) updateData.address = address;
            if (type) updateData.type = type;
            updateData.updatedAt = new Date();

            const organization = await Organization.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            );

            if (!organization) {
                res.status(404).json({ message: 'Organization not found' });
                return;
            }

            res.json({
                success: true,
                message: 'Organization updated successfully',
                organization
            });
        } catch (error) {
            console.error('Update organization error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete organization
router.delete('/organizations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const organization = await Organization.findById(req.params.id);

        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }

        // Delete all related data
        await User.deleteMany({ organizationId: organization._id });
        await Class.deleteMany({ organizationId: organization._id });
        await organization.deleteOne();

        res.json({
            success: true,
            message: 'Organization and all related data deleted successfully'
        });
    } catch (error) {
        console.error('Delete organization error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get dashboard statistics
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let orgQuery = {};
        let userQuery: any = { role: 'teacher' };
        let studentQuery: any = { role: 'student' };
        let classQuery: any = {};

        if (req.user?.role === 'org_admin') {
            orgQuery = { _id: req.user.organizationId };
            userQuery.organizationId = req.user.organizationId;
            studentQuery.organizationId = req.user.organizationId;
            classQuery.organizationId = req.user.organizationId;
        }

        const totalOrganizations = await Organization.countDocuments(orgQuery);
        const totalTeachers = await User.countDocuments(userQuery);
        const totalStudents = await User.countDocuments(studentQuery);
        const totalClasses = await Class.countDocuments(classQuery);

        // Get organization breakdown (only relevant for platform admin, but safe to run with filter)
        const organizationsByType = await Organization.aggregate([
            { $match: orgQuery },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            stats: {
                totalOrganizations,
                totalTeachers,
                totalStudents,
                totalClasses,
                organizationsByType: organizationsByType.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {} as Record<string, number>)
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all students from all organizations (for org_admin, only their orgs)
router.get('/students', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let organizationIds: any[] = [];

        if (req.user?.role === 'org_admin') {
            // Get all organizations owned by this org_admin
            const organizations = await Organization.find({ adminId: req.user.id }).select('_id');
            organizationIds = organizations.map(org => org._id);
        } else if (req.user?.role === 'admin') {
            // Platform admin can see all students
            const organizations = await Organization.find().select('_id');
            organizationIds = organizations.map(org => org._id);
        }

        if (organizationIds.length === 0) {
            res.json({
                success: true,
                count: 0,
                students: []
            });
            return;
        }

        const students = await User.find({
            organizationId: { $in: organizationIds },
            role: 'student'
        })
            .select('-password')
            .populate('organizationId', 'name type')
            .sort({ createdAt: -1 });

        // Fetch all classes for these organizations to add class information
        const classes = await Class.find({ organizationId: { $in: organizationIds } });

        // Add class information to students
        const studentsWithClasses = students.map(student => {
            const studentObj: any = student.toObject();

            // Find classes that include this student
            const studentClasses = classes.filter(cls =>
                cls.studentIds.some(studentId => studentId.toString() === student._id.toString())
            );

            studentObj.classes = studentClasses.map(cls => ({
                _id: cls._id,
                name: cls.name
            }));

            return studentObj;
        });

        res.json({
            success: true,
            count: studentsWithClasses.length,
            students: studentsWithClasses
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all teachers from all organizations (for org_admin, only their orgs)
router.get('/teachers', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let organizationIds: any[] = [];

        if (req.user?.role === 'org_admin') {
            // Get all organizations owned by this org_admin
            const organizations = await Organization.find({ adminId: req.user.id }).select('_id');
            organizationIds = organizations.map(org => org._id);
        } else if (req.user?.role === 'admin') {
            // Platform admin can see all teachers
            const organizations = await Organization.find().select('_id');
            organizationIds = organizations.map(org => org._id);
        }

        if (organizationIds.length === 0) {
            res.json({
                success: true,
                count: 0,
                teachers: []
            });
            return;
        }

        const teachers = await User.find({
            organizationId: { $in: organizationIds },
            role: 'teacher'
        })
            .select('-password')
            .populate('organizationId', 'name type')
            .sort({ createdAt: -1 });

        // Fetch all classes for these organizations to add class information
        const classes = await Class.find({ organizationId: { $in: organizationIds } });

        // Add class information to teachers
        const teachersWithClasses = teachers.map(teacher => {
            const teacherObj: any = teacher.toObject();

            // Find classes that include this teacher
            const teacherClasses = classes.filter(cls =>
                cls.teacherIds.some(teacherId => teacherId.toString() === teacher._id.toString())
            );

            teacherObj.classes = teacherClasses.map(cls => ({
                _id: cls._id,
                name: cls.name
            }));

            return teacherObj;
        });

        res.json({
            success: true,
            count: teachersWithClasses.length,
            teachers: teachersWithClasses
        });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all classes from all organizations (for org_admin, only their orgs)
router.get('/classes', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let organizationIds: any[] = [];

        if (req.user?.role === 'org_admin') {
            // Get all organizations owned by this org_admin
            const organizations = await Organization.find({ adminId: req.user.id }).select('_id');
            organizationIds = organizations.map(org => org._id);
        } else if (req.user?.role === 'admin') {
            // Platform admin can see all classes
            const organizations = await Organization.find().select('_id');
            organizationIds = organizations.map(org => org._id);
        }

        if (organizationIds.length === 0) {
            res.json({
                success: true,
                count: 0,
                classes: []
            });
            return;
        }

        const classes = await Class.find({
            organizationId: { $in: organizationIds }
        })
            .populate('organizationId', 'name type')
            .sort({ createdAt: -1 });

        // Add counts for teachers and students
        const classesWithCounts = classes.map(cls => {
            const classObj: any = cls.toObject();
            classObj.teacherCount = cls.teacherIds?.length || 0;
            classObj.studentCount = cls.studentIds?.length || 0;
            return classObj;
        });

        res.json({
            success: true,
            count: classesWithCounts.length,
            classes: classesWithCounts
        });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
