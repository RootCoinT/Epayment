const express = require('express');
const router = express.Router();
const StudentModel = require('../models/Student');
const Teacher = require('../models/Teacher');
const StudentClass = require('../student.js');

// 登录页面
router.get('/login', (req, res) => {
    const role = req.query.role || 'student';
    res.render('auth/login', { 
        role: role,
        error: null 
    });
});

// 注册页面
router.get('/register', (req, res) => {
    const role = req.query.role || 'student';
    res.render('auth/register', { 
        role: role,
        error: null 
    });
});

// 处理注册
router.post('/register', async (req, res) => {
    try {
        const { name, userId, password, role } = req.body;
        console.log('Received registration request:', { name, userId, role });
        
        if (role === 'student') {
            // 检查学生ID是否已存在
            const existingStudent = await StudentModel.findOne({ studentId: userId });
            if (existingStudent) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID already exists'
                });
            }

            // 创建学生实例，传入密码
            const studentInstance = new StudentClass(userId, name, password);
            
            // 等待钱包完全初始化
            const address = await studentInstance.initializeWallet();
            
            console.log('Student registration details:', {
                studentId: userId,
                name: name,
                walletId: studentInstance.walletID,
                address: address
            });

            // 验证钱包地址是否成功生成
            if (!studentInstance.walletID || !address) {
                throw new Error('Failed to initialize wallet');
            }

            // 创建数据库文档
            const studentDoc = new StudentModel({
                studentId: userId,
                name,
                password,  // 这个密码会被 mongoose 中间件加密
                address: address,
                walletId: studentInstance.walletID,
                walletPassword: password  // 可以选择保存钱包密码（建议加密）
            });

            await studentDoc.save();

            res.json({
                success: true,
                message: 'Registration successful',
                data: {
                    studentId: userId,
                    name,
                    address: address
                }
            });
        } else if (role === 'teacher') {
            console.log('Processing teacher registration');
            
            // 检查教师ID是否已存在
            const existingTeacher = await Teacher.findOne({ teacherId: userId });
            if (existingTeacher) {
                console.log('Teacher ID already exists:', userId);
                return res.status(400).json({
                    success: false,
                    message: 'Teacher ID already exists'
                });
            }

            try {
                // 创建新教师文档
                const teacherDoc = new Teacher({
                    teacherId: userId,
                    name: name,
                    password: password,
                    courses: []
                });

                console.log('Saving teacher document...');
                await teacherDoc.save();
                console.log('Teacher document saved successfully');

                res.json({
                    success: true,
                    message: 'Teacher registration successful',
                    data: {
                        teacherId: userId,
                        name: name
                    }
                });
            } catch (saveError) {
                console.error('Error saving teacher:', saveError);
                throw saveError;
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid role specified'
            });
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed: ' + error.message
        });
    }
});

// 学生登录路由
router.post('/student/login', async (req, res) => {
    try {
        const { studentId, password } = req.body;
        
        // 检查是否提供了所有必需的字段
        if (!studentId || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both student ID and password'
            });
        }

        // 查找学生
        const student = await StudentModel.findOne({ studentId });
        
        if (!student) {
            return res.status(401).json({
                success: false,
                message: 'Student not found'
            });
        }

        // 检查密码是否存在
        if (!student.password) {
            console.error('Student password is undefined:', student);
            return res.status(500).json({
                success: false,
                message: 'Account not properly initialized'
            });
        }

        // 比较密码
        try {
            const isMatch = await student.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }
        } catch (error) {
            console.error('Password comparison error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error verifying password'
            });
        }

        // 设置session
        req.session.userId = student.studentId;
        req.session.role = 'student';
        req.session.studentId = student.studentId;

        res.json({
            success: true,
            message: 'Login successful',
            student: {
                studentId: student.studentId,
                name: student.name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login process'
        });
    }
});

// 教师登录路由
router.post('/teacher/login', async (req, res) => {
    try {
        const { teacherId, password } = req.body;

        // 检查是否提供了所有必需的字段
        if (!teacherId || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both teacher ID and password'
            });
        }

        // 查找教师
        const teacher = await Teacher.findOne({ teacherId });
        if (!teacher) {
            return res.status(401).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        // 验证密码
        const isValidPassword = await teacher.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

        // 设置session
        req.session.userId = teacher.teacherId;
        req.session.role = 'teacher';
        req.session.teacherId = teacher.teacherId;

        res.json({
            success: true,
            message: 'Login successful',
            teacher: {
                teacherId: teacher.teacherId,
                name: teacher.name
            }
        });

    } catch (error) {
        console.error('Teacher login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login process'
        });
    }
});

// 登出路由
router.get('/logout', (req, res) => {
    // 清除会话
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Error logging out');
        }
        // 重定向到登录页面
        res.redirect('/auth/login');
    });
});

// 在登录成功后的路由处理中
router.get('/student/:studentId', async (req, res) => {
    try {
        const student = await StudentModel.findOne({ studentId: req.params.studentId });
        if (!student) {
            return res.status(404).send('Student not found');
        }

        console.log('Student data:', student); // 调试信息，查看是否包含地址

        res.render('student-dashboard', {
            student: {
                studentId: student.studentId,
                name: student.name,
                address: student.address, // 确保这个字段被传递到视图
                enrolledCourses: student.enrolledCourses
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;