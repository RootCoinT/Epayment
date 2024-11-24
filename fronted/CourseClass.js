const { response } = require("express");
const { buildUrl, sendPostRequest, sendGetRequest } = require("./sendRequest");

class CourseClass {
  constructor(courseId, courseName, existingWalletId = null, existingAddress = null) {
    this.courseId = courseId;
    this.courseName = courseName;
    this.signInTable = [];
    this.registeredStudents = [];
    this.blockIndexList = [];
    this.transactionIDList = [];
    
    // 如果传入了现有的钱包信息，直接使用
    if (existingWalletId && existingAddress) {
      this.walletId = existingWalletId;
      this.address = existingAddress;
    } else {
      // 否则创建新钱包
      this.initializeWallet();
    }
  }

  // 初始化钱包
  async initializeWallet() {
    try {
      // 创建钱包
      const walletResponse = await fetch('http://localhost:3001/operator/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          password: 'one two three four five'  // 使用固定密码
        })
      });

      if (!walletResponse.ok) {
        throw new Error(`Failed to create wallet: ${walletResponse.status}`);
      }

      const walletData = await walletResponse.json();
      this.walletId = walletData.id;

      // 创建地址
      const addressResponse = await fetch(`http://localhost:3001/operator/wallets/${this.walletId}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'password': 'one two three four five'
        }
      });

      if (!addressResponse.ok) {
        throw new Error(`Failed to create address: ${addressResponse.status}`);
      }

      const addressData = await addressResponse.json();
      this.address = addressData.address;

      // 添加挖矿步骤
      const mineUrl = buildUrl("localhost", "3001", "miner", "mine");
      const mineBody = {
        rewardAddress: this.address
      };
      await sendPostRequest(mineUrl, null, mineBody);

      return this.address;
    } catch (error) {
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  // 修改签到方法
  async signInStudent(studentId, studentAddress) {
    try {
      // 确保钱包已初始化
      if (!this.walletId || !this.address) {
        throw new Error('Course wallet not properly initialized');
      }

      // 检查今日是否签到
      const today = new Date().toDateString();
      const alreadySignedIn = this.signInTable.some(record => 
        record.studentId === studentId && 
        new Date(record.time).toDateString() === today
      );

      if (alreadySignedIn) {
        throw new Error('Student already signed in today');
      }

      // 发送签到交易
      const transactionResult = await this.sendSigninTransaction(studentAddress);
      console.log('Transaction result:', transactionResult);

      // 记录签到信息
      const signInRecord = {
        studentId,
        time: new Date(),
        transactionId: transactionResult.id,
        transactionHash: transactionResult.hash
      };

      this.signInTable.push(signInRecord);
      this.transactionIDList.push(transactionResult.id);

      return signInRecord;

    } catch (error) {
      console.error('Error in signInStudent:', error);
      throw error;
    }
  }

  isAffairValid(affairID) {
    return 1;
  }

  // 查询签到表
  getSignInTable() {
    return this.signInTable;
  }

  // 返回课程信息
  getCourseInfo() {
    return {
      courseId: this.courseId,
      courseName: this.courseName,
      signInTable: this.getSignInTable(),
      registeredStudents: this.registeredStudents.map(student => student.getStudentInfo()),
      transactionIDList: this.transactionIDList,
      walletID: this.walletID,
      address: this.address,
      studentCount: this.registeredStudents.length
    };
  }

  // 生成钱包ID
  async generateWalletID() {
    try {
        // 创建钱包的请求不需要 password 参数
        const response = await fetch('http://localhost:3001/operator/wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
            // 不需要发送 body
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.walletId = data.id;
        this.address = data.address;
        
        console.log('Wallet created:', {
            walletId: this.walletId,
            address: this.address
        });

        return {
            walletId: this.walletId,
            address: this.address
        };
    } catch (error) {
        console.error('Error generating wallet:', error);
        throw error;
    }
  }

  async generateWalletAddress() {
    let url = buildUrl("localhost", "3001", "operator", "wallets", this.walletID, "addresses");
    console.log('Generated URL:', url); // 调试日志
    const customHeaders = {
      'password': String(this.courseId)
    };
    const response = await sendPostRequest(url, customHeaders, null);
    return response.address;
  }

  async mineBlocks(awardAddress) {
    try {
        const response = await fetch('http://localhost:3001/operator/mine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rewardAddress: awardAddress
            })
        });

        // 不尝试解析 JSON，直接返回成功
        if (response.ok) {
            const text = await response.text();
            console.log('Mining response:', text);
            return true;
        } else {
            throw new Error(`Mining failed: ${response.status}`);
        }
    } catch (error) {
        console.error('Error mining blocks:', error);
        throw error;
    }
  }

  async sendSigninTransaction(studentAddress, affairID) {
    try {
        const transactionUrl = buildUrl("localhost", "3001", "operator", "wallets", this.walletId, "transactions");
        const requestBody = {
            fromAddress: this.address,
            toAddress: studentAddress,
            amount: 1,
            changeAddress: this.address,
            data: {
                affairID: affairID,
                type: 'signin'
            }
        };

        const response = await sendPostRequest(transactionUrl, {
            'password': 'one two three four five'
        }, requestBody);

        return response;
    } catch (error) {
        console.error('Error sending sign-in transaction:', error);
        throw error;
    }
  }

  async getSigninFromBlockchain() {
    const signedStudent = [];
    // 使用 Promise.all 来处理所有异步请求
    await Promise.all(this.transactionIDList.map(async (element) => {
      let url = buildUrl("localhost", "3001", "blockchain", "blocks", "transactions", element);
      try {
        const response = await sendGetRequest(url);
        const data = response.transactions[0].data;
        const address = data.outputs[0].address;
        const timestamp = response.timestamp;
        //console.log(timestamp);
        
        for (const student of this.registeredStudents) {
          if (student.address === address) {
            signedStudent.push([student.studentId, student.name, address, String(timestamp)]);
          }
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
      }
    }));
    
    return signedStudent;
  }

  // 获取签到记录
  async getSignInRecords(address) {
    try {
        const url = buildUrl("localhost", "3001", "blockchain", "blocks");
        const response = await sendGetRequest(url);
        
        const attendanceRecords = [];
        
        // 遍历所有区块
        for (const block of response) {
            // 遍历区块中的所有交易
            for (const transaction of block.transactions) {
                // 检查是否是签到交易（转账到课程地址）
                if (transaction.data.outputs.some(output => 
                    output.address === address && output.amount === 1)) {
                    // 获取学生地址（从输入中）
                    const studentAddress = transaction.data.inputs[0]?.address;
                    
                    attendanceRecords.push({
                        transactionId: transaction.id,
                        timestamp: block.timestamp,
                        studentAddress: studentAddress,
                        blockIndex: block.index
                    });
                }
            }
        }

        console.log('Found attendance records:', attendanceRecords);
        return attendanceRecords;

    } catch (error) {
        console.error('Error fetching sign-in records:', error);
        throw error;
    }
  }

}

module.exports = CourseClass;
