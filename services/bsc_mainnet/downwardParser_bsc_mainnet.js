require("dotenv").config()
const Web3 = require("web3")
const Utils = require('../../utils/Utils')
const chain = Utils.chains.BSC_MAINNET
const mysql = require('../../utils/MysqlGateway')
const axios = require("axios")
const rpcEndpoints = require("../../data/rpcEndpoints")[chain]
let web3 = [], web3Index = 0
const contrAggregatorAddress = "0x72A041660Bb132EdAAeF759CCF8585CFa14b65C5"
const contrAggregatorABI = '[{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"}],"name":"areContracts","outputs":[{"internalType":"bool[]","name":"","type":"bool[]"}],"stateMutability":"view","type":"function"}]'
let abi = JSON.parse(contrAggregatorABI)
let dbConn 
let aggregatorContract = [] 
let lastBlockParsed

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
  lastBlockParsed = (await mysql.getLastParsedBlockDownward(dbConn, chain))
  console.log("lastBlockParsed:",lastBlockParsed)

  for(let i=0;i<5;i++){
    parseBlock()
  }
}

function getBlockIndex(){
  return --lastBlockParsed
}

async function parseBlock(){
  let blockIndex = getBlockIndex()
  try{
    console.log("Block #" + blockIndex)
    let txObj = await getBlockObject(blockIndex)
    let toAddresses = txObj.transactions.map(e => e.to).filter(e => !!e)
    toAddresses = [...new Set(toAddresses)];
    let areContracts = await aggregatorContract[web3Index].methods.areContracts(toAddresses).call()
    let toContracts = toAddresses.filter((e,index) => areContracts[index])
    await mysql.pushAddressesToPool(dbConn, chain, toContracts)
    await mysql.updateLastParsedBlockDownward(dbConn, blockIndex, chain)
  }
  catch(e){
    console.log("ERROR PARSING BLOCK #" + blockIndex, e.message)
    bootstrapWeb3()
  }
  await parseBlock()
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