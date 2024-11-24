const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teacherSchema = new mongoose.Schema({
    teacherId: {
        type: String,
        required: [true, 'Teacher ID is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [3, 'Password must be at least 3 characters long']
    },
    courses: [{
        courseId: String,
        courseName: String,
        description: String,
        students: [{
            studentId: String,
            name: String,
            attendance: [{
                date: Date,
                present: Boolean
            }]
        }]
    }]
}, { 
    collection: 'teachers',
    timestamps: true // 添加创建和更新时间戳
});

// 密码加密
teacherSchema.pre('save', async function(next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        next();
    } catch (error) {
        next(error);
    }
});

// 密码验证
teacherSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

const Teacher = mongoose.model('Teacher', teacherSchema);
module.exports = Teacher;