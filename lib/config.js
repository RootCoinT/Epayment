// Do not change these configurations after the blockchain is initialized
let currentDifficulty = 0x00000FFFFFFFFF;  // Add global difficulty variable
let lastAdjustmentBlockHeight = 0;         // Record the height of the last difficulty adjustment block

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
         // Get the current global difficulty
         getCurrentDifficulty: () => {
            return currentDifficulty;
        },

        getDifficulty: (blocks, index) => {
            const INITIAL_DIFFICULTY = 0x00000FFFFFFFFF;
            const BLOCK_INTERVAL = 5;
            const TARGET_TIME = 200;

            if (!blocks || blocks.length <= BLOCK_INTERVAL) return INITIAL_DIFFICULTY;


            // Only adjust difficulty every 5 blocks
            if ((blocks.length - 1) % BLOCK_INTERVAL !== 0) {
                //console.info('\n=== 难度调整周期222 ===');
                return currentDifficulty;
            }

            // If this height has already adjusted difficulty, return the current difficulty directly
            if (blocks.length === lastAdjustmentBlockHeight) {
                return currentDifficulty;
            }
            
            const startIndex = blocks.length - BLOCK_INTERVAL;
            const periodBlocks = blocks.slice(startIndex, startIndex + BLOCK_INTERVAL);
            

            let totalGenerationTime = 0;
            console.info('\n=== Difficulty Adjustment Cycle Start ===');
            console.info(`Block Range: ${startIndex} -> ${startIndex + BLOCK_INTERVAL - 1}`);
            periodBlocks.forEach(block => {
                totalGenerationTime += block.generationTime;
                console.info(`Block #${block.index} Generation Time: ${block.generationTime}ms`);
            });
            
            const averageTime = totalGenerationTime / BLOCK_INTERVAL;
            const timeRatio = averageTime / TARGET_TIME;
        
            console.info(`\nAverage Generation Time: ${averageTime.toFixed(2)}ms`);
            console.info(`Target Generation Time: ${TARGET_TIME}ms`);
            console.info(`Time Ratio: ${timeRatio.toFixed(2)}`);
                        
            if (Math.abs(timeRatio - 1) <= 0.5) {
                console.info('Difficulty remains unchanged (within target range)');
                return currentDifficulty;
            } 

            const binaryDifficulty = currentDifficulty.toString(2).padStart(56, '0');
            console.info(`Current Difficulty (hex): 0x${currentDifficulty.toString(16).padStart(14, '0')}`);

            let newBinary;
            let shiftBits = Math.floor(Math.abs(Math.log2(timeRatio)));
            if (timeRatio > 1) {
                // The generation time is too long, decrease difficulty (increase target hash value)
                newBinary = binaryDifficulty.substring(shiftBits) + '0'.repeat(shiftBits);
                currentDifficulty = parseInt(newBinary, 2);
                console.info(`Time Ratio: ${timeRatio}, need to decrease difficulty by 2^${shiftBits} = ${Math.pow(2, shiftBits)} times`);
            } else {
                // The generation time is too short, increase difficulty (decrease target hash value)
                newBinary = '0'.repeat(shiftBits) + binaryDifficulty.substring(0, 56 - shiftBits);
                currentDifficulty = parseInt(newBinary, 2);
                console.info(`Time Ratio: ${timeRatio}, need to increase difficulty by 2^${shiftBits} = ${Math.pow(2, shiftBits)} times`);
            }
        
            
            // Ensure within the range of 14 hexadecimal digits
            const MAX_DIFFICULTY = 0x3FFFFFFFFFFFFF;
            currentDifficulty = Math.min(Math.max(currentDifficulty, 1), MAX_DIFFICULTY);
            
            console.info(`New Difficulty (hex): 0x${currentDifficulty.toString(16).padStart(14, '0')}`);
            lastAdjustmentBlockHeight = blocks.length;
            console.info(`Recording difficulty adjustment height: ${lastAdjustmentBlockHeight}`);
            console.info(`=== Difficulty Adjustment Cycle End ===`);

            return currentDifficulty;
        }
    }
};