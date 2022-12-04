require("dotenv").config()
const Web3 = require("web3")
const Utils = require('../../utils/Utils')
const mysql = require('../../utils/MysqlGateway')

let web3 = new Web3("wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY);
const contrAggregatorAddress = "0xdb42bc817af649e66937c2683b7b422f8d86ef58"
const contrAggregatorABI = '[{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"}],"name":"areContracts","outputs":[{"internalType":"bool[]","name":"","type":"bool[]"}],"stateMutability":"view","type":"function"}]'
let abi = JSON.parse(contrAggregatorABI)
let dbConn 
let aggregatorContract = new web3.eth.Contract(abi, contrAggregatorAddress)

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

async function parseBlocks(){
  dbConn = await mysql.getDBConnection()
  // read last block scraped from DB
  let lastBlockParsed = (await mysql.getLastParsedBlock(dbConn, Utils.chains.ETH_MAINNET))
  console.log("lastBlockParsed:",lastBlockParsed)
  // get current block
  let currentBlock = await web3.eth.getBlockNumber()
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
    let txObj = await web3.eth.getBlock(blockIndex, true)
    let toAddresses = txObj.transactions.map(e => e.to).filter(e => !!e)
    toAddresses = [...new Set(toAddresses)];
    let areContracts = await aggregatorContract.methods.areContracts(toAddresses).call()
    let toContracts = toAddresses.filter((e,index) => areContracts[index])
    await mysql.pushAddressesToPool(dbConn, Utils.chains.ETH_MAINNET, toContracts)
    await mysql.updateLastParsedBlock(dbConn, blockIndex, Utils.chains.ETH_MAINNET)
  }
  catch(e){
    console.log("ERROR PARSING BLOCK #" + blockIndex, e.message)
    web3 = new Web3("wss://mainnet.infura.io/ws/v3/" + process.env.INFURA_API_KEY);
    aggregatorContract = new web3.eth.Contract(abi, contrAggregatorAddress)
    return false
  }
  return true
}
