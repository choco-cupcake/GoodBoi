require("dotenv").config()
const ethers = require('ethers')
const BigNumber = require('bignumber.js');
const Utils = require('./Utils');
const mysql = require('./MysqlGateway');
const quoterData = require("../data/univ3_quoter_data")
const QuoterABI = '[{"inputs":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"name":"quoteExactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}]'

const UniV3PoolABI = '[{"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"}]'
const UniV3FactoryABI = '[{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]'

// get weth-usdc pool
const wethDecimals = 18
const wethIn = 0.01
const fees = [500, 3000, 10000]
let quoterAddress, univ3factory, weth, ethersNetworkName
let ethersProvider = []
let ethersIndex = 0
let chain 
// todo fai un round robin con alchemy
// aggiungi funzione di ingresso getTokenPrice(ethPrice, token, tokenDecimals)
// imposta come utils 

async function getAllPrices(dbConn, _chain, tokenObj){
  chain = _chain
  // get eth price from eth ERC20 cache
  let eth_erc20 = await mysql.getFromCache(dbConn, "ERC20_" + Utils.chains.ETH_MAINNET, true)
  let wethPrice = JSON.parse(eth_erc20)[0]["USD_price"]
  ethersNetworkName = quoterData.ethersNetworkName[chain]
  bootstrapEthers()
  quoterAddress = quoterData.quoterAddress[chain]
  univ3factory = quoterData.uniV3Factory[chain]
  weth = quoterData.wethAddress[chain]
  tokenObj[0]['USD_price'] = wethPrice // eth price
  tokenObj[1]['USD_price'] = wethPrice // weth price
  for(let i=2; i<tokenObj.length; i++){
    let price = await getPrice(tokenObj[i].address, tokenObj[i].decimals, wethPrice)
    tokenObj[i]['USD_price'] = price
    console.log("Token " + tokenObj[i].token + " - price: " + price + " $")
  }
  return tokenObj
}

async function getPrice(token, tokenDecimals, wethPrice){
  let eth001AmountOut = await getTokenAmountFor001Eth(token, tokenDecimals)
  if(eth001AmountOut == 0)
    return 0
  if(isNaN(eth001AmountOut))
    return 0
  let tokenPrice = BigNumber(wethPrice).div(eth001AmountOut).div(100)
  return tokenPrice
}

async function getTokenAmountFor001Eth(tokenAddress, tokenDecimals){
  // get the most liquid fee among the UniV3 pool WETH-TOKEN 
  let poolCandidates = []
  let univ3factory = quoterData.uniV3Factory[chain]
  let uniV3FactoryContract = new ethers.Contract(univ3factory, UniV3FactoryABI, getEthersProviderRoundRobin())
  for(let fee of fees){
    let poolAddr = await uniV3FactoryContract.getPool(quoterData.wethAddress[chain], tokenAddress, fee)
    if(poolAddr == '0x0000000000000000000000000000000000000000')
      continue
    let liq = 0
    try{
      liq = await getLiquidity(poolAddr)
      if(isNaN(liq))
        liq = 0
    }catch(e){
      console.log(e.message)
    }
    if(liq.gt(0))
      poolCandidates.push({liquidity: liq, fee: fee})
  }
  if(!poolCandidates.length)
    return 0
  let mostLiquidFee = poolCandidates.sort((a,b) => {b.liquidity.sub(a.liquidity)})[0].fee

  // get out tokens for 0.01 weth in
  const quoterContract = new ethers.Contract(quoterAddress, QuoterABI, getEthersProviderRoundRobin())
  const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
    weth,
    tokenAddress,
    mostLiquidFee,
    fromReadableAmount(
      wethIn,
      wethDecimals
    ).toString(),
    0
  )

  return toReadableAmount(quotedAmountOut, tokenDecimals)
}

// get usdc price in weth
async function getLiquidity(poolAddr){
  const poolContract = new ethers.Contract(
    poolAddr,
    UniV3PoolABI,
    getEthersProviderRoundRobin()
  )
  return await poolContract.liquidity()
}

function bootstrapEthers(){
  ethersProvider.push(new ethers.providers.InfuraProvider(ethersNetworkName, process.env.INFURA_API_KEY))
  ethersProvider.push(new ethers.providers.AlchemyProvider(ethersNetworkName, process.env.ALCHEMY_ARBRPC_API_KEY))
}

function getEthersProviderRoundRobin(){
  let ret = ethersProvider[ethersIndex]
  ethersIndex = ++ethersIndex % ethersProvider.length
  return ret
}

function fromReadableAmount(amount, decimals) {
  return ethers.utils.parseUnits(amount.toString(), decimals)
}

function toReadableAmount(rawAmount, decimals) {
  return ethers.utils
    .formatUnits(rawAmount, decimals)
    .slice(0, 4)
}

module.exports = {getAllPrices}