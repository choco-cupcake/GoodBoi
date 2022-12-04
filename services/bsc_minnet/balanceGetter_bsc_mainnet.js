require("dotenv").config()
const BigNumber = require('bignumber.js');
const Utils = require('../../utils/Utils');
let chain = Utils.chains.BSC_MAINNET
const axios = require("axios");
const mysql = require('../../utils/MysqlGateway');
const Web3 = require("web3")
const rpcEndpoints = require("../../data/rpcEndpoints")[chain]
let web3 = [], web3Index = 0

const ERC20_of_interest = require("../../data/ERC20_of_interest")[chain];
const priceAggregatorABI = '[{"constant":true,"inputs":[{"name":"user","type":"address"},{"name":"token","type":"address"}],"name":"tokenBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"users","type":"address[]"},{"name":"tokens","type":"address[]"}],"name":"balances","outputs":[{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"}]'
const priceAggregatorAddress = "0xdb42bc817af649e66937c2683b7b422f8d86ef58"
let aggregatorContract = [] 
const aggrAddrPerTime = process.env.AGGREGATED_ADDRESS_SIZE
const parallelCrawlers = process.env.PARALLEL_CRAWLERS
const dbBatchSize = process.env.BALANCES_DB_BATCH_SIZE
const daysOld = process.env.BALANCE_REFRESH_DAYS
let dbConn
let addresses
let addrCrawled = 0, cumulativeUsd = 0
let today
let refillInterval

main()

async function main(){
  console.log("loop started")
  bootstrapWeb3()
  dbConn = await mysql.getDBConnection()
  addresses = await mysql.getAddressesOldBalance(dbConn, chain, daysOld, dbBatchSize)
  let start = Date.now()
  if(addresses.length){
    if(today != new Date().getDate()){ // refresh prices once per day
      today = new Date().getDate()
      await getAllQuotes() // get fresh prices for all tokens of interest
    }
    refillInterval = setInterval(checkAndFill, 1500, chain)
    await refreshAllBalances()
  }
  else console.log("All balances are up to date. Return")
  console.log("loop done")
	let toWait = process.env.BALANCE_GETTER_RUN_INTERVAL_HOURS * 60 * 60 * 1000 - (Date.now() - start) // 1 hour - elapsed
	if(toWait > 0){
		await Utils.sleep(toWait)
	}
	main()
}

function bootstrapWeb3(){
  for(let endp of rpcEndpoints){
    web3.push(new Web3(endp))
    aggregatorContract.push(new web3[web3.length - 1].eth.Contract(JSON.parse(priceAggregatorABI), priceAggregatorAddress))
  }
}

async function refreshAllBalances(){ 
  console.log("Balances update started")
	for(let i=0; i<parallelCrawlers; i++){
    refreshBatch()
	}
  return new Promise((resolve, reject) =>{
    let intervalCheck = setInterval(() => {
      if(!addresses.length){
        clearInterval(intervalCheck); 
        resolve();
      }
    }, 1000)
  })
}

async function refreshBatch(){
  let batch = []
  let addrLen = Math.min(addresses.length, aggrAddrPerTime)
  for(let i=0; i<addrLen; i++)
    batch.push(addresses.pop()) // we get multiple tokens for multiple addresses in one call to save on api rate
  let ERC20Holdings_raw = await getAggregatedHoldings(batch.map(e => e.address)) 
  for(let k=0; k<batch.length; k++){ 
    let eth_balance = new BigNumber(ERC20Holdings_raw[k].balances[0]).div(new BigNumber("1e14")).toFixed(0) // saving integers at db with 4 decimals of precision
    let ERC20USDValue = new BigNumber(0)
    let ERC20Holdings = {holdings: []}
    for(let i=0; i< ERC20Holdings_raw[k].balances.length; i++){ 
      if(ERC20Holdings_raw[k].balances[i] == 0)
        continue
      let toAdd = new BigNumber(ERC20Holdings_raw[k].balances[i])
        .times(new BigNumber(ERC20_of_interest[i]['USD_price']))
        .div(new BigNumber("1e" + ERC20_of_interest[i]['decimals']))
      ERC20USDValue = ERC20USDValue.plus(toAdd)
      if(i != 0) // do not add native eth to ERC20 tokens
        ERC20Holdings.holdings.push({token: ERC20_of_interest[i].token, amount: ERC20Holdings_raw[k].balances[i]})
    }
    let usdval = ERC20USDValue.toFixed(0)
    await mysql.updateBalance(dbConn, chain, batch[k].address, usdval, JSON.stringify(ERC20Holdings), eth_balance)

    addrCrawled++
    cumulativeUsd += +usdval
    if(addrCrawled % 500 == 0){
      console.log("Updated balances for " + addrCrawled + " addresses. Cumulative USD: " + cumulativeUsd)
    }
  }
  
  if(!addresses.length){
    console.log("Address list empty, crawler done")
    return
  }
  refreshBatch()
}

async function getAggregatedHoldings(addresses){
  let tokens = ERC20_of_interest.map(e => e.address) // slice to skip native eth
  let response = await getContractRoundRobin().methods.balances(addresses.map(e => web3[web3Index].utils.toChecksumAddress(e)), tokens).call()
  if(tokens.length * addresses.length != response.length){
    console.log("ERROR - balances response unexpected length")
    return null
  }
  // split response
  let resp_split = []
  for(let i=0; i < addresses.length; i++){
    resp_split.push({
      address: addresses[i],
      balances: response.slice(i * tokens.length, (i+1) * tokens.length)
    })
  }
  return resp_split
}

async function getAllQuotes(){
  console.log("Getting ERC20 quotes");
  for(let i=1; i < ERC20_of_interest.length; i++){ // skip native ETH. kept in the same struct bc price aggregator contract accepts it
    let r = await moralisGetPriceUSD(ERC20_of_interest[i].address)
    if(!isNaN(r?.data?.usdPrice)){
      ERC20_of_interest[i]['USD_price'] = r.data.usdPrice
      if(ERC20_of_interest[i].token == "WBNB")
        ERC20_of_interest[0]['USD_price'] = r.data.usdPrice // assign WBNB price to BNB
    }
    else{
      console.log("ERROR getting fresh price for token " + ERC20_of_interest[i].token, "Fix and retry")
      process.exit()
    }
    console.log("#" + i + " " + ERC20_of_interest[i].token + " : " + ERC20_of_interest[i]['USD_price'] + "$");
  }
}

async function checkAndFill(chain) {
	if(addresses.length < aggrAddrPerTime * parallelCrawlers * 5){ // margin for concurrency
    addresses = await mysql.getAddressesOldBalance(dbConn, chain, daysOld, dbBatchSize)
    if(addresses.length < dbBatchSize){
      clearInterval(refillInterval)
    }
  }
}

async function moralisGetPriceUSD(address){ 
  const options = {
    method: 'GET',
    url: 'https://deep-index.moralis.io/api/v2/erc20/' + address + '/price',
    params: {chain: "bsc"},
    headers: {'Accept-Encoding': 'application/json', 'X-API-Key': process.env.MORALIS_API_KEY}
  };
  try{
  return await axios.request(options)
  } catch(e) {
    return null
  }
}

function getContractRoundRobin(){ // round robin
  let ret = aggregatorContract[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}