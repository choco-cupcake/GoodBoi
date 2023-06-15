// manually run from time to time to keep the top ERC20 list updated
// be a wise man and don't maintain a system to fight cloudflare if it has to be run like once a month

const rpcEndpoints = require("../data/rpcEndpoints")
const Web3 = require("web3")
const Utils = require("../utils/Utils")
let web3 = [], web3Index = 0

// !!! STEP 1: Change the hardcoded chain in both the chrome and local scripts

// ========= Step 2: Paste this on chrome console on https://XXXscan.XX/tokens ==================
/*
function parseObj(chain){
  let xpath_name = chain == "ETH_MAINNET" ? "//div[@class='table-responsive']//table/tbody/tr/td[2]/a/div" : "//table[@id='tblResult']//tr/td[2]/div/div/h3/a"
  let xpath_addr = chain == "ETH_MAINNET" ? "//div[@class='table-responsive']//table/tbody/tr/td[2]/a/@href" : "//table[@id='tblResult']//tr/td[2]/div/div/h3/a/@href"
  let outObj = []
  let names = $x(xpath_name)
  let symbol = names.map(e => e.innerText.replace("(PoS)","").split("(")[1].split(")")[0])
  let extendedNames = names.map(e => e.innerText.split("(")[0].trim())
  let addresses = $x(xpath_addr).map(e => e.nodeValue.substring(7))
  console.log(names, names.length)
  console.log(addresses, addresses.length)
  if(names.length != 100 || addresses.length != 100){
    console.log("Length mismatch, abort")
    return
  }
  for(let i=0; i< 100; i++){
    outObj.push({token: symbol[i], name: extendedNames[i], address: addresses[i]})
  }
  console.log(outObj)
}
parseObj("POLYGON")
*/

// ============= Step 3: Double check the chain, then paste here the object and run to get the decimals =============
const chain = "POLYGON"


let nativeSymbol
if(chain == "BSC_MAINNET")
  nativeSymbol = "BNB"
else if(chain == "POLYGON")
  nativeSymbol = "MATIC"
else
  nativeSymbol = "ETH"

const decimalsAbi = '[{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"}]'
let parsedObj = [
  {
      "token": "WETH",
      "name": "Wrapped Ether",
      "address": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"
  },
  {
      "token": "USDT",
      "name": "",
      "address": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
  },
  {
      "token": "BNB",
      "name": "BNB",
      "address": "0x3BA4c387f786bFEE076A58914F5Bd38d668B42c3"
  },
  {
      "token": "USDC",
      "name": "USD Coin",
      "address": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
  },
  {
      "token": "BUSD",
      "name": "binance-usd",
      "address": "0xdab529f40e671a1d4bf91361c21bf9f0c9712ab7"
  },
  {
      "token": "MATIC",
      "name": "Matic Token",
      "address": "0x0000000000000000000000000000000000001010"
  },
  {
      "token": "DAI",
      "name": "",
      "address": "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063"
  },
  {
      "token": "WBTC",
      "name": "",
      "address": "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6"
  },
  {
      "token": "SHIB",
      "name": "SHIBA INU",
      "address": "0x6f8a06447ff6fcf75d803135a7de15ce88c1d4ec"
  },
  {
      "token": "AVAX",
      "name": "Avalanche Token",
      "address": "0x2C89bbc92BD86F8075d1DEcc58C7F4E0107f286b"
  },
  {
      "token": "LEO",
      "name": "Bitfinex LEO Token",
      "address": "0x06d02e9d62a13fc76bb229373fb3bbbd1101d2fc"
  },
  {
      "token": "UNI",
      "name": "Uniswap",
      "address": "0xb33eaad8d922b1083446dc23f610c2567fb5180f"
  },
  {
      "token": "LINK",
      "name": "ChainLink Token",
      "address": "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39"
  },
  {
      "token": "LINK",
      "name": "ChainLink Token",
      "address": "0xb0897686c545045afc77cf20ec7a532e3120e0f1"
  },
  {
      "token": "TUSD",
      "name": "TrueUSD",
      "address": "0x2e1ad108ff1d8c782fcbbb89aad783ac49586756"
  },
  {
      "token": "LDO",
      "name": "Lido DAO Token",
      "address": "0xc3c7d422809852031b44ab29eec9f1eff2a58756"
  },
  {
      "token": "CRO",
      "name": "Cronos Coin",
      "address": "0xada58df0f643d959c2a47c9d4d4c1a4defe3f11c"
  },
  {
      "token": "PAX",
      "name": "Paxos Standard",
      "address": "0x6f3b3286fd86d8b47ec737ceb3d0d354cc657b3e"
  },
  {
      "token": "FRAX",
      "name": "Frax",
      "address": "0x45c32fa6df82ead1e2ef74d17b76547eddfaff89"
  },
  {
      "token": "GRT",
      "name": "Graph Token",
      "address": "0x5fe2b58c013d7601147dcdd68c143a77499f5531"
  },
  {
      "token": "APE",
      "name": "ApeCoin",
      "address": "0xB7b31a6BC18e48888545CE79e83E06003bE70930"
  },
  {
      "token": "RPL",
      "name": "Rocket Pool",
      "address": "0x7205705771547cf79201111b4bd8aaf29467b9ec"
  },
  {
      "token": "USDD",
      "name": "Decentralized USD",
      "address": "0xffa4d863c96e743a2e1513824ea006b8d0353c57"
  },
  {
      "token": "AAVE",
      "name": "Aave",
      "address": "0xd6df932a45c0f255f85145f286ea0b292b21c90b"
  },
  {
      "token": "FTM",
      "name": "Fantom Token",
      "address": "0xc9c1c1c20b3658f8787cc2fd702267791f224ce1"
  },
  {
      "token": "SAND",
      "name": "SAND",
      "address": "0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683"
  },
  {
      "token": "RNDR",
      "name": "Render Token",
      "address": "0x61299774020da444af134c82fa83e3810b309991"
  },
  {
      "token": "THETA",
      "name": "Theta Token",
      "address": "0xb46e0ae620efd98516f49bb00263317096c114b2"
  },
  {
      "token": "MANA",
      "name": "Decentraland",
      "address": "0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4"
  },
  {
      "token": "MKR",
      "name": "Maker",
      "address": "0x6f7C932e7684666C9fd1d44527765433e01fF61d"
  },
  {
      "token": "GUSD",
      "name": "Gemini dollar",
      "address": "0xc8a94a3d3d2dabc3c1caffffdca6a7543c3e3e65"
  },
  {
      "token": "SNX",
      "name": "Synthetix Network Token",
      "address": "0x50b728d8d964fd00c2d0aad81718b71311fef68a"
  },
  {
      "token": "CRV",
      "name": "CRV",
      "address": "0x172370d5cd63279efa6d502dab29171933a610af"
  },
  {
      "token": "PAXG",
      "name": "Paxos Gold",
      "address": "0x553d3d295e0f695b9228246232edf400ed3560b5"
  },
  {
      "token": "INJ",
      "name": "Injective Token",
      "address": "0x4e8dc2149eac3f3def36b1c281ea466338249371"
  },
  {
      "token": "HT",
      "name": "HuobiToken",
      "address": "0xfad65eb62a97ff5ed91b23afd039956aaca6e93b"
  },
  {
      "token": "frxETH",
      "name": "Frax Ether",
      "address": "0xee327f889d5947c1dc1934bb208a1e792f953e96"
  },
  {
      "token": "CHZ",
      "name": "chiliZ",
      "address": "0xf1938ce12400f9a761084e7a80d37e732a4da056"
  },
  {
      "token": "FXS",
      "name": "Frax Share",
      "address": "0x1a3acf6d19267e2d3e7f898f42803e90c9219062"
  },
  {
      "token": "NEXO",
      "name": "Nexo",
      "address": "0x41b3966b4ff7b427969ddf5da3627d6aeae9a48e"
  },
  {
      "token": "WOO",
      "name": "Wootrade Network",
      "address": "0x1b815d120b3ef02039ee11dc2d33de7aa4a8c603"
  },
  {
      "token": "MASK",
      "name": "Mask Network",
      "address": "0x2b9e7ccdf0f4e5b24757c1e1a80e311e34cb10c7"
  },
  {
      "token": "GNO",
      "name": "Gnosis",
      "address": "0x5ffd62d3c3ee2e81c00a7b9079fb248e7df024a8"
  },
  {
      "token": "POLY",
      "name": "Polymath",
      "address": "0xcb059c5573646047d6d88dddb87b745c18161d3b"
  },
  {
      "token": "LRC",
      "name": "LoopringCoin V2",
      "address": "0x84e1670f61347cdaed56dcc736fb990fbb47ddc1"
  },
  {
      "token": "SXP",
      "name": "Swipe",
      "address": "0x6abb753c1893194de4a83c6e8b4eadfc105fd5f5"
  },
  {
      "token": "BAT",
      "name": "BAT",
      "address": "0x3cef98bb43d732e2f285ee605a8158cde967d219"
  },
  {
      "token": "ENJ",
      "name": "EnjinCoin",
      "address": "0x7ec26842f195c852fa843bb9f6d8b583a274a157"
  },
  {
      "token": "1INCH",
      "name": "1INCH Token",
      "address": "0x9c2c5fd7b07e95ee044ddeba0e97a665f142394f"
  },
  {
      "token": "sfrxETH",
      "name": "Staked Frax Ether",
      "address": "0x6d1fdbb266fcc09a16a22016369210a15bb95761"
  },
  {
      "token": "AGIX",
      "name": "SingularityNET Token",
      "address": "0x190eb8a183d22a4bdf278c6791b152228857c033"
  },
  {
      "token": "HOT",
      "name": "HoloToken",
      "address": "0x0c51f415cf478f8d08c246a6c6ee180c5dc3a012"
  },
  {
      "token": "FET",
      "name": "Fetch",
      "address": "0x7583feddbcefa813dc18259940f76a02710a8905"
  },
  {
      "token": "YFI",
      "name": "",
      "address": "0xda537104d6a5edd53c6fbba9a898708e465260b6"
  },
  {
      "token": "COMP",
      "name": "",
      "address": "0x8505b9d2254a7ae468c0e9dd10ccea3a837aef5c"
  },
  {
      "token": "OCEAN",
      "name": "Ocean Token",
      "address": "0x282d8efce846a88b159800bd4130ad77443fa1a1"
  },
  {
      "token": "BAL",
      "name": "Balancer",
      "address": "0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3"
  },
  {
      "token": "GLM",
      "name": "Golem Network Token",
      "address": "0x0b220b82f3ea3b7f6d9a1d8ab58930c064a2b5bf"
  },
  {
      "token": "IOTX",
      "name": "IoTeX Network",
      "address": "0xf6372cdb9c1d3674e83842e3800f2a62ac9f3c66"
  },
  {
      "token": "ANKR",
      "name": "Ankr",
      "address": "0x101a023270368c0d50bffb62780f4afd4ea79c35"
  },
  {
      "token": "ZRX",
      "name": "ZRX",
      "address": "0x5559edb74751a0ede9dea4dc23aee72cca6be3d5"
  },
  {
      "token": "BAND",
      "name": "BandToken",
      "address": "0xa8b1e0764f85f53dfe21760e8afe5446d82606ac"
  },
  {
      "token": "EURS",
      "name": "STASIS EURS Token",
      "address": "0xe111178a87a3bff0c8d18decba5798827539ae99"
  },
  {
      "token": "pBORA",
      "name": "pBORA",
      "address": "0x0ef39e52704ad52e2882bbfa6781167e1b6c4510"
  },
  {
      "token": "UST",
      "name": "Wrapped UST Token",
      "address": "0x692597b009d13c4049a947cab2239b7d6517875f"
  },
  {
      "token": "AMP",
      "name": "Amp",
      "address": "0x0621d647cecbfb64b79e44302c1933cb4f27054d"
  },
  {
      "token": "AXL",
      "name": "Axelar",
      "address": "0x6e4e624106cb12e168e6533f8ec7c82263358940"
  },
  {
      "token": "GNS",
      "name": "Gains Network",
      "address": "0xE5417Af564e4bFDA1c483642db72007871397896"
  },
  {
      "token": "CHSB",
      "name": "SwissBorg",
      "address": "0x67ce67ec4fcd4aca0fcb738dd080b2a21ff69d75"
  },
  {
      "token": "SUSHI",
      "name": "SushiToken",
      "address": "0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a"
  },
  {
      "token": "EWTB",
      "name": "Energy Web Token Bridged",
      "address": "0x43e4b063f96c33f0433863a927f5bad34bb4b03d"
  },
  {
      "token": "STG",
      "name": "StargateToken",
      "address": "0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590"
  },
  {
      "token": "LPT",
      "name": "Livepeer Token",
      "address": "0x3962f4a0a0051dcce0be73a7e09cef5756736712"
  },
  {
      "token": "UMA",
      "name": "UMA Voting Token v1",
      "address": "0x3066818837c5e6ed6601bd5a91b0762877a6b731"
  },
  {
      "token": "SYN",
      "name": "Synapse",
      "address": "0xf8f9efc0db77d8881500bb06ff5d6abc3070e695"
  },
  {
      "token": "TEL",
      "name": "Telcoin",
      "address": "0xdf7837de1f2fa4631d716cf2502f8b230f1dcc32"
  },
  {
      "token": "RLC",
      "name": "RLC",
      "address": "0xbe662058e00849c3eef2ac9664f37fefdf2cdbfe"
  },
  {
      "token": "KNC",
      "name": "Kyber Network Crystal v2",
      "address": "0x1c954e8fe737f99f68fa1ccda3e51ebdb291948c"
  },
  {
      "token": "ELON",
      "name": "Dogelon",
      "address": "0xe0339c80ffde91f3e20494df88d4206d86024cdf"
  },
  {
      "token": "aETHc",
      "name": "Ankr Eth2 Reward Bearing Certificate",
      "address": "0xc4e82ba0fe6763cbe5e9cbca0ba7cbd6f91c6018"
  },
  {
      "token": "OMG",
      "name": "OMG Network",
      "address": "0x62414d03084eeb269e18c970a21f45d2967f0170"
  },
  {
      "token": "BEPRO",
      "name": "BetProtocolToken",
      "address": "0x07cc1cc3628cc1615120df781ef9fc8ec2feae09"
  },
  {
      "token": "PYR",
      "name": "PYR Token",
      "address": "0x430EF9263E76DAE63c84292C3409D61c598E9682"
  },
  {
      "token": "NEST",
      "name": "NEST",
      "address": "0x98f8669f6481ebb341b522fcd3663f79a3d1a6a7"
  },
  {
      "token": "C98",
      "name": "Coin98",
      "address": "0x77f56cf9365955486b12c4816992388ee8606f0e"
  },
  {
      "token": "IQ",
      "name": "Everipedia IQ",
      "address": "0xb9638272ad6998708de56bbc0a290a1de534a578"
  },
  {
      "token": "ORBS",
      "name": "Orbs",
      "address": "0x614389eaae0a6821dc49062d56bda3d9d45fa2ff"
  },
  {
      "token": "XSGD",
      "name": "XSGD",
      "address": "0xDC3326e71D45186F113a2F448984CA0e8D201995"
  },
  {
      "token": "GTC",
      "name": "Gitcoin",
      "address": "0xdb95f9188479575f3f718a245eca1b3bf74567ec"
  },
  {
      "token": "POWR",
      "name": "PowerLedger",
      "address": "0x0aab8dc887d34f00d50e19aee48371a941390d14"
  },
  {
      "token": "POND",
      "name": "Marlin POND",
      "address": "0x73580a2416a57f1c4b6391dba688a9e4f7dbece0"
  },
  {
      "token": "REQ",
      "name": "Request",
      "address": "0xb25e20de2f2ebb4cffd4d16a55c7b395e8a94762"
  },
  {
      "token": "BNT",
      "name": "Bancor",
      "address": "0xc26d47d5c33ac71ac5cf9f776d63ba292a4f7842"
  },
  {
      "token": "BOB",
      "name": "BOB",
      "address": "0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B"
  },
  {
      "token": "SX",
      "name": "SportX",
      "address": "0x840195888db4d6a99ed9f73fcd3b225bb3cb1a79"
  },
  {
      "token": "CEL",
      "name": "Celsius",
      "address": "0xd85d1e945766fea5eda9103f918bd915fbca63e6"
  },
  {
      "token": "USD+",
      "name": "USD+",
      "address": "0x236eec6359fb44cce8f97e99387aa7f8cd5cde1f"
  },
  {
      "token": "wUSD+",
      "name": "Wrapped USD+",
      "address": "0x4e36d8006416ea1d939a0eeae73afdaca86bd376"
  },
  {
      "token": "KEEP",
      "name": "KEEP Token",
      "address": "0x42f37a1296b2981f7c3caced84c5096b2eb0c72c"
  },
  {
      "token": "GHST",
      "name": "Aavegotchi GHST Token",
      "address": "0x385eeac5cb85a38a9a07a70c73e0a3271cfb54a7"
  }
]

main()

async function main(){
  bootstrapWeb3()
  for(let pa of parsedObj){
    let contract = getContractRoundRobin(pa.address)
    let decimals = await contract.methods.decimals().call()
    pa["decimals"] = decimals
    console.log(JSON.stringify(pa))
    await Utils.sleep(200)
  }
  // add native currency
  parsedObj.unshift({token: nativeSymbol, name: "native currency", address: "0x0000000000000000000000000000000000000000", decimals: "18"})
  // add weth bc not etherscan does not include it 
  if(chain == "ETH_MAINNET")
    parsedObj.unshift({token: "WETH", name: "Wrapped Ether", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", decimals: "18"})
  console.log("\n\n ====== \n\n")
  console.log("\"" + chain + "\": [", parsedObj.reduce((accumulator, currentValue) => accumulator + JSON.stringify(currentValue) + ",\n", ""), "]")
}
function bootstrapWeb3(){
  for(let endp of rpcEndpoints[chain]){
    web3.push(new Web3(endp))
  }
}

function getContractRoundRobin(address){ 
  let ret = new web3[web3Index].eth.Contract(JSON.parse(decimalsAbi), address)
  web3Index = ++web3Index % web3.length
  return ret
}