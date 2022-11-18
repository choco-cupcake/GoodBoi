require("dotenv").config()
const BigNumber = require('bignumber.js');
const Utils = require('../utils/Utils');
const axios = require("axios");
const mysql = require('../utils/MysqlGateway');
const Web3 = require("web3")
const web3 = new Web3("wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY);
const readline = require('readline');

const priceAggregatorABI = '[{"constant":true,"inputs":[{"name":"user","type":"address"},{"name":"token","type":"address"}],"name":"tokenBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"users","type":"address[]"},{"name":"tokens","type":"address[]"}],"name":"balances","outputs":[{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"}]'
const priceAggregatorAddress = "0xb1f8e55c7f64d203c1400b9d8555d050f94adf39"

const ERC20_of_interest = require("../data/ERC20_of_interest");
const chain = Utils.chains.ETH_MAINNET

//refreshBalances()

async function refreshBalances(chain, daysOld){ 
  dbConn = await mysql.getDBConnection()
  await getAllQuotes() // get fresh prices for all tokens of interest
  let addresses = await mysql.getAddressesOldBalance(dbConn, chain, daysOld) 
  while(true){
    if(addresses.length < 5){
      addresses = await mysql.getAddressesOldBalance(dbConn, chain, daysOld)
      if(!addresses.length){
        console.log("All balances have been updated")
        return
      }
    }
    let batch = []
    let addrLen = Math.min(addresses.length, 5)
    for(let i=0; i<addrLen; i++)
      batch.push(addresses.pop()) // we get multiple tokens for multiple addresses in one call to save on api rate
    let ERC20Holdings_raw = await getAggregatedHoldings(batch.map(e => e.address)) // check returned decimals!!! 
    for(let k=0; k<batch.length; k++){ 
      let eth_balance = new BigNumber(ERC20Holdings_raw[k].balances[0]).div(new BigNumber("1e14")).toFixed(0)
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
      console.log("Got balance for address " + batch[k].address + " usd: " + usdval)
    }
  }
}

async function getAggregatedHoldings(addresses){
  let aggregatorContract = new web3.eth.Contract(JSON.parse(priceAggregatorABI), priceAggregatorAddress)
  let tokens = ERC20_of_interest.map(e => e.address) // slice to skip native eth
  let response = await aggregatorContract.methods.balances(addresses.map(e => web3.utils.toChecksumAddress(e)), tokens).call()
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
      if(ERC20_of_interest[i].token == "wETH")
        ERC20_of_interest[0]['USD_price'] = r.data.usdPrice // assign wETH price to ETH
    }
    else{
      console.log("ERROR getting fresh price for token " + ERC20_of_interest[i].token, "Fix and retry")
      process.exit()
    }
    console.log("#" + i + " " + ERC20_of_interest[i].token + " : " + ERC20_of_interest[i]['USD_price'] + "$");
  }
}

async function moralisGetPriceUSD(address){ 
  const options = {
    method: 'GET',
    url: 'https://deep-index.moralis.io/api/v2/erc20/' + address + '/price',
    params: {chain: 'eth'},
    headers: {accept: 'application/json', 'X-API-Key': process.env.MORALIS_API_KEY}
  };
  try{
  return await axios.request(options)
  } catch(e) {return null}
}

module.exports = {refreshBalances}