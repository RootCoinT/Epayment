const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    courseId: {
        type: String,
        required: true,
        unique: true
    },
    courseName: {
        type: String,
        required: true
    },
    description: String,
    teacherId: String,
    teacherName: String,
    walletId: String,
    address: String,
    trashbinaAddress: String,
    enrolledStudents: [{
        studentId: String,
        name: String,
        address: String,
        enrollmentDate: {
            type: Date,
            default: Date.now
        }
    }],
    signInTable: [{
        studentId: String,
        studentName: String,
        time: {
            type: Date,
            default: Date.now
        },
        transactionId: {
            type: String,
            required: false
        },
        transactionHash: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed'],
            default: 'pending'
        }
    }],
    blockIndexList: [Number],
    transactionIDList: [String]
});

const Course = mongoose.model('Course', courseSchema);
module.exports = Course;