require("dotenv").config()
const config = require('../data/config')
const Web3 = require("web3")
const Utils = require('../utils/Utils')
const { program } = require('commander');
const mysql = require('../utils/MysqlGateway')
const axios = require("axios")
let web3 = [], web3Index = 0, web3IndexLastLoop = 0
const contrAggregatorABI = JSON.parse('[{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"}],"name":"areContracts","outputs":[{"internalType":"bool[]","name":"","type":"bool[]"}],"stateMutability":"view","type":"function"}]')
let dbConn 
let lastTxBuffer = [] // need to be aggregated and sent separatedly, since multiple concurrent workers pick up the same 'to' address -> deadlock
let aggregatorContract = [] 
let toAddressBuffer = []
let lastBlockParsed, lastParsedTS
let updateLastTxTimer, updateLastTxLock
let parsedBuffer = []

program
  .option('--chain <string>', 'chain to operate on');

program.parse();
const cliOptions = program.opts();

const chain = cliOptions.chain

if(!Object.values(Utils.chains).includes(chain)){
  console.log("Unrecognized chain, abort.")
  process.exit()
}
console.log("Operating on chain: " + chain)

const rpcEndpoints = require("../data/rpcEndpoints")[chain]
const contrAggregatorAddress = require("../data/smart_contracts")["isContractAggregator"][chain]

bootstrapWeb3()
main()

async function main(){
  setInterval(logParsed, 5000)
  while(true){
    let start = Date.now()
    await parseBlocks()
    console.log("loop done")
    let toWait = config.blockParser.runInterval_minutes * 60 * 1000 - (Date.now() - start) // 1 min - elapsed
    if(toWait > 0){
      await Utils.sleep(toWait)
    }
  }
}

function bootstrapWeb3(){
  web3.length = 0
  aggregatorContract.length = 0
  for(let endp of rpcEndpoints){
    web3.push(new Web3(endp))
    aggregatorContract.push(new web3[web3.length - 1].eth.Contract(contrAggregatorABI, contrAggregatorAddress))
  }
}

async function parseBlocks(){
  dbConn = await mysql.getDBConnection()
  // read last block scraped from DB
  lastBlockParsed = (await mysql.getLastParsedBlock(dbConn, chain))
  lastParsedTS = Date.now()
  console.log("lastBlockParsed:",lastBlockParsed)
  // get current block
  let currentBlock = await (await getWeb3RoundRobin()).eth.getBlockNumber()
  console.log("currentBlock:",currentBlock)
  // set/refresh interval update lastTx
  if(updateLastTxTimer)
    clearInterval(updateLastTxTimer)
  updateLastTxTimer = setInterval(() => {sendUpdateLastTx(dbConn, chain)}, 5000)
  // loop parse blocks
  let err = 0
  for(let i=lastBlockParsed + 1; i <= currentBlock - 2; i+=3){
    if(i % 100 == 0){ // refresh last block
      currentBlock = await (await getWeb3RoundRobin()).eth.getBlockNumber()
    }
    while(!await parseBlock(i, currentBlock)){
      if(++err >= 5) break; 
    }
  }
}

async function parseBlock(blockIndex, currentBlock){
  try{
    // console.log("Block #" + blockIndex)
    let blocksObject = []
    let blocksLeft = currentBlock - (blockIndex  - 1)
    let blocksToParse = Math.min(3, blocksLeft)
    for(let i=0; i < blocksToParse; i++){
      blocksObject.push(getBlockObject(blockIndex + i))
    }
    await Promise.all(blocksObject)
    for(let i=0; i < blocksToParse; i++)
      blocksObject[i] = await blocksObject[i]
      
    let toAddresses = []
    for(txObj of blocksObject){
      let _toAddresses = txObj.transactions.map(e => e.to).filter(e => !!e)
      toAddresses = toAddresses.concat(_toAddresses)
    }
    toAddresses = [...new Set(toAddresses)] // remove doubles
    for(let toAddr of toAddresses){
      toAddressBuffer.push(toAddr)
      if(toAddressBuffer.length >= config.blockParser.isContractBatchLength || (blockIndex == currentBlock)){
        let areContracts = await (await getAggregatorContractRoundRobin()).methods.areContracts(toAddressBuffer).call()
        let toContracts = toAddressBuffer.filter((e,index) => areContracts[index])
        let toUpdateLastTx = await mysql.pushAddressesToPoolBatch(dbConn, chain, toContracts)
        // push toUpdateLastTx to global list
        lastTxBuffer.push(...toUpdateLastTx)
        await mysql.updateLastParsedBlock(dbConn, blockIndex, chain)
        parsedBuffer.unshift({datetime: Date.now(), parsed: blocksToParse})
        lastBlockParsed = blockIndex
        lastParsedTS = Date.now()
        toAddressBuffer.length = 0
        
      }
    }
  }
  catch(e){
    console.log("ERROR PARSING BLOCK #" + blockIndex, e.message)
    bootstrapWeb3()
    return false
  }
  return true
}

function logParsed(){
  let tot = 0
  for(let i=parsedBuffer.length-1;i>=0;i--){
    if((Date.now() - parsedBuffer[i].datetime) > 60000){
      parsedBuffer.pop()
    } else{
      tot += parsedBuffer[i].parsed
    }
  }
  if(tot == 0)
    return
  let elapsed = 60000
  let bs = Number((tot * 1000000 / elapsed).toFixed(0)) / 1000
  console.log("Parsed " + tot + " blocks in last 60 secs - " + bs + " blocks/sec")
}

async function sendUpdateLastTx(dbConn, chain){ // called by timer to remove duplicates and send query
  if(!lastTxBuffer.length || updateLastTxLock)
    return
  // remove duplicates
  lastTxBuffer = [...(new Set(lastTxBuffer))]
  // send query
  updateLastTxLock = true
  let success = await mysql.updateLastTxBatch(dbConn, chain, lastTxBuffer)
  if (success){
    lastTxBuffer.length = 0
  }
  updateLastTxLock = false
}

async function getBlockObject(blockNumber){ // doNotFetchNext=true if its last block or if its a next block fetch call
  let rpcEndp = await getRpcEndpointRoundRobin()
  let data = {
    "jsonrpc":"2.0",
    "method":"eth_getBlockByNumber",
    "params":[
      '0x' + blockNumber.toString(16), 
      true
    ],
    "id":1
    }
    const res = await axios.post(rpcEndp, data, {
    headers: {
      'Accept-Encoding': 'application/json'
    }
  });
  return res.data.result 
}

async function getRpcEndpointRoundRobin(){ // round robin
  await loopWeb3SleepCheck()
  if(rpcEndpoints.length == 1) return rpcEndpoints[0]
  let ret = rpcEndpoints[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}

async function getWeb3RoundRobin(){ // round robin
  await loopWeb3SleepCheck()
  if(web3.length == 1) return web3[0]
  let ret = web3[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}

async function getAggregatorContractRoundRobin(){ // round robin
  await loopWeb3SleepCheck()
  if(aggregatorContract.length == 1) return aggregatorContract[0]
  let ret = aggregatorContract[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}

async function loopWeb3SleepCheck(){
  if(web3Index == 0){
    let elapsed = Date.now() - web3IndexLastLoop
    if(elapsed < 1000){
      await Utils.sleep(500 - elapsed)
    }
    web3IndexLastLoop = Date.now()
  }
}