require("dotenv").config()

const scannersApiEndpoints = {
  "ETH_MAINNET" : "https://api.etherscan.io/api?module=contract&action=getsourcecode",
  "BSC_MAINNET" : "https://api.bscscan.com/api?module=contract&action=getsourcecode",
  "POLYGON" : "https://api.polygonscan.com/api?module=contract&action=getsourcecode",
  "ARBITRIUM" : "https://api.arbiscan.io/api?module=contract&action=getsourcecode"
}

const scannersApiKeys = {
  "ETH_MAINNET" : process.env.ETHERSCAN_API,
  "BSC_MAINNET" : process.env.BSCSCAN_API,
  "POLYGON" : process.env.POLYGONSCAN_API,
  "ARBITRIUM" : process.env.ARBISCAN_API
}

module.exports = {endpoints: scannersApiEndpoints, apikeys: scannersApiKeys}