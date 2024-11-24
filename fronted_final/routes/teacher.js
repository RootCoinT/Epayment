const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const CourseClass = require('../CourseClass');
const fetch = require('node-fetch');
const Student = require('../models/Student');

// 中间件：检查教师登录
const requireTeacherLogin = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'teacher') {
        return res.status(403).json({
            success: false,
            message: 'Teacher login required'
        });
    }
    next();
};

// 教师仪表板
router.get('/:teacherId', requireTeacherLogin, async (req, res) => {
    try {
        const { teacherId } = req.params;
        
        if (teacherId !== req.session.userId) {
            return res.status(403).send('Unauthorized');
        }

        const teacher = await Teacher.findOne({ teacherId });
        if (!teacher) {
            return res.status(404).send('Teacher not found');
        }

        // 获取该教师创建的所有课程
        const courses = await Course.find({ teacherId }) || [];
        console.log('Found courses:', courses); // 调试日志

        res.render('teacher-dashboard', { 
            teacher,
            courses: courses // 确保传递 courses 参数
        });
    } catch (error) {
        console.error('Error loading teacher dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// 创建新课程
router.post('/create-course', requireTeacherLogin, async (req, res) => {
    try {
        const { courseName, description } = req.body;
        const teacherId = req.session.userId;

        // 获取教师信息
        const teacher = await Teacher.findOne({ teacherId });
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }

        // 生成课程ID
        const courseId = 'COURSE' + Date.now();
        const FIXED_WALLET_PASSWORD = "one two three four five";

        // 1. 创建钱包ID
        const createWalletResponse = await fetch('http://localhost:3001/operator/wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                password: FIXED_WALLET_PASSWORD
            })
        });

        if (!createWalletResponse.ok) {
            throw new Error('Failed to create wallet ID');
        }

        const walletData = await createWalletResponse.json();
        const walletId = walletData.id;

        // 2. 创建钱包地址
        const createAddressResponse = await fetch(`http://localhost:3001/operator/wallets/${walletId}/addresses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'password': FIXED_WALLET_PASSWORD
            }
        });

        if (!createAddressResponse.ok) {
            throw new Error('Failed to create wallet address');
        }

        const addressData = await createAddressResponse.json();
        const address = addressData.address;

        // 3. 给新创建的课程钱包挖矿
        const mineResponse = await fetch('http://localhost:3001/miner/mine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rewardAddress: address
            })
        });

        if (!mineResponse.ok) {
            console.warn('Mining operation failed, but continuing with course creation');
        }

        // 4. 创建课程文档
        const newCourse = new Course({
            courseId,
            courseName,
            description,
            teacherId,
            teacherName: teacher.name,
            walletId,
            address,
            enrolledStudents: [],
            signInTable: [],
            blockIndexList: [],
            transactionIDList: []
        });

        // 保存课程
        await newCourse.save();
        
        res.json({
            success: true,
            message: 'Course created successfully',
            course: {
                courseId,
                courseName,
                description,
                teacherId,
                teacherName: teacher.name,
                walletId,
                address
            }
        });

    } catch (error) {
        console.error('Course creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create course'
        });
    }
});

// 获取课程考勤记录
router.get('/course/:courseId/attendance', requireTeacherLogin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const teacherId = req.session.userId;

        // 查找课程
        const course = await Course.findOne({ courseId, teacherId });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // 返回课程的考勤记录
        res.json({
            success: true,
            records: course.signInTable
        });

    } catch (error) {
        console.error('Error fetching course attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance records'
        });
    }
});

// 获取教师统计数据
router.get('/statistics', requireTeacherLogin, async (req, res) => {
    try {
        const teacherId = req.session.userId;
        console.log('Getting statistics for teacher:', teacherId);

        // 获取该教师的所有课程
        const courses = await Course.find({ teacherId });
        console.log('Found courses:', courses.length);

        // 计算所有注册学生的数量（去重）
        const uniqueStudents = new Set();
        courses.forEach(course => {
            course.enrolledStudents.forEach(student => {
                uniqueStudents.add(student.studentId);
            });
        });

        // 计算今日签到数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let todayAttendance = 0;

        for (const course of courses) {
            const todayRecords = course.signInTable.filter(record => {
                const recordDate = new Date(record.time);
                recordDate.setHours(0, 0, 0, 0);
                return recordDate.getTime() === today.getTime();
            });
            todayAttendance += todayRecords.length;
        }

        console.log('Statistics:', {
            totalStudents: uniqueStudents.size,
            todayAttendance,
            totalCourses: courses.length
        });

        res.json({
            success: true,
            data: {
                totalStudents: uniqueStudents.size,
                todayAttendance,
                totalCourses: courses.length
            }
        });

    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取交易详情
router.get('/transaction/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        console.log('Fetching transaction:', transactionId);
        
        // 直接使用交易ID查询
        const response = await fetch(`http://localhost:3001/blockchain/blocks/transactions/${transactionId}`);
        const blockData = await response.json();
        
        // 在区块中找到对应的交易
        const transaction = blockData.transactions.find(tx => tx.id === transactionId);
        
        if (!transaction) {
            throw new Error('Transaction not found');
        }

        res.json({
            success: true,
            transaction: {
                id: transaction.id,
                hash: transaction.hash,
                type: transaction.type,
                timestamp: blockData.timestamp,
                blockIndex: blockData.index,
                inputs: transaction.data.inputs,
                outputs: transaction.data.outputs
            }
        });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction details'
        });
    }
});

// 获取学生信息
router.get('/student/:studentId', requireTeacherLogin, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.params.studentId });
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.json({
            success: true,
            student: {
                studentId: student.studentId,
                name: student.name,
                address: student.address
            }
        });
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching student information'
        });
    }
});

// 搜索学生考勤记录
router.get('/attendance/:studentId', requireTeacherLogin, async (req, res) => {
    try {
        const { studentId } = req.params;
        const teacherId = req.session.userId;
        
        // 获取该教师的所有课程
        const courses = await Course.find({ teacherId });
        const attendanceRecords = [];

        // 遍历所有课程，查找该学生的考勤记录
        for (const course of courses) {
            const studentRecords = course.signInTable.filter(record => 
                record.studentId === studentId
            );

            // 将找到的记录添加到结果中，并包含课程信息
            studentRecords.forEach(record => {
                attendanceRecords.push({
                    courseId: course.courseId,
                    courseName: course.courseName,
                    studentId: record.studentId,
                    studentName: record.studentName,
                    time: record.time,
                    status: record.status || 'Present',
                    transactionHash: record.transactionHash
                });
            });
        }

        res.json({
            success: true,
            records: attendanceRecords
        });

    } catch (error) {
        console.error('Error fetching student attendance records:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance records'
        });
    }
});

// 获取所有课程的出勤率
router.get('/attendance-rates', requireTeacherLogin, async (req, res) => {
    try {
        const teacherId = req.session.userId;
        const courses = await Course.find({ teacherId });
        
        const attendanceRates = courses.map(course => {
            // 获取已注册学生数量
            const totalStudents = course.enrolledStudents.length;
            
            if (totalStudents === 0) {
                return {
                    courseId: course.courseId,
                    courseName: course.courseName,
                    rate: 0
                };
            }

            // 获取不重复的已签到学生ID
            const uniqueAttendees = new Set(
                course.signInTable.map(record => record.studentId)
            );

            // 计算出勤率
            const rate = (uniqueAttendees.size / totalStudents) * 100;

            return {
                courseId: course.courseId,
                courseName: course.courseName,
                rate: Math.round(rate) // 四舍五入到整数
            };
        });

        res.json({
            success: true,
            rates: attendanceRates
        });
    } catch (error) {
        console.error('Error fetching attendance rates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance rates'
        });
    }
});

module.exports = router;