const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: String,
  walletId: String,
  address: String,
  blockIndexList: [Number],
  transactionIDList: [String],
  enrolledCourses: [{
    courseId: String,
    courseName: String
  }],
  signInTable: [{
    courseId: String,
    timestamp: Date
  }]
}, { collection: 'students' });

// 密码比较方法
studentSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('Password not set for this account');
  }
  if (!candidatePassword) {
    throw new Error('No password provided for comparison');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// 保存前加密密码
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 重要：确保正确导出模型
const Student = mongoose.model('Student', studentSchema);
module.exports = Student;