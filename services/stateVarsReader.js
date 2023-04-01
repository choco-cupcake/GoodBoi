const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');
const Web3 = require("web3")
const { program } = require('commander');
const aggregatorABI = '[{"inputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"}],"internalType":"struct GetValueAggregator.InputObj[]","name":"input","type":"tuple[]"}],"name":"getMappingValue","outputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"},{"internalType":"address[]","name":"readVal","type":"address[]"}],"internalType":"struct GetValueAggregator.OutputMappingObj[]","name":"","type":"tuple[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"}],"internalType":"struct GetValueAggregator.InputObj[]","name":"input","type":"tuple[]"}],"name":"getVarValue","outputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"},{"internalType":"address","name":"readVal","type":"address"}],"internalType":"struct GetValueAggregator.OutputVariableObj[]","name":"","type":"tuple[]"}],"stateMutability":"nonpayable","type":"function"}]'
const maxReadsPerTx = process.env.MAX_READS_PER_TX
const parallelCrawlers = process.env.STATE_VARS_PARALLEL_CRAWLERS
const batchLen = process.env.STATE_VARS_BATCH_LEN
let aggregatorContract = [] 
let web3Index = 0
let web3 = []

let callsPerformed = 0
let readContracts = 0

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
  contractPool = await mysql.getBatchVarsToRead(dbConn, cliOptions.chain)
  let start = Date.now()
  if(contractPool.length){
    refillInterval = setInterval(checkAndFill, 1500)
    await refreshVarsValues()
  }
  else 
    console.log("All variables are up to date. Return")
  console.log("loop done")
	let toWait = process.env.STATE_VARS_RUN_INTERVAL_HOURS * 60 * 60 * 1000 - (Date.now() - start) // 1 hour - elapsed
	if(toWait > 0){
		await Utils.sleep(toWait)
	}
	main()
}

function bootstrapWeb3(){
  let priceAggregatorAddress = process.env["STATE_VARS_AGGREGATOR_" + cliOptions.chain]
  for(let endp of rpcEndpoints){
    web3.push(new Web3(endp))
    aggregatorContract.push(new web3[web3.length - 1].eth.Contract(JSON.parse(aggregatorABI), priceAggregatorAddress))
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
    let varsCalls = []
    let arrCalls = []
    let mapCalls = []
    let contractsWIP = []
    let _contractsWIP = []
    while(contractPool.length && varsCalls.length < maxReadsPerTx && (mapCalls.length * 5) < maxReadsPerTx  && (arrCalls.length * 5) < maxReadsPerTx ){ // (mapCalls.length * 5) bc we check the first 5 indexes of the uint=>addr mappings
      let contract = contractPool.pop()
      let varObj = JSON.parse(contract.addressVars)
      _contractsWIP.push({cID: contract.ID, varObj: varObj, varObjRaw: contract.addressVars})
      // address vars
      for(let addrVar of varObj.SAV.filter(e => {return Utils.isVarAllowed(e.name)})){
        let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "()")
        varsCalls.push([contract.address, getterSignature])
        contractsWIP.push({type: 'var', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
      }
      // address arrays
      for(let addrVar of varObj.SAA.filter(e => {return Utils.isVarAllowed(e.name)})){
        let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "(uint256)")
        arrCalls.push([contract.address, getterSignature])
        contractsWIP.push({type: 'arr', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
      }
      // (uint => address) mappings
      for(let addrVar of varObj.SAM.filter(e => {return Utils.isMapAllowed(e.name)})){
        let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "(" + addrVar.uintSize + ")")
        mapCalls.push([contract.address, getterSignature])
        contractsWIP.push({type: 'map', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
      }
    }

    // call aggregator contract
    let varsResponse = [], arrResponse = [], mapResponse = []
    if(varsCalls.length){
      let _varsResponse = await callContract("getVarValue", varsCalls)
      if(!_varsResponse){ // a call is failing, gotta identify it from the batch
        for(vc of varsCalls){
          _varsResponse = await callContract("getVarValue", [vc])
          if(_varsResponse)
            varsResponse.push(_varsResponse)
          else{
            console.log("Found bad call, set as 0x0")
            varsResponse.push([vc[0], vc[1], "0x0"]) // crafted response
          }
        }
      }
      else
        varsResponse = _varsResponse
    }
    if(mapCalls.length){
      let _mapResponse = await callContract("getMappingValue", mapCalls)
      if(!_mapResponse){ // a call is failing, gotta identify it from the batch
        for(mp of mapCalls){
          _mapResponse = await callContract("getMappingValue", [mp])
          if(_mapResponse)
            mapResponse.push(_mapResponse)
          else{
            console.log("Found bad call, set as []")
            mapResponse.push([mp[0], mp[1], []])
          }
        }
      }
      else
        mapResponse = _mapResponse
    }
    if(arrCalls.length){
      let _arrResponse = await callContract("getMappingValue", arrCalls)
      if(!_arrResponse){ // a call is failing, gotta identify it from the batch
        for(ac of arrCalls){
          _arrResponse = await callContract("getMappingValue", [ac])
          if(_arrResponse)
          arrResponse.push(_arrResponse)
          else{
            console.log("Found bad call, set as []")
            arrResponse.push([ac[0], ac[1], []])
          }
        }
      }
      else
      arrResponse = _arrResponse
    }

    // parse results
    for(vr of [...varsResponse, ...mapResponse, ...arrResponse]){
      if(!vr || vr.length != 3 || !vr[0] || !vr[1] || !vr[2])
        continue
      for(cw of contractsWIP){
        if(cw.cAddr.toLowerCase() == vr[0].toLowerCase() && cw.sig == vr[1]){
          let vName = cw.varName
          let vVal = cleanNullAddress(vr[2])
          for(let i=0; i< _contractsWIP.length; i++){
            if(_contractsWIP[i].cID == cw.cID){
              if(cw.type == 'map'){
                for(let j=0; j<_contractsWIP[i].varObj.SAM.length; j++){
                  if(_contractsWIP[i].varObj.SAM[j].name == vName){
                    _contractsWIP[i].varObj.SAM[j].val = vVal
                    break
                  }
                }
              } else if(cw.type == 'var'){
                for(let j=0; j<_contractsWIP[i].varObj.SAV.length; j++){
                  if(_contractsWIP[i].varObj.SAV[j].name == vName){
                    _contractsWIP[i].varObj.SAV[j].val = vVal
                    break
                  }
                }
              } else if(cw.type == 'arr'){
                for(let j=0; j<_contractsWIP[i].varObj.SAA.length; j++){
                  if(_contractsWIP[i].varObj.SAA[j].name == vName){
                    _contractsWIP[i].varObj.SAA[j].val = vVal
                    break
                  }
                }
              }
              else{
                console.log("dafuq inspect")
                process.exit()
              }
              break
            }
          }
          break
        }
      }
    }

    // update database values
    for(let _cw of _contractsWIP){
      let toWrite = JSON.stringify(_cw.varObj)
      await mysql.updateAddressVars(dbConn, _cw.cID, toWrite, toWrite != _cw.varObjRaw)
      readContracts++
      if(readContracts % 500 == 0)
        console.log("calls: " + callsPerformed + " - contracts read: " + readContracts)
    }
  }
}

async function callContract(method, calls){
  let fail = 0
  while(fail < aggregatorContract.length){ // try all rpc
    try{
      return await getContractRoundRobin().methods[method](calls).call()
    } catch(e){
      fail++
      console.log("FAILED, fails: " + fail)
    }
  }
  return null
}

function cleanNullAddress(addr){
  if(Array.isArray(addr)){
    let ret = []
    for(let a of addr)
      if(a != "0x0000000000000000000000000000000000000000")
        ret.push(a)
    return ret
  }
  return addr == "0x0000000000000000000000000000000000000000" ? "0x0" : addr
}
async function checkAndFill() {
	if(contractPool.length < parallelCrawlers * 50){ // margin for concurrency
    contractPool = await mysql.getBatchVarsToRead(dbConn, cliOptions.chain)
    if(contractPool.length < batchLen){
      clearInterval(refillInterval)
    }
  }
}

function getContractRoundRobin(){ // round robin
  callsPerformed++
  if(aggregatorContract.length == 1) return aggregatorContract[0]
  let ret = aggregatorContract[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}