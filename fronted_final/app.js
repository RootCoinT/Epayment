const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const path = require('path');
const CourseClass = require('./CourseClass');

const app = express();

// 基础中间件设置
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MongoDB 连接
mongoose.connect('mongodb://127.0.0.1:27017/student_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// 确保在MongoDB连接后再导入模型和路由
const Student = require('./models/Student');
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const Teacher = require('./models/Teacher');
const Course = require('./models/Course');

// Session 配置
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: 'mongodb://127.0.0.1:27017/student_system'
  })
}));

// 添加调试中间件
app.use((req, res, next) => {
  console.log('Session:', req.session);
  next();
});

// 中间件：检查是否已登录
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  req.session.studentId = req.session.userId;
  next();
};

const requireTeacherLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  if (req.session.role !== 'teacher') {
    return res.status(403).send('Unauthorized');
  }
  next();
};

// 根路由 - 显示主页面
app.get('/', (req, res) => {
    if (req.session.userId) {
        // 如果已登录，根据角色重定向
        if (req.session.role === 'student') {
            res.redirect(`/student/${req.session.userId}`);
        } else {
            res.redirect(`/teacher/${req.session.userId}`);
        }
    } else {
        // 如果未登录，显示主页面
        res.render('index');
    }
});

// 登录路由 - 如果直接访问/auth/login，重定向到主页
app.get('/auth/login', (req, res) => {
    if (!req.query.role) {
        res.redirect('/');
    } else {
        res.render('auth/login', { 
            role: req.query.role, 
            error: null 
        });
    }
});

// 认证路由
app.use('/auth', authRoutes);

// 学生dashboard路由
app.get('/student/:studentId', requireLogin, async (req, res) => {
    try {
        const { studentId } = req.params;
        
        if (studentId !== req.session.userId) {
            return res.status(403).send('Unauthorized');
        }

        const student = await Student.findOne({ studentId });
        if (!student) {
            return res.status(404).send('Student not found');
        }

        // 获取所有课程
        const allCourses = await Course.find({});
        console.log('All courses:', allCourses); // 调试日志
        
        // 区分已选和未选课程
        const enrolledCourses = allCourses.filter(course => 
            course.enrolledStudents.some(s => s.studentId === studentId)
        );
        
        const availableCourses = allCourses.filter(course => 
            !course.enrolledStudents.some(s => s.studentId === studentId)
        );

        console.log('Enrolled courses:', enrolledCourses); // 调试日志
        console.log('Available courses:', availableCourses); // 调试日志

        res.render('student-dashboard', { 
            student,
            enrolledCourses,
            availableCourses
        });
    } catch (error) {
        console.error('Error loading student dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// 添加选课路由
app.post('/student/enroll-course', requireLogin, async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
        
        // 验证学生身份
        if (studentId !== req.session.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const student = await Student.findOne({ studentId });
        const course = await Course.findOne({ courseId });

        if (!student || !course) {
            return res.status(404).json({ success: false, message: 'Student or course not found' });
        }

        // 检查是否已经选过这门课
        if (course.enrolledStudents.some(s => s.studentId === studentId)) {
            return res.status(400).json({ success: false, message: 'Already enrolled in this course' });
        }

        // 添加学生到课程
        course.enrolledStudents.push({
            studentId: student.studentId,
            name: student.name
        });
        await course.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error enrolling in course:', error);
        res.status(500).json({ success: false, message: 'Error enrolling in course' });
    }
});

// 教师路由
app.use('/teacher', teacherRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const { sendPostRequest, buildUrl, sendGetRequest } = require('./sendRequest');

// 获取学生出勤记录
app.get('/student/attendance/:courseId/:studentId', requireLogin, async (req, res) => {
    try {
        const { courseId, studentId } = req.params;
        
        // 验证学生身份
        if (studentId !== req.session.userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        // 获取课程信息
        const course = await Course.findOne({ courseId });
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found' 
            });
        }

        // 获取学信息
        const student = await Student.findOne({ studentId });
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                message: 'Student not found' 
            });
        }

        // 构建 API URL 获取交易列表
        const url = buildUrl(
            "localhost", 
            "3001", 
            "operator", 
            "wallets", 
            course.walletId,
            "transactions"
        );

        // 获取交易列表
        const transactions = await sendGetRequest(url);
        console.log('Transactions:', transactions);

        // 过滤出与该学生相关的交易（签到记录）
        const attendanceRecords = transactions
            .filter(tx => tx.recipient === student.address)
            .map(tx => ({
                txId: tx.id,
                timestamp: tx.timestamp,
                amount: tx.amount
            }));

        res.json({
            success: true,
            attendanceRecords
        });
    } catch (error) {
        console.error('Error fetching attendance records:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching attendance records' 
        });
    }
});

const { createCourseInstance } = require('./utils/courseUtils');
const StudentClass = require('./student');

// 处理学生签到
app.post('/student/sign-in', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'student') {
        return res.status(403).json({
            success: false,
            message: 'Please login first'
        });
    }
    
    try {
        const { courseId } = req.body;
        const studentId = req.session.userId;
        
        console.log('Sign-in attempt:', { courseId, studentId });

        // 获取课程和学生信息
        const course = await Course.findOne({ courseId });
        const student = await Student.findOne({ studentId });

        if (!course || !student) {
            return res.status(404).json({
                success: false,
                message: 'Course or student not found'
            });
        }

        // 创建签到交易
        const courseInstance = new CourseClass(
            course.courseId,
            course.courseName,
            course.walletId,
            course.address
        );

        // 执行签到交易
        const signInResult = await courseInstance.sendSigninTransaction(student.address);

        // 记录签到信息
        const signInRecord = {
            studentId: student.studentId,
            studentName: student.name,
            time: new Date(),
            transactionId: signInResult.transactionId,
            transactionHash: signInResult.hash,
            status: 'confirmed'
        };

        // 更新数据库
        await Course.findOneAndUpdate(
            { courseId },
            { 
                $push: {
                    signInTable: signInRecord,
                    transactionIDList: signInResult.transactionId
                }
            }
        );

        console.log('Sign-in successful:', signInRecord);

        res.json({
            success: true,
            message: 'Successfully signed in',
            data: signInRecord
        });

    } catch (error) {
        console.error('Sign-in error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to sign in'
        });
    }
});

// 处理挖矿请求
app.post('/student/mine', requireLogin, async (req, res) => {
    try {
        const { rewardAddress } = req.body;
        
        if (!rewardAddress) {
            return res.status(400).json({
                success: false,
                message: 'Reward address is required'
            });
        }

        // 构建挖矿请求URL
        const miningUrl = buildUrl("localhost", "3001", "miner", "mine");
        
        // 发送挖矿请求
        const miningResponse = await sendPostRequest(miningUrl, null, {
            rewardAddress: rewardAddress
        });

        console.log('Mining response:', miningResponse);

        // 更新学生的区块索引列表
        await Student.findOneAndUpdate(
            { studentId: req.session.userId },
            { $push: { blockIndexList: miningResponse.index } }
        );

        res.json({
            success: true,
            blockIndex: miningResponse.index,
            message: 'Mining successful'
        });

    } catch (error) {
        console.error('Mining error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during mining process'
        });
    }
});

// 获取余额的路由
app.get('/student/balance', async (req, res) => {
    try {
        const studentId = req.session.studentId;
        const student = await Student.findOne({ studentId });
        
        if (!student || !student.address) {
            return res.status(404).json({
                success: false,
                message: 'Student or wallet address not found'
            });
        }

        // 从区块链获取余额
        const balanceUrl = buildUrl("localhost", "3001", "operator", student.address, "balance");
        const balanceResponse = await sendGetRequest(balanceUrl);

        // 确保返回的是正确的余额值
        const balance = balanceResponse.balance || 0;  // 新账户应该是0
        
        console.log('Balance response:', {
            studentId,
            address: student.address,
            balance: balance
        });

        res.json({
            success: true,
            balance: balance
        });

    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch balance'
        });
    }
});

// 处理奖励兑换
app.post('/student/exchange-reward', requireLogin, async (req, res) => {
    try {
        const { rewardId, cost } = req.body;
        const student = await Student.findOne({ studentId: req.session.userId });

        if (!student || !student.address) {
            return res.status(400).json({
                success: false,
                message: 'Student wallet not found'
            });
        }

        // 获取当前余额
        const balanceUrl = buildUrl(
            "localhost", 
            "3001", 
            "operator",
            student.address,
            "balance"
        );

        const balanceResponse = await fetch(balanceUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const balanceData = await balanceResponse.json();

        // 检查余额是否足够
        if (balanceData.balance < cost) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // TODO: 处理实际的转账逻辑
        // 这里需要实现从学生钱包转账到系统钱包的逻辑

        res.json({
            success: true,
            message: 'Exchange successful'
        });

    } catch (error) {
        console.error('Reward exchange error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing exchange'
        });
    }
});

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 添加获取余额的代理路由
app.get('/student/get-balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const response = await fetch(`http://localhost:3001/operator/${address}/balance`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

// 获取课程签到记录
app.get('/course/:courseId/attendance', async (req, res) => {
    try {
        const { courseId } = req.params;
        console.log('Fetching attendance records for course:', courseId); // 添加日志

        const course = await Course.findOne({ courseId });
        console.log('Found course:', course); // 添加日志
        console.log('Sign-in table:', course?.signInTable); // 添加日志

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        res.json({
            success: true,
            data: {
                courseId,
                courseName: course.courseName,
                records: course.signInTable
            }
        });

    } catch (error) {
        console.error('Error fetching attendance records:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance records'
        });
    }
});