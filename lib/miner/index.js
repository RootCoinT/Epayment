const R = require('ramda');
const spawn = require('threads').spawn;
const Block = require('../blockchain/block');
const CryptoUtil = require('../util/cryptoUtil');
const Transaction = require('../blockchain/transaction');
const Config = require('../config');

class Miner {
    constructor(blockchain, logLevel) {
        this.blockchain = blockchain;
        this.logLevel = logLevel;
    }

    mine(rewardAddress, feeAddress) {
        let baseBlock = Miner.generateNextBlock(rewardAddress, feeAddress, this.blockchain);
        const difficulty = this.blockchain.getDifficulty();
    
        // Add mining start log
        console.info('\n=== Mining Start ===');
        console.info(`Block Height: ${baseBlock.index}`);
        console.info(`Current Difficulty: ${difficulty}`);
        const mineStartTime = new Date().getTime();
        process.execArgv = R.reject((item) => item.includes('debug'), process.execArgv);

        /* istanbul ignore next */
        const thread = spawn(function (input, done) {
            /*eslint-disable */
            require(input.__dirname + '/../util/consoleWrapper.js')('mine-worker', input.logLevel);
            const Block = require(input.__dirname + '/../blockchain/block');
            const Miner = require(input.__dirname);
            /*eslint-enable */

            done(Miner.proveWorkFor(Block.fromJson(input.jsonBlock), input.difficulty));
        });

        const transactionList = R.pipe(
            R.countBy(R.prop('type')),
            R.toString,
            R.replace('{', ''),
            R.replace('}', ''),
            R.replace(/"/g, '')
        )(baseBlock.transactions);

        console.info(`Mining a new block with ${baseBlock.transactions.length} (${transactionList}) transactions`);

        const promise = thread.promise().then((result) => {
            // Add mining completed log
            const mineEndTime = new Date().getTime();
            console.info('\n=== Mining Completed ===');
            console.info(`Time Elapsed: ${(mineEndTime - mineStartTime)/1000} seconds`);

            thread.kill();
            return result;
        });

        thread.send({
            __dirname: __dirname,
            logLevel: this.logLevel,
            jsonBlock: baseBlock,
            difficulty: this.blockchain.getDifficulty()
        });

        return promise;
    }

    static generateNextBlock(rewardAddress, feeAddress, blockchain) {
        const previousBlock = blockchain.getLastBlock();
        const index = previousBlock.index + 1;
        const previousHash = previousBlock.hash;
        const timestamp = new Date().getTime() / 1000;
        const blocks = blockchain.getAllBlocks();
        const candidateTransactions = blockchain.transactions;
        const transactionsInBlocks = R.flatten(R.map(R.prop('transactions'), blocks));
        const inputTransactionsInTransaction = R.compose(R.flatten, R.map(R.compose(R.prop('inputs'), R.prop('data'))));

        // Select transactions that can be mined         
        let rejectedTransactions = [];
        let selectedTransactions = [];
        R.forEach((transaction) => {
            let negativeOutputsFound = 0;
            let i = 0;
            let outputsLen = transaction.data.outputs.length;

            // Check for negative outputs (avoiding negative transactions or 'stealing')
            for (i = 0; i < outputsLen; i++) {
                if (transaction.data.outputs[i].amount < 0) {
                    negativeOutputsFound++;
                }
            }
            // Check if any of the inputs is found in the selectedTransactions or in the blockchain
            let transactionInputFoundAnywhere = R.map((input) => {
                let findInputTransactionInTransactionList = R.find(
                    R.whereEq({
                        'transaction': input.transaction,
                        'index': input.index
                    }));

                // Find the candidate transaction in the selected transaction list (avoiding double spending)
                let wasItFoundInSelectedTransactions = R.not(R.isNil(findInputTransactionInTransactionList(inputTransactionsInTransaction(selectedTransactions))));

                // Find the candidate transaction in the blockchain (avoiding mining invalid transactions)
                let wasItFoundInBlocks = R.not(R.isNil(findInputTransactionInTransactionList(inputTransactionsInTransaction(transactionsInBlocks))));

                return wasItFoundInSelectedTransactions || wasItFoundInBlocks;
            }, transaction.data.inputs);

            if (R.all(R.equals(false), transactionInputFoundAnywhere)) {
                if (transaction.type === 'regular' && negativeOutputsFound === 0) {
                    selectedTransactions.push(transaction);
                } else if (transaction.type === 'reward') {
                    selectedTransactions.push(transaction);
                } else if (negativeOutputsFound > 0) {
                    rejectedTransactions.push(transaction);
                }
            } else {
                rejectedTransactions.push(transaction);
            }
        }, candidateTransactions);

        console.info(`Selected ${selectedTransactions.length} candidate transactions with ${rejectedTransactions.length} being rejected.`);

        // Get the first two avaliable transactions, if there aren't TRANSACTIONS_PER_BLOCK, it's empty
        let transactions = R.defaultTo([], R.take(Config.TRANSACTIONS_PER_BLOCK, selectedTransactions));

        // Add fee transaction (1 satoshi per transaction)        
        if (transactions.length > 0) {
            let feeTransaction = Transaction.fromJson({
                id: CryptoUtil.randomId(64),
                hash: null,
                type: 'fee',
                data: {
                    inputs: [],
                    outputs: [
                        {
                            amount: Config.FEE_PER_TRANSACTION * transactions.length, // satoshis format
                            address: feeAddress, // INFO: Usually here is a locking script (to check who and when this transaction output can be used), in this case it's a simple destination address 
                        }
                    ]
                }
            });

            transactions.push(feeTransaction);
        }

        // Add reward transaction of 50 coins
        if (rewardAddress != null) {
            let rewardTransaction = Transaction.fromJson({
                id: CryptoUtil.randomId(64),
                hash: null,
                type: 'reward',
                data: {
                    inputs: [],
                    outputs: [
                        {
                            amount: Config.MINING_REWARD, // satoshis format
                            address: rewardAddress, // INFO: Usually here is a locking script (to check who and when this transaction output can be used), in this case it's a simple destination address 
                        }
                    ]
                }
            });

            transactions.push(rewardTransaction);
        }

        return Block.fromJson({
            index,
            nonce: 0,
            previousHash,
            timestamp,
            transactions
        });
    }

    /* istanbul ignore next */
    static proveWorkFor(jsonBlock, targetDifficulty) {
        const startTime = new Date().getTime();
        let block = Block.fromJson(jsonBlock);
        let hashCount = 0;
        
        do {
            block.timestamp = Math.floor(new Date().getTime() / 1000);
            block.nonce++;
            hashCount++;
            block.hash = block.toHash();
            
            // Output progress every 1,000,000 attempts
            if (hashCount % 1000000 === 0) {
                const currentDifficulty = block.getDifficulty();
                const elapsedTime = new Date().getTime() - startTime;
                console.info(`Current Difficulty (hex): 0x${currentDifficulty.toString(16).padStart(14, '0')}`);
                console.info(`Target Difficulty (hex): 0x${targetDifficulty.toString(16).padStart(14, '0')}`);
                console.info(`Time Elapsed: ${elapsedTime}ms`);
            }
        } while (block.getDifficulty() >= targetDifficulty);
    
        // Record block generation time
        block.generationTime = new Date().getTime() - startTime;
        
        console.info(`\nMining Completed:`);
        console.info(`Generation Time: ${block.generationTime}ms`);
        console.info(`Current Hash: 0x${block.hash.substring(0, 14)}`);
        console.info(`Hash Count: ${hashCount}`);
        console.info(`Target Difficulty: 0x${targetDifficulty.toString(16).padStart(14, '0')}`);
        console.info(`Average Hash Rate: ${Math.floor(hashCount / (block.generationTime / 1000))} H/s`);
        
        return block;
    }
}

module.exports = Miner;
