const { buildUrl, sendPostRequest } = require("./sendRequest");
let affairID = 0;
class Student {
  constructor(studentId, name, password) {
    this.studentId = studentId;
    this.name = name;
    this.password = password;
    this.enrolledCourses = [];
    this.blockIndexList = [];
    this.transactionIDList = [];
    this.signInTable = [];
    this.walletID = '';
    this.address = '';
    
    // 立即初始化钱包
    this.initializeWallet();
  }

  async initializeWallet() {
    try {
      // 先生成钱包ID
      const walletId = await this.generateWalletID();
      this.walletID = walletId;
      console.log("Generated wallet ID:", this.walletID); // 调试日志
      
      // 然后生成地址
      const address = await this.generateWalletAddress();
      this.address = address;
      console.log("Generated address:", this.address); // 调试日志
      
      return this.address;
    } catch (error) {
      console.error('Error initializing wallet:', error);
    }
  }

  // 学生签到函数
  signIn(course) {
    if (!this.enrolledCourses.includes(course.courseId)) {
      return 'Student not enrolled in this course';
    }
    let time = new Date();
    let signature = 0;
    if(course.signInStudent(this, time, affairID++, signature)){
      this.signInTable.push({
        courseName: course.name,
        courseId: course.id,
        time: time
      });
      return `${this.name} signed in for ${course.courseName}`;
    }
    return 'fail to sign in';
  }

  // 返回学生信息
  getStudentInfo() {
    return {
      studentId: this.studentId,
      name: this.name,
      enrolledCourses: this.enrolledCourses,
      blockHashList: this.blockHashList,
      walletID: this.walletID
    };
  }

  // 使用 POST 请求生成钱包ID
  async generateWalletID() {
    try {
        let url = buildUrl("localhost", "3001", "operator", "wallets");
        console.log('Generating wallet with URL:', url);
        
        const requestBody = {
            password: this.password
        };
        
        const response = await sendPostRequest(url, {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }, requestBody);

        if (!response || !response.id) {
            throw new Error('Failed to generate wallet ID');
        }

        console.log('Wallet generation response:', response);
        return response.id;
    } catch (error) {
        console.error('Error generating wallet ID:', error);
        throw error;
    }
  }

  async generateWalletAddress() {
    try {
        if (!this.walletID) {
            throw new Error('Wallet ID not initialized');
        }

        const addressUrl = buildUrl("localhost", "3001", "operator", "wallets", this.walletID, "addresses");
        console.log('Generating address with URL:', addressUrl);

        const response = await sendPostRequest(addressUrl, {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'password': this.password
        });

        if (!response || !response.address) {
            throw new Error('Failed to generate wallet address');
        }

        console.log('Address generation response:', response);
        return response.address;
    } catch (error) {
        console.error('Error generating wallet address:', error);
        throw error;
    }
  }

}

module.exports = Student;
