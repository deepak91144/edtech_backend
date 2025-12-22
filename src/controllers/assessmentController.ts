import { Request, Response } from 'express';
import Assessment from '../models/Assessment';
import Submission from '../models/Submission';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';

// Create a new assessment
export const createAssessment = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, classId, subjectId, questions, dueDate, status } = req.body;
        const teacherId = req.user?.id;

        // Verify class ownership
        const classExists = await Class.findOne({
            _id: classId,
            teacherIds: teacherId
        });

        if (!classExists) {
            return res.status(403).json({ message: 'Unauthorized to create assessment for this class' });
        }

        const assessment = new Assessment({
            title,
            description,
            classId,
            subjectId,
            teacherId,
            questions: questions || [],
            dueDate,
            status
        });

        await assessment.save();
        res.status(201).json({ message: 'Assessment created successfully', assessment });
    } catch (error: any) {
        console.error('Create assessment error:', error);

        // Return validation errors if available
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err: any) => err.message);
            return res.status(400).json({ message: messages.join(', ') });
        }

        res.status(500).json({ message: error.message || 'Error creating assessment' });
    }
};

// Get assessments for a class (Teacher sees all, Student sees published)
export const getAssessments = async (req: AuthRequest, res: Response) => {
    try {
        const { classId } = req.params;
        const userId = req.user?.id;
        const role = req.user?.role;

        const query: any = { classId };

        if (role === 'student') {
            query.status = 'published';
        }

        const assessments = await Assessment.find(query).sort({ createdAt: -1 });
        res.status(200).json({ assessments });
    } catch (error) {
        console.error('Get assessments error:', error);
        res.status(500).json({ message: 'Error fetching assessments' });
    }
};

// Get all assessments created by the teacher
export const getTeacherAssessments = async (req: AuthRequest, res: Response) => {
    try {
        const teacherId = req.user?.id;

        const assessments = await Assessment.find({ teacherId })
            .populate('classId', 'name')
            .populate('subjectId', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ assessments });
    } catch (error) {
        console.error('Get teacher assessments error:', error);
        res.status(500).json({ message: 'Error fetching assessments' });
    }
};

// Update an assessment (only for draft assessments)
export const updateAssessment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const teacherId = req.user?.id;
        const updates = req.body;

        // Find the assessment
        const assessment = await Assessment.findById(id);

        if (!assessment) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        // Check if teacher owns this assessment
        if (assessment.teacherId.toString() !== teacherId) {
            return res.status(403).json({ message: 'Unauthorized to update this assessment' });
        }

        // Allow publishing (changing status from draft to published)
        const isPublishing = updates.status === 'published' && assessment.status === 'draft';

        // If already published, don't allow any updates
        if (assessment.status === 'published' && !isPublishing) {
            return res.status(403).json({ message: 'Cannot update published assessments' });
        }

        // If publishing, validate that there are questions
        const questionsToValidate = updates.questions !== undefined ? updates.questions : assessment.questions;
        if (isPublishing && (!questionsToValidate || questionsToValidate.length === 0)) {
            return res.status(400).json({ message: 'Cannot publish assessment without questions' });
        }

        // Update the assessment
        // Explicitly handle questions array to prevent merging issues
        if (updates.questions !== undefined) {
            assessment.questions = updates.questions;
        }

        // Update other fields
        if (updates.title !== undefined) assessment.title = updates.title;
        if (updates.description !== undefined) assessment.description = updates.description;
        if (updates.classId !== undefined) assessment.classId = updates.classId;
        if (updates.subjectId !== undefined) assessment.subjectId = updates.subjectId;
        if (updates.dueDate !== undefined) assessment.dueDate = updates.dueDate;
        if (updates.status !== undefined) assessment.status = updates.status;

        await assessment.save();

        res.status(200).json({ message: 'Assessment updated successfully', assessment });
    } catch (error: any) {
        console.error('Update assessment error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err: any) => err.message);
            return res.status(400).json({ message: messages.join(', ') });
        }

        res.status(500).json({ message: error.message || 'Error updating assessment' });
    }
};

// Get assessment details
export const getAssessmentById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const assessment = await Assessment.findById(id);

        if (!assessment) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        res.status(200).json({ assessment });
    } catch (error) {
        console.error('Get assessment error:', error);
        res.status(500).json({ message: 'Error fetching assessment' });
    }
};

// Submit an assessment
export const submitAssessment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { answers } = req.body;
        const studentId = req.user?.id;

        // Check if already submitted
        const existingSubmission = await Submission.findOne({ assessmentId: id, studentId });
        if (existingSubmission) {
            return res.status(400).json({ message: 'You have already submitted this assessment' });
        }

        const assessment = await Assessment.findById(id);
        if (!assessment) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        // Check if due date has passed
        if (assessment.dueDate && new Date(assessment.dueDate) < new Date()) {
            return res.status(403).json({ message: 'The deadline for this assessment has passed. Submissions are no longer accepted.' });
        }

        // Auto-grade objective questions
        let obtainedMarks = 0;
        let needsManualGrading = false;

        const processedAnswers = answers.map((ans: any) => {
            const question = assessment.questions.find((q: any) => q._id.toString() === ans.questionId);
            let marks = 0;

            if (question) {
                if (question.type === 'descriptive') {
                    needsManualGrading = true;
                } else if (question.type === 'multiple_choice') {
                    // Array comparison (order independent, unique values, string normalization)
                    const studentAns = Array.isArray(ans.answer) ? ans.answer : [ans.answer];
                    const correctAns = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];

                    const studentAnsSet = new Set<string>(studentAns.map((v: any) => String(v)));
                    const correctAnsSet = new Set<string>(correctAns.map((v: any) => String(v)));

                    if (studentAnsSet.size === correctAnsSet.size &&
                        [...studentAnsSet].every(val => correctAnsSet.has(val))) {
                        marks = question.points;
                        obtainedMarks += marks;
                    }
                } else {
                    // Simple equality check with string normalization
                    const studentAns = String(ans.answer);
                    const correctAns = String(question.correctAnswer);

                    if (studentAns === correctAns) {
                        marks = question.points;
                        obtainedMarks += marks;
                    }
                }
            }

            return {
                ...ans,
                marks
            };
        });

        const submission = new Submission({
            assessmentId: id,
            studentId,
            answers: processedAnswers,
            obtainedMarks: needsManualGrading ? 0 : obtainedMarks,
            status: needsManualGrading ? 'submitted' : 'graded'
        });

        await submission.save();
        res.status(201).json({
            message: 'Assessment submitted successfully',
            submission,
            autoGraded: !needsManualGrading
        });
    } catch (error) {
        console.error('Submit assessment error:', error);
        res.status(500).json({ message: 'Error submitting assessment' });
    }
};

// Get submissions for an assessment (Teacher only)
export const getSubmissions = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const submissions = await Submission.find({ assessmentId: id })
            .populate('studentId', 'name email')
            .sort({ submittedAt: -1 });

        res.status(200).json({ submissions });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ message: 'Error fetching submissions' });
    }
};

// Grade a submission
export const gradeSubmission = async (req: AuthRequest, res: Response) => {
    try {
        const { submissionId } = req.params;
        const { gradedAnswers, feedback } = req.body;

        const submission = await Submission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        // Update marks for each answer
        if (gradedAnswers && Array.isArray(gradedAnswers)) {
            let totalMarks = 0;
            submission.answers = submission.answers.map((ans: any) => {
                const grade = gradedAnswers.find((g: any) => g.questionId === ans.questionId);
                const marks = grade ? Number(grade.marks) : (ans.marks || 0);
                totalMarks += marks;
                return {
                    ...ans,
                    marks
                };
            });
            submission.obtainedMarks = totalMarks;
        }

        submission.feedback = feedback;
        submission.status = 'graded';
        submission.gradedAt = new Date();

        await submission.save();

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        res.status(200).json({ message: 'Submission graded successfully', submission });
    } catch (error) {
        console.error('Grade submission error:', error);
        res.status(500).json({ message: 'Error grading submission' });
    }
};

// Get my submission for an assessment
export const getMySubmission = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const studentId = req.user?.id;

        const submission = await Submission.findOne({ assessmentId: id, studentId });

        res.status(200).json({ submission });
    } catch (error) {
        console.error('Get my submission error:', error);
        res.status(500).json({ message: 'Error fetching submission' });
    }
};

// Get all my submissions
export const getAllMySubmissions = async (req: AuthRequest, res: Response) => {
    try {
        const studentId = req.user?.id;
        const submissions = await Submission.find({ studentId })
            .populate('assessmentId', 'title questions')
            .sort({ submittedAt: -1 });
        res.status(200).json({ submissions });
    } catch (error) {
        console.error('Get all my submissions error:', error);
        res.status(500).json({ message: 'Error fetching submissions' });
    }
};
