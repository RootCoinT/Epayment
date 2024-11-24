// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    updateStatistics();
    initializeAttendanceRateChart();
    
    const firstCourseId = document.getElementById('courseSelect')?.value;
    if (firstCourseId) {
        loadStudents(firstCourseId);
    }
});

// 更新统计数据
async function updateStatistics() {
    try {
        const courses = document.querySelectorAll('.course-card');
        let totalStudents = 0;
        
        // 遍历每个课程卡片，获取已注册学生数量
        courses.forEach(course => {
            const enrolledStudents = course.getAttribute('data-enrolled-count');
            if (enrolledStudents) {
                totalStudents += parseInt(enrolledStudents);
            }
        });

        // 更新总学生数显示
        const totalStudentsElement = document.getElementById('totalStudents');
        if (totalStudentsElement) {
            totalStudentsElement.textContent = totalStudents;
        }

    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

async function initializeAttendanceRateChart() {
    try {
        // 获取所有课程卡片
        const courseCards = document.querySelectorAll('.course-card');
        const attendanceData = await Promise.all(Array.from(courseCards).map(async card => {
            const courseId = card.dataset.courseId;
            const courseName = card.querySelector('.course-title h3').textContent.trim();
            const enrolledCount = parseInt(card.dataset.enrolledCount) || 0;
            
            // 从服务器获取该课程的签到记录
            const response = await fetch(`/course/${courseId}/attendance`);
            const data = await response.json();
            
            // 获取不重复的签到学生数量
            const uniqueStudents = new Set();
            if (data.data && data.data.records) {
                data.data.records.forEach(record => {
                    uniqueStudents.add(record.studentId);
                });
            }
            
            // 计算出勤率
            const uniqueAttendees = uniqueStudents.size;
            const rate = enrolledCount > 0 ? (uniqueAttendees / enrolledCount) * 100 : 0;
            
            console.log(`Course: ${courseName}`, {
                enrolledCount,
                uniqueAttendees,
                rate
            });
            
            return {
                courseName,
                rate: Math.round(rate)
            };
        }));

        // 创建折线图
        const ctx = document.getElementById('attendanceRateChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: attendanceData.map(item => item.courseName),
                datasets: [{
                    label: 'Attendance Rate (%)',
                    data: attendanceData.map(item => item.rate),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Attendance Rate: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing attendance rate chart:', error);
    }
}
// 确保在页面加载完成后调用
document.addEventListener('DOMContentLoaded', () => {
    updateStatistics();
    initializeAttendanceRateChart();
});

// 创建课程
async function createCourse(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/teacher/create-course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                courseName: formData.get('courseName'),
                description: formData.get('description')
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Course created successfully!');
            location.reload();
        } else {
            alert(data.message || 'Failed to create course');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create course');
    }
}

// 模态框控制
function showCreateCourseModal() {
    const modalHtml = `
        <div id="createCourseModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-plus-circle"></i> Create New Course</h2>
                    <span class="close" onclick="closeModal('createCourseModal')">&times;</span>
                </div>
                <form onsubmit="createCourse(event)">
                    <div class="form-group">
                        <label for="courseName">Course Name:</label>
                        <input type="text" id="courseName" name="courseName" required>
                    </div>
                    <div class="form-group">
                        <label for="description">Description:</label>
                        <textarea id="description" name="description" required></textarea>
                    </div>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-plus"></i> Create Course
                    </button>
                </form>
            </div>
        </div>
    `;

    // 移除已存在的模态框
    const existingModal = document.getElementById('createCourseModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 关闭模态框
document.querySelector('.close').onclick = function() {
    document.getElementById('createCourseModal').style.display = 'none';
}

// 加载学生列表
async function loadStudents(courseId) {
    try {
        const response = await fetch(`/teacher/course-students/${courseId}`);
        const data = await response.json();
        const studentSelect = document.getElementById('studentSelect');
        studentSelect.innerHTML = `
            <option value="">Select Student</option>
            ${data.students.map(student => 
                `<option value="${student.address}">${student.name} (${student.studentId})</option>`
            ).join('')}
        `;
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

// 修改搜索学生考勤记录的函数
async function searchStudentAttendance() {
    try {
        const studentId = document.getElementById('studentIdSearch').value.trim();
        const selectedDate = document.getElementById('attendanceDate').value;

        if (!studentId) {
            alert('Please enter a student ID');
            return;
        }

        const response = await fetch(`/teacher/attendance/${studentId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        // 过滤记录
        let filteredRecords = data.records;
        if (selectedDate) {
            filteredRecords = data.records.filter(record => {
                const recordDate = new Date(record.time).toISOString().split('T')[0];
                return recordDate === selectedDate;
            });
        }

        // 创建模态框HTML
        const modalHtml = `
            <div id="attendanceModal" class="modal">
                <div class="modal-content attendance-modal">
                    <div class="modal-header">
                        <h2><i class="fas fa-history"></i> Student Attendance Records</h2>
                        <span class="close" onclick="closeModal('attendanceModal')">&times;</span>
                    </div>
                    <div class="attendance-details">
                        <div class="table-container">
                            <table class="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Student ID</th>
                                        <th>Course</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Transaction Hash</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredRecords.map(record => `
                                        <tr>
                                            <td>${record.studentId}</td>
                                            <td>${record.courseName || 'N/A'}</td>
                                            <td>${new Date(record.time).toLocaleString()}</td>
                                            <td>
                                                <span class="status-badge ${record.status.toLowerCase()}">
                                                    ${record.status}
                                                </span>
                                            </td>
                                            <td class="hash-column">
                                                <span class="transaction-hash" title="${record.transactionHash}">
                                                    ${record.transactionHash ? record.transactionHash.substring(0, 10) + '...' : 'N/A'}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('attendanceModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模态框
        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (error) {
        console.error('Error searching attendance:', error);
        alert('Error searching attendance records: ' + error.message);
    }
}

// 添加全局考勤记录的日期筛选功能
function filterGlobalAttendanceByDate() {
    const dateInput = document.getElementById('globalAttendanceDate');
    const selectedDate = dateInput.value;
    const tbody = document.getElementById('globalAttendanceTableBody');
    const rows = tbody.getElementsByTagName('tr');

    Array.from(rows).forEach(row => {
        const rowDate = row.getAttribute('data-date');
        if (!selectedDate || rowDate === selectedDate) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// 添加重置全局考勤记录筛选的功能
function resetGlobalAttendanceFilter() {
    const dateInput = document.getElementById('globalAttendanceDate');
    dateInput.value = '';
    const tbody = document.getElementById('globalAttendanceTableBody');
    const rows = tbody.getElementsByTagName('tr');
    
    Array.from(rows).forEach(row => {
        row.style.display = '';
    });
}

// 查看交易详情
async function viewTransactionDetails(transactionId) {
    try {
        const response = await fetch(`/teacher/transaction/${transactionId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch transaction details');
        }

        const data = await response.json();
        
        const modalHtml = `
            <div id="transactionModal" class="modal">
                <div class="modal-content">
                    <span class="close" onclick="closeModal('transactionModal')">&times;</span>
                    <h2>Transaction Details</h2>
                    <div class="transaction-details">
                        <p><strong>Transaction ID:</strong> ${data.transaction.id}</p>
                        <p><strong>Block Index:</strong> ${data.transaction.blockIndex}</p>
                        <p><strong>Time:</strong> ${new Date(data.transaction.timestamp).toLocaleString()}</p>
                        <p><strong>Hash:</strong> ${data.transaction.hash}</p>
                        <p><strong>Type:</strong> ${data.transaction.type}</p>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('transactionModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新模态框
        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (error) {
        console.error('Error viewing transaction:', error);
        alert('Error viewing transaction details: ' + error.message);
    }
}

// 关闭模态框
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

// 初始化搜索框
function initializeSearchBox() {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) {
        searchContainer.innerHTML = `
            <div class="search-box">
                <input 
                    type="text" 
                    id="studentIdSearch" 
                    placeholder="Enter Student ID to search attendance" 
                    aria-label="Student ID"
                >
                <button onclick="searchStudentAttendance()" class="btn-primary">
                    <i class="fas fa-search"></i> Search
                </button>
            </div>
            <div id="attendanceRecords" class="attendance-records"></div>
        `;
    }
}

// 在页面加载时初始化搜索框
document.addEventListener('DOMContentLoaded', () => {
    initializeSearchBox();
});

// 修改课程考勤检查功能（移除日期筛选）
async function checkAttendance(courseId) {
    try {
        const response = await fetch(`/teacher/course/${courseId}/attendance`);
        if (!response.ok) {
            throw new Error('Failed to fetch attendance');
        }

        const data = await response.json();
        
        const modalHtml = `
            <div id="attendanceModal" class="modal">
                <div class="modal-content attendance-modal">
                    <div class="modal-header">
                        <h2><i class="fas fa-clipboard-list"></i> Course Attendance Records</h2>
                        <span class="close" onclick="closeModal('attendanceModal')">&times;</span>
                    </div>
                    <div class="attendance-details">
                        <div class="table-container">
                            <table class="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Student ID</th>
                                        <th>Student Name</th>
                                        <th>Time</th>
                                        <th>Status</th>
                                        <th>Transaction Hash</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${renderAttendanceRecords(data.records)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('attendanceModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (error) {
        console.error('Error checking attendance:', error);
        alert('Error checking attendance: ' + error.message);
    }
}

// 添加渲染考勤记录的辅助函数
function renderAttendanceRecords(records) {
    if (!records || records.length === 0) {
        return '<tr><td colspan="5">No attendance records found</td></tr>';
    }

    return records.map(record => `
        <tr data-date="${new Date(record.time).toISOString().split('T')[0]}">
            <td>${record.studentId}</td>
            <td>${record.studentName}</td>
            <td>${new Date(record.time).toLocaleString()}</td>
            <td>
                <span class="status-badge ${record.status}">
                    ${record.status || 'Present'}
                </span>
            </td>
            <td class="hash-column">
                <span class="transaction-hash">
                    ${record.transactionHash || 'N/A'}
                </span>
            </td>
        </tr>
    `).join('');
}

