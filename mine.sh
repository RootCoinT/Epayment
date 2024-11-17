#!/bin/bash

# 创建钱包
echo "创建钱包..."
WALLET_RESPONSE=$(curl -s -X POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d '{"password": "s y n z d"}' \
  'http://localhost:3001/operator/wallets')

# 提取钱包ID
WALLET_ID=$(echo $WALLET_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "钱包ID: $WALLET_ID"

# 为钱包创建地址
echo "创建地址..."
ADDRESS_RESPONSE=$(curl -s -X POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'password: s y n z d' \
  "http://localhost:3001/operator/wallets/$WALLET_ID/addresses")

# 提取地址
REWARD_ADDRESS=$(echo $ADDRESS_RESPONSE | grep -o '"address":"[^"]*' | cut -d'"' -f4)
echo "奖励地址: $REWARD_ADDRESS"

# 开始挖矿
echo "开始挖矿..."
curl -X POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  -d "{
    \"rewardAddress\": \"$REWARD_ADDRESS\",
    \"feeAddress\": \"$REWARD_ADDRESS\"
  }" \
  'http://localhost:3001/miner/mine'