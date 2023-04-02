require("dotenv").config()

const endpoints = {
  "ETH_MAINNET" : ["wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY,
                  "https://eth.llamarpc.com",
                  "https://ethereum.publicnode.com",
                  "https://rpc.ankr.com/eth",
                  "https://eth.rpc.blxrbdn.com",
                  "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
                  "https://ethereum.blockpi.network/v1/rpc/public",
                  "https://rpc.payload.de",],
  "BSC_MAINNET" : ["https://rpc.ankr.com/bsc", 
                  "https://bsc-dataseed1.binance.org", 
                  "https://bsc-dataseed2.binance.org", 
                  "https://bsc-dataseed3.binance.org", 
                  "https://bsc-dataseed4.binance.org", 
                  "https://bsc-dataseed1.defibit.io", 
                  "https://bsc-dataseed2.defibit.io", 
                  "https://bsc-dataseed3.defibit.io", 
                  "https://bsc-dataseed4.defibit.io", 
                  "https://bsc-dataseed1.ninicoin.io", 
                  "https://bsc-dataseed2.ninicoin.io", 
                  "https://bsc-dataseed3.ninicoin.io", 
                  "https://bsc-dataseed4.ninicoin.io", 
                  "https://bsc.rpc.blxrbdn.com", 
                  "https://bsc.blockpi.network/v1/rpc/public"],
  "POLYGON" : ["https://polygon-rpc.com", 
              "https://rpc.ankr.com/polygon",
              "https://polygon.llamarpc.com",
              "https://polygon.rpc.blxrbdn.com",
              "https://polygon.blockpi.network/v1/rpc/public",
              "https://polygon-mainnet.public.blastapi.io",
              "https://poly-rpc.gateway.pokt.network",
              "https://polygon-bor.publicnode.com"]
}

module.exports = endpoints