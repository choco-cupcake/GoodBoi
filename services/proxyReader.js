const mysql = require('../utils/MysqlGateway');
const config = require('../data/config')
const Utils = require('../utils/Utils');
const Web3 = require("web3")
const { program } = require('commander');
const implSlotAddress = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
const batchLen = config.proxyReader.batchLength
let web3Index = 0, web3 = [], web3IndexLastLoop = 0
let doneCount = 0, readCount = 0

let contractPool
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

main()

async function main(){
  while(true){
    console.log("loop started")
    bootstrapWeb3()
    dbConn = await mysql.getDBConnection()
    contractPool = await mysql.getBatchProxiesToRead(dbConn, chain)
    let start = Date.now()
    if(contractPool.length){
      refillInterval = setInterval(checkAndFill, 1500)
      await refreshVarsValues()
    }
    else 
      console.log("All proxies are up to date. Return")
    console.log("loop done")
    let toWait = config.stateVariablesReader.runInterval_minutes * 60 * 1000 - (Date.now() - start) // 1 hour - elapsed
    if(toWait > 0){
      await Utils.sleep(toWait)
    }
  }
}

function bootstrapWeb3(){
  for(let endp of rpcEndpoints){
    web3.push(new Web3(endp))
  }
}

async function refreshVarsValues(){ 
  console.log("Proxy Implementation addresses values update started")
	await refreshBatch()
}

async function refreshBatch(){
  while(contractPool.length){
    let contract = contractPool.pop()
    let rawSlotValue = '0x0000000000000000000000000000000000000000000000000000000000000000'
    try{
      rawSlotValue = await (await getWeb3RoundRobin()).eth.getStorageAt(contract.address, implSlotAddress);
    }
    catch(e){}
    let addressImpl = "0x0"
    if(rawSlotValue != '0x0000000000000000000000000000000000000000000000000000000000000000') {
      try{
        addressImpl = web3[0].eth.abi.decodeParameter("address", rawSlotValue)
      } catch(e) {
        console.log(e)
      }
    }
    if(addressImpl == "0x0000000000000000000000000000000000000000") 
      addressImpl = "0x0"
    if(addressImpl != "0x0")
      readCount++
    doneCount++
    await mysql.updateProxyImplAddress(dbConn, chain, contract.ID, addressImpl, addressImpl != contract.implAddress)
    if(doneCount % 10 == 0)
      console.log("Done " + doneCount + " - " + readCount + " implementations found")
  }
}


async function checkAndFill() {
	if(contractPool.length < 50){ 
    contractPool = await mysql.getBatchProxiesToRead(dbConn, chain)
    if(contractPool.length < batchLen){
      clearInterval(refillInterval)
    }
  }
}

async function getWeb3RoundRobin(){ // round robin
  await loopWeb3SleepCheck()
  if(web3.length == 1) return web3[0]
  let ret = web3[web3Index]
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