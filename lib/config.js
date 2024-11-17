// Do not change these configurations after the blockchain is initialized
let currentDifficulty = 0x00000FFFFFFFFF;  // 添加全局难度变量
let lastAdjustmentBlockHeight = 0;         // 记录最后一次调整难度的区块高度

module.exports = {
    // INFO: The mining reward could decreases over time like bitcoin. See https://en.bitcoin.it/wiki/Mining#Reward.
    MINING_REWARD: 5000000000,
    // INFO: Usually it's a fee over transaction size (not quantity)
    FEE_PER_TRANSACTION: 1,
    // INFO: Usually the limit is determined by block size (not quantity)
    TRANSACTIONS_PER_BLOCK: 2,
    genesisBlock: {
        index: 0,
        previousHash: '0',
        timestamp: 1465154705,
        nonce: 0,
        transactions: [
            {
                id: '63ec3ac02f822450039df13ddf7c3c0f19bab4acd4dc928c62fcd78d5ebc6dba',
                hash: null,
                type: 'regular',
                data: {
                    inputs: [],
                    outputs: []
                }
            }
        ]
    },
    pow: {
         // 获取当前全局难度
         getCurrentDifficulty: () => {
            return currentDifficulty;
        },

        getDifficulty: (blocks, index) => {
            const INITIAL_DIFFICULTY = 0x00000FFFFFFFFF;
            const BLOCK_INTERVAL = 5;
            const TARGET_TIME = 200;

            if (!blocks || blocks.length <= BLOCK_INTERVAL) return INITIAL_DIFFICULTY;


            // 只在每5个区块的整数倍时进行调整
            if ((blocks.length - 1) % BLOCK_INTERVAL !== 0) {
                //console.info('\n=== 难度调整周期222 ===');
                return currentDifficulty;
            }

            // 如果这个高度已经调整过难度，直接返回当前难度
            if (blocks.length === lastAdjustmentBlockHeight) {
                return currentDifficulty;
            }
            
            const startIndex = blocks.length - BLOCK_INTERVAL;
            const periodBlocks = blocks.slice(startIndex, startIndex + BLOCK_INTERVAL);
            

            let totalGenerationTime = 0;
            console.info('\n=== 难度调整周期开始 ===');
            console.info(`区块范围: ${startIndex} -> ${startIndex + BLOCK_INTERVAL - 1}`);
            periodBlocks.forEach(block => {
                totalGenerationTime += block.generationTime;
                console.info(`区块 #${block.index} 生成时间: ${block.generationTime}ms`);
            });
            
            const averageTime = totalGenerationTime / BLOCK_INTERVAL;
            const timeRatio = averageTime / TARGET_TIME;
        
            console.info(`\n平均生成时间: ${averageTime.toFixed(2)}ms`);
            console.info(`目标生成时间: ${TARGET_TIME}ms`);
            console.info(`时间比率: ${timeRatio.toFixed(2)}`);
                        
            if (Math.abs(timeRatio - 1) <= 0.5) {
                console.info('难度保持不变（在目标范围内）');
                return currentDifficulty;
            } 

            // 将当前难度转为二进制字符串
            const binaryDifficulty = currentDifficulty.toString(2).padStart(56, '0');
            console.info(`当前难度16进制: 0x${currentDifficulty.toString(16).padStart(14, '0')}`);

            let newBinary;
            let shiftBits = Math.floor(Math.abs(Math.log2(timeRatio)));
            if (timeRatio > 1) {
                // 生成时间过长，降低难度（增大目标哈希值）
                newBinary = binaryDifficulty.substring(shiftBits) + '0'.repeat(shiftBits);
                currentDifficulty = parseInt(newBinary, 2);
                console.info(`时间比率: ${timeRatio}, 需要降低 2^${shiftBits} = ${Math.pow(2, shiftBits)} 倍难度`);
            } else {
                // 生成时间过短，增加难度（减小目标哈希值）
                newBinary = '0'.repeat(shiftBits) + binaryDifficulty.substring(0, 56 - shiftBits);
                currentDifficulty = parseInt(newBinary, 2);
                console.info(`时间比率: ${timeRatio}, 需要增加 2^${shiftBits} = ${Math.pow(2, shiftBits)} 倍难度`);
            }
        
            
            // 确保在14位16进制数的范围内
            const MAX_DIFFICULTY = 0x3FFFFFFFFFFFFF;
            currentDifficulty = Math.min(Math.max(currentDifficulty, 1), MAX_DIFFICULTY);
            
            console.info(`新难度(16进制): 0x${currentDifficulty.toString(16).padStart(14, '0')}`);
            // 记录本次调整的区块高度
            lastAdjustmentBlockHeight = blocks.length;
            console.info(`记录难度调整高度: ${lastAdjustmentBlockHeight}`);
            console.info(`=== 难度调整高度结束 ===`);

            return currentDifficulty;
        }
    }
};