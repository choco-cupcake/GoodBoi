require("dotenv").config()
const Utils = require('../../utils/Utils')
const chain = Utils.chains.POLYGON
const axios = require("axios")
const Web3 = require("web3")
const mysql = require('../../utils/MysqlGateway')
const rpcEndpoints = require("../../data/rpcEndpoints")[chain]
let web3 = [], web3Index = 0

const contrAggregatorAddress = "0x16Fe0557A0958dE762e3d40DEEd9529e21845b04"
const contrAggregatorABI = '[{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"}],"name":"areContracts","outputs":[{"internalType":"bool[]","name":"","type":"bool[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"target","type":"address"}],"name":"isContract","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}]'
let abi = JSON.parse(contrAggregatorABI)
let dbConn 
let aggregatorContract = []

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
    aggregatorContract.push(new web3[web3.length - 1].eth.Contract(abi, contrAggregatorAddress))
  }
}

async function parseBlocks(){
  dbConn = await mysql.getDBConnection()
  // read last block scraped from DB
  let lastBlockParsed = (await mysql.getLastParsedBlock(dbConn, chain))
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
    console.log("Block #" + blockIndex)
    let txObj = await getBlockObject(blockIndex)
    let toAddresses = txObj.transactions.map(e => e.to).filter(e => !!e)
    toAddresses = [...new Set(toAddresses)];
    let areContracts = await aggregatorContract[web3Index].methods.areContracts(toAddresses).call()
    let toContracts = toAddresses.filter((e,index) => areContracts[index])
    await mysql.pushAddressesToPool(dbConn, chain, toContracts)
    await mysql.updateLastParsedBlock(dbConn, blockIndex, chain)
  }
  catch(e){
    console.log("ERROR PARSING BLOCK #" + blockIndex, e.message)
    bootstrapWeb3()
    return false
  }
  return true
}


async function getBlockObject(blockNumber){
  let rpcEndp = getRpcEndpoint()
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

function getRpcEndpoint(){ // round robin
  let ret = rpcEndpoints[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}