const CourseClass = require('../CourseClass');

function createCourseInstance(courseDocument) {
    const course = new CourseClass(courseDocument.courseId, courseDocument.courseName);
    
    return new Promise((resolve) => {
        setTimeout(() => {
            course.walletID = courseDocument.walletId || course.walletID;
            course.address = courseDocument.address || course.address;
            course.trashbinaAddress = courseDocument.trashbinaAddress || course.trashbinaAddress;
            
            course.signInTable = (courseDocument.signInTable || []).map(record => ({
                studentId: record.studentId,
                studentName: record.studentName,
                time: record.time,
                transactionId: record.transactionId || '',
                transactionHash: record.transactionHash || '',
                status: record.status || 'pending'
            }));
            
            course.blockIndexList = courseDocument.blockIndexList || [];
            course.transactionIDList = courseDocument.transactionIDList || [];
            course.registeredStudents = courseDocument.enrolledStudents || [];

            resolve(course);
        }, 1000);
    });
}

module.exports = { createCourseInstance };