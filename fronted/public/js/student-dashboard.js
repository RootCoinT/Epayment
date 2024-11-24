async function submitSignIn(courseId) {
    try {
        // 添加日志
        console.log('Attempting to sign in for course:', courseId);

        const response = await fetch('/student/sign-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                courseId: courseId
            })
        });

        // 添加响应日志
        console.log('Sign-in response status:', response.status);
        const data = await response.text();
        console.log('Sign-in response data:', data);

        if (!response.ok) {
            throw new Error(`Sign-in failed: ${data}`);
        }

        const jsonData = JSON.parse(data);
        
        if (jsonData.success) {
            alert('Successfully signed in!');
            // 可选：更新UI显示
            updateAttendanceDisplay();
        } else {
            throw new Error(jsonData.message || 'Sign-in failed');
        }

    } catch (error) {
        console.error('Sign in error:', error);
        alert(`Failed to sign in: ${error.message}`);
    }
}

async function viewAttendance(courseId) {
    try {
        const response = await fetch(`/student/course-attendance/${courseId}`);
        const data = await response.json();

        if (data.success) {
            // 创建模态框显示考勤记录
            const modalHtml = `
                <div id="attendanceModal" class="modal">
                    <div class="modal-content attendance-modal">
                        <div class="modal-header">
                            <h2><i class="fas fa-clock"></i> Course Attendance Records</h2>
                            <span class="close">&times;</span>
                        </div>
                        <div class="attendance-table-container">
                            <table class="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Transaction Hash</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.records.length > 0 ? 
                                        data.records.map(record => `
                                            <tr>
                                                <td>${new Date(record.time).toLocaleString()}</td>
                                                <td>
                                                    <span class="status-badge ${record.status}">
                                                        ${record.status || 'Present'}
                                                    </span>
                                                </td>
                                                <td class="hash-column">
                                                    <span class="transaction-hash" title="${record.transactionHash}">
                                                        ${record.transactionHash ? record.transactionHash.substring(0, 10) + '...' : 'N/A'}
                                                    </span>
                                                </td>
                                            </tr>
                                        `).join('') 
                                        : '<tr><td colspan="3">No attendance records found</td></tr>'
                                    }
                                </tbody>
                            </table>
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

            // 添加关闭按钮事件监听
            const modal = document.getElementById('attendanceModal');
            const closeBtn = modal.querySelector('.close');
            closeBtn.onclick = () => modal.remove();

        } else {
            alert(data.message || 'Failed to load attendance records');
        }
    } catch (error) {
        console.error('Error viewing attendance:', error);
        alert('Error loading attendance records');
    }
}

function openSignInModal(courseId) {
    const modal = document.getElementById('signInModal');
    const courseIdInput = document.getElementById('courseIdInput');
    courseIdInput.value = courseId;
    modal.style.display = 'block';
}