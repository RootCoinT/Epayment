#!/bin/bash

# 创建钱包
echo "create wallet..."
WALLET_RESPONSE=$(curl -s -X POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d '{"password": "s y n z d"}' \
  'http://localhost:3001/operator/wallets')

# 提取钱包ID
WALLET_ID=$(echo $WALLET_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "wallet id: $WALLET_ID"

# 为钱包创建地址
echo "create address..."
ADDRESS_RESPONSE=$(curl -s -X POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'password: s y n z d' \
  "http://localhost:3001/operator/wallets/$WALLET_ID/addresses")

# 提取地址
REWARD_ADDRESS=$(echo $ADDRESS_RESPONSE | grep -o '"address":"[^"]*' | cut -d'"' -f4)
echo "reward address: $REWARD_ADDRESS"

# 开始挖矿
echo "start mining..."
curl -X POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d "{
    \"rewardAddress\": \"$REWARD_ADDRESS\",
    \"feeAddress\": \"$REWARD_ADDRESS\"
  }" \
  'http://localhost:3001/miner/mine'