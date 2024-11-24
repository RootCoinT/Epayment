// 清除数据的脚本
async function resetCourseData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/studentCourse');
        
        // 清除所有签到记录
        await Course.updateMany({}, {
            $set: {
                signInTable: [],
                transactionIDList: []
            }
        });

        console.log('Course data reset complete');
    } catch (error) {
        console.error('Reset error:', error);
    } finally {
        await mongoose.connection.close();
    }
}