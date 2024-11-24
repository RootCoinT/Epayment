// 在 routes/teacher.js 的开头添加这段调试代码
router.stack.forEach((layer) => {
    if (layer.route) {
        console.log(`Route path: ${layer.route.path}`);
        console.log(`Route stack:`, layer.route.stack);
    }
});

// 学生签到路由
router.post('/sign-in', async (req, res) => {
    try {
        const { courseId } = req.body;
        const studentId = req.session.studentId;

        console.log('Starting sign-in process for:', { studentId, courseId });

        // 使用 findOne 获取课程信息
        let course = await Course.findOne({ courseId });
        const student = await Student.findOne({ studentId });

        if (!course || !student) {
            console.log('Course or student not found:', { course, student });
            return res.status(404).json({ 
                success: false, 
                message: 'Course or student not found' 
            });
        }

        // 修改：使用课程的钱包发送奖励给学生
        const transactionUrl = `http://localhost:3001/operator/wallets/${course.walletId}/transactions`;
        console.log('Sending reward transaction from course to student:', {
            fromWallet: course.walletId,
            toAddress: student.address
        });

        const transactionResponse = await fetch(transactionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'password': 'one two three four five'
            },
            body: JSON.stringify({
                fromAddress: course.address,
                toAddress: student.address,
                amount: 1,
                changeAddress: course.address
            })
        });

        const transactionData = await transactionResponse.json();
        console.log('Transaction response:', transactionData);

        if (!transactionResponse.ok) {
            throw new Error(`Transaction failed: ${JSON.stringify(transactionData)}`);
        }

        // 使用 findOneAndUpdate 直接更新数据库
        const updatedCourse = await Course.findOneAndUpdate(
            { courseId: course.courseId },
            {
                $push: {
                    transactionIDList: transactionData.id,
                    signInTable: {
                        studentId: student.studentId,
                        studentName: student.name,
                        time: new Date(),
                        transactionId: transactionData.id,
                        transactionHash: transactionData.hash,
                        status: 'confirmed'
                    }
                }
            },
            { new: true, runValidators: true }
        );

        console.log('Updated course:', {
            courseId: updatedCourse.courseId,
            transactionIDList: updatedCourse.transactionIDList,
            signInTableLength: updatedCourse.signInTable.length
        });

        // 更新学生记录
        await Student.findOneAndUpdate(
            { studentId },
            {
                $push: {
                    transactionIDList: transactionData.id,
                    signInTable: {
                        courseId: course.courseId,
                        timestamp: new Date(),
                        transactionId: transactionData.id
                    }
                }
            }
        );

        res.json({
            success: true,
            message: 'Sign-in successful and reward sent',
            data: {
                transactionId: transactionData.id,
                timestamp: new Date()
            }
        });

    } catch (error) {
        console.error('Sign-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sign in: ' + error.message
        });
    }
});

// 学生选课
router.post('/enroll', async (req, res) => {
    try {
        const { courseId } = req.body;
        const studentId = req.session.studentId;

        // 查找学生和课程
        const student = await Student.findOne({ studentId });
        const course = await Course.findOne({ courseId });

        if (!student || !course) {
            return res.status(404).json({
                success: false,
                message: 'Student or course not found'
            });
        }

        // 检查学生是否已经注册了这门课
        const alreadyEnrolled = course.enrolledStudents.some(
            enrolledStudent => enrolledStudent.studentId === studentId
        );

        if (alreadyEnrolled) {
            return res.status(400).json({
                success: false,
                message: 'Student already enrolled in this course'
            });
        }

        // 更新课程的已注册学生列表
        await Course.findOneAndUpdate(
            { courseId },
            {
                $push: {
                    enrolledStudents: {
                        studentId: student.studentId,
                        name: student.name,
                        address: student.address,
                        enrollmentDate: new Date()
                    }
                }
            },
            { new: true }
        );

        // 更新学生的选课列表
        if (!student.enrolledCourses.includes(courseId)) {
            student.enrolledCourses.push({
                courseId: courseId,
                courseName: course.courseName
            });
            await student.save();
        }

        res.json({
            success: true,
            message: 'Successfully enrolled in course'
        });
    } catch (error) {
        console.error('Enrollment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enroll in course'
        });
    }
});

// 获取特定课程的考勤记录
router.get('/course-attendance/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.session.userId;

        // 获取该课程信息
        const course = await Course.findOne({ courseId });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // 从课程的 signInTable 中筛选出该学生的记录
        const studentRecords = course.signInTable
            .filter(record => record.studentId === studentId)
            .map(record => ({
                courseId: course.courseId,
                courseName: course.courseName,
                time: record.time,
                status: record.status || 'Present',
                transactionHash: record.transactionHash
            }));

        // 按时间降序排序
        studentRecords.sort((a, b) => new Date(b.time) - new Date(a.time));

        res.json({
            success: true,
            records: studentRecords
        });

    } catch (error) {
        console.error('Error fetching attendance records:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance records'
        });
    }
});