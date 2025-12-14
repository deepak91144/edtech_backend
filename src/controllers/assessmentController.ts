import { Request, Response } from 'express';
import Assessment from '../models/Assessment';
import Submission from '../models/Submission';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';

// Create a new assessment
export const createAssessment = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, classId, questions, dueDate, status } = req.body;
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
            teacherId,
            questions,
            dueDate,
            status
        });

        await assessment.save();
        res.status(201).json({ message: 'Assessment created successfully', assessment });
    } catch (error) {
        console.error('Create assessment error:', error);
        res.status(500).json({ message: 'Error creating assessment' });
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
                    // Array comparison (order independent)
                    const studentAns = Array.isArray(ans.answer) ? ans.answer : [ans.answer];
                    const correctAns = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];

                    if (studentAns.length === correctAns.length &&
                        studentAns.every((val: string) => correctAns.includes(val))) {
                        marks = question.points;
                        obtainedMarks += marks;
                    }
                } else {
                    // Simple equality check for single_choice and true_false
                    if (JSON.stringify(ans.answer) === JSON.stringify(question.correctAnswer)) {
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
            obtainedMarks: needsManualGrading ? 0 : obtainedMarks, // If manual grading needed, set 0 initially or handle differently
            status: needsManualGrading ? 'submitted' : 'graded'
        });

        await submission.save();
        res.status(201).json({ message: 'Assessment submitted successfully', submission });
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
        const submissions = await Submission.find({ studentId });
        res.status(200).json({ submissions });
    } catch (error) {
        console.error('Get all my submissions error:', error);
        res.status(500).json({ message: 'Error fetching submissions' });
    }
};
