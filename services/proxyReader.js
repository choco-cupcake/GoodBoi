const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');
const Web3 = require("web3")
const { program } = require('commander');
const aggregatorABI = '[{"inputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"}],"internalType":"struct GetValueAggregator.InputObj[]","name":"input","type":"tuple[]"}],"name":"getMappingValue","outputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"},{"internalType":"address[]","name":"readVal","type":"address[]"}],"internalType":"struct GetValueAggregator.OutputMappingObj[]","name":"","type":"tuple[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"}],"internalType":"struct GetValueAggregator.InputObj[]","name":"input","type":"tuple[]"}],"name":"getVarValue","outputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"},{"internalType":"address","name":"readVal","type":"address"}],"internalType":"struct GetValueAggregator.OutputVariableObj[]","name":"","type":"tuple[]"}],"stateMutability":"nonpayable","type":"function"}]'
const parallelCrawlers = process.env.PROXIES_PARALLEL_CRAWLERS
const batchLen = process.env.PROXIES_BATCH_LEN
let aggregatorContract = [] 
let web3Index = 0
let web3 = []

let contractPool
program
  .option('--chain <string>', 'chain to operate on');

program.parse();
const cliOptions = program.opts();

if(!Object.values(Utils.chains).includes(cliOptions.chain)){
  console.log("Unrecognized chain, abort.")
  process.exit()
}
console.log("Operating on chain: " + cliOptions.chain)

const rpcEndpoints = require("../data/rpcEndpoints")[cliOptions.chain]

main()

async function main(){
  console.log("loop started")
  bootstrapWeb3()
  dbConn = await mysql.getDBConnection()
  contractPool = await mysql.getBatchProxiesToRead(dbConn, cliOptions.chain)
  let start = Date.now()
  if(contractPool.length){
    refillInterval = setInterval(checkAndFill, 1500)
    await refreshVarsValues()
  }
  else 
    console.log("All proxies are up to date. Return")
  console.log("loop done")
	let toWait = process.env.STATE_VARS_RUN_INTERVAL_HOURS * 60 * 60 * 1000 - (Date.now() - start) // 1 hour - elapsed
	if(toWait > 0){
		await Utils.sleep(toWait)
	}
	main()
}

function bootstrapWeb3(){
  for(let endp of rpcEndpoints){
    web3.push(new Web3(endp))
  }
}

async function refreshVarsValues(){ 
  console.log("Vars values update started")
	for(let i=0; i<parallelCrawlers; i++){
    refreshBatch()
	}
  return new Promise((resolve, reject) =>{
    let intervalCheck = setInterval(() => {
      if(!contractPool.length){
        clearInterval(intervalCheck); 
        resolve();
      }
    }, 1000)
  })
}

async function refreshBatch(){
  while(contractPool.length){
    let contract = contractPool.pop()
    let rawSlotValue = await getWeb3RoundRobin().eth.getStorageAt(contract.address, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc');
    let addressImpl = "0x0"
    if(rawSlotValue != '0x0000000000000000000000000000000000000000000000000000000000000000') {
      try{
        addressImpl = web3[0].eth.abi.decodeParameter("address", rawSlotValue)
      } catch(e) {
        console.log(e)
      }
    }
    await mysql.updateProxyImplAddress(dbConn, contract.ID, addressImpl, addressImpl != contract.implAddress)
    console.log("Done " + contract.ID + " : " + addressImpl)
  }
}


async function checkAndFill() {
	if(contractPool.length < parallelCrawlers * 50){ // margin for concurrency
    contractPool = await mysql.getBatchProxiesToRead(dbConn, cliOptions.chain)
    if(contractPool.length < batchLen){
      clearInterval(refillInterval)
    }
  }
}

function getWeb3RoundRobin(){ // round robin
  if(aggregatorContract.length == 1) return aggregatorContract[0]
  let ret = web3[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}