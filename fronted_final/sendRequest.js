const fetch = require('node-fetch');

function buildUrl(...args) {
    const [host, port, ...rest] = args;
    
    let baseUrl = `http://${host}:${port}`;
    
    if (rest.length > 0) {
        const path = rest.filter(Boolean).join('/');
        baseUrl = `${baseUrl}/${path}`;
    }
    
    console.log('Built URL:', baseUrl);
    return baseUrl;
}

async function sendGetRequest(url, customHeaders = null) {
    try {
        const requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(customHeaders || {})
            }
        };

        console.log('Making GET request to:', url);
        
        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Balance GET Response:', data);
        return data;
    } catch (error) {
        console.error('Error in sendGetRequest:', error);
        throw error;
    }
}

async function sendPostRequest(url, customHeaders = null, body = null) {
    try {
        console.log('Sending POST request to:', url);
        console.log('Headers:', customHeaders);
        console.log('Body:', body);

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(customHeaders || {})
            }
        };

        if (body) {
            requestOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, requestOptions);
        const data = await response.json();
        console.log('POST Response:', data);
        return data;
    } catch (error) {
        console.error('Error in sendPostRequest:', error);
        throw error;
    }
}

// 测试URL构建
console.log(buildUrl("localhost", "3001", "operator", "wallets"));

module.exports = {
    buildUrl,
    sendGetRequest,
    sendPostRequest
};