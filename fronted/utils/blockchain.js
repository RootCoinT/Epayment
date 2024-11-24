const { buildUrl, sendPostRequest } = require('../sendRequest');

async function generateWalletID(password) {
    try {
        let url = buildUrl("localhost", "3001", "operator", "wallets");
        let requestBody = {
            password: password
        };
        const response = await sendPostRequest(url, null, requestBody);
        return response.id;
    } catch (error) {
        console.error('Error generating wallet ID:', error);
        throw error;
    }
}

async function generateWalletAddress(walletId, password) {
    try {
        let url = buildUrl("localhost", "3001", "operator", "wallets", walletId, "addresses");
        const customHeaders = {
            'password': password
        };
        const response = await sendPostRequest(url, customHeaders, null);
        return response.address;
    } catch (error) {
        console.error('Error generating wallet address:', error);
        throw error;
    }
}

async function mineBlocks(address) {
    try {
        let url = buildUrl("localhost", "3001", "miner", "mine");
        let requestBody = {
            rewardAddress: address
        };
        const response = await sendPostRequest(url, null, requestBody);
        return response.index;
    } catch (error) {
        console.error('Error mining blocks:', error);
        throw error;
    }
}

module.exports = {
    generateWalletID,
    generateWalletAddress,
    mineBlocks
};