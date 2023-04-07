require("dotenv").config()
const Web3 = require("web3")
const Utils = require('../utils/Utils')
const { program } = require('commander');
const mysql = require('../utils/MysqlGateway')
const axios = require("axios")
let web3 = [], web3Index = 0, web3IndexLastLoop = 0
const contrAggregatorABI = JSON.parse('[{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"}],"name":"areContracts","outputs":[{"internalType":"bool[]","name":"","type":"bool[]"}],"stateMutability":"view","type":"function"}]')
let dbConn 
let aggregatorContract = [] 
let toAddressBuffer = []
let lastBlockParsed, lastParsedTS

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
	let start = Date.now()
	await parseBlocks()
	let toWait = process.env.BLOCK_PARSER_RUN_INTERVAL_MINUTES * 60 * 1000 - (Date.now() - start) // 1 min - elapsed
	if(toWait > 0){
		await Utils.sleep(toWait)
	}
	main()
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
  let currentBlock = await web3[web3Index].eth.getBlockNumber()
  console.log("currentBlock:",currentBlock)

  // loop parse blocks
  let err = 0
  for(let i=lastBlockParsed + 1; i <= currentBlock; i++){
    while(!await parseBlock(i)){
      if(++err >= 5) break; 
    }
  }
}

async function parseBlock(blockIndex){
  try{
    // console.log("Block #" + blockIndex)
    let txObj = await getBlockObject(blockIndex)
    let toAddresses = txObj.transactions.map(e => e.to).filter(e => !!e)
    toAddresses = [...new Set(toAddresses)]
    for(let toAddr of toAddresses){
      toAddressBuffer.push(toAddr)
      if(toAddressBuffer.length >= process.env.IS_CONTRACT_BATCH_LEN){
        let areContracts = await (await getAggregatorContractRoundRobin()).methods.areContracts(toAddressBuffer).call()
        let toContracts = toAddressBuffer.filter((e,index) => areContracts[index])
        if(Utils.isL2(chain)){ // L2s need more concurrency to keep up
          let promises = []
          let third = Math.floor(toContracts.length / 3)
          for(let i=0; i<3; i++)
            promises.push(mysql.pushAddressesToPoolBatch(dbConn, chain, toContracts.slice(i*third, i==2 ? toContracts.length : (i+1)*third)))
          await Promise.all(promises)
        } else{
          await mysql.pushAddressesToPoolBatch(dbConn, chain, toContracts)
        }
        await mysql.updateLastParsedBlock(dbConn, blockIndex, chain)
        let parsedBlocks = blockIndex - lastBlockParsed
        let elapsed = Date.now() - lastParsedTS
        let bs = Number((parsedBlocks * 1000000 / elapsed).toFixed(0)) / 1000
        console.log("Parsed " + parsedBlocks + " blocks in " + elapsed + " seconds - " + bs + " blocks/sec")
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

async function getBlockObject(blockNumber){
  let rpcEndp = await getRpcEndpoint()
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

async function getRpcEndpoint(){ // round robin
  await loopWeb3SleepCheck()
  let ret = rpcEndpoints[web3Index]
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