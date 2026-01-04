import Class from '../models/Class';

/**
 * Checks if any of the given student IDs are already enrolled in another class.
 * @param studentIds Array of student IDs to check
 * @param currentClassId ID of the class currently being updated (optional)
 * @returns An error message if conflicts are found, otherwise null
 */
export const checkStudentConflicts = async (studentIds: string[], currentClassId?: string): Promise<string | null> => {
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return null;
    }

    const query: any = {
        studentIds: { $in: studentIds }
    };

    if (currentClassId) {
        query._id = { $ne: currentClassId };
    }

    const conflictingClasses = await Class.find(query).populate('studentIds', 'name');

    if (conflictingClasses.length > 0) {
        const conflictedStudentNames: string[] = [];
        conflictingClasses.forEach(cls => {
            const studentsInClass = cls.studentIds as any[];
            studentsInClass.forEach(student => {
                if (studentIds.includes(student._id.toString())) {
                    conflictedStudentNames.push(`${student.name} (in ${cls.name})`);
                }
            });
        });

        const uniqueConflicts = Array.from(new Set(conflictedStudentNames));
        return `Students are already enrolled in another class: ${uniqueConflicts.join(', ')}. A student can only be in one class across the platform.`;
    }

    return null;
};
