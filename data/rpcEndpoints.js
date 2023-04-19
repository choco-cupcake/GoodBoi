require("dotenv").config()

const endpoints = {
  "ETH_MAINNET" : ["https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
                  "https://eth.llamarpc.com",
                  "https://ethereum.publicnode.com",
                  "https://rpc.ankr.com/eth",
                  "https://eth.rpc.blxrbdn.com",
                  "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_ETHRPC_API_KEY,
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
                "https://polygon-bor.publicnode.com"],
    "ARBITRUM" : ["https://arbitrum-one.gateway.pokt.network/v1/lb/" + process.env.PORTAL_POKT_API_KEY,
                "https://floral-silent-gadget.arbitrum-mainnet.discover.quiknode.pro/" + process.env.QUICKNODE_ARBRPC_API_KEY,
                "https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
                "https://arb-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_ARBRPC_API_KEY,
                "https://open-platform.nodereal.io/" + process.env.NODEREAL_ARBRPC_API_KEY + "/arbitrum-nitro/",
                "https://arbitrum.api.onfinality.io/rpc?apikey=" + process.env.ONFINALITY_API_KEY]
}

module.exports = endpoints