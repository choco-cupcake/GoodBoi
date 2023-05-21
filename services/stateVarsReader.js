const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');
const PrivateVarsReader = require('../utils/privateVarReader');
const BigNumber = require('bignumber.js');
const Web3 = require("web3")
const { program } = require('commander');
const aggregatorABI = '[{"inputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"}],"internalType":"struct GetValueAggregator.InputObj[]","name":"input","type":"tuple[]"}],"name":"getMappingValue","outputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"},{"internalType":"address[]","name":"readVal","type":"address[]"}],"internalType":"struct GetValueAggregator.OutputMappingObj[]","name":"","type":"tuple[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"}],"internalType":"struct GetValueAggregator.InputObj[]","name":"input","type":"tuple[]"}],"name":"getVarValue","outputs":[{"components":[{"internalType":"address","name":"contractAddress","type":"address"},{"internalType":"bytes4","name":"getterSelector","type":"bytes4"},{"internalType":"address","name":"readVal","type":"address"}],"internalType":"struct GetValueAggregator.OutputVariableObj[]","name":"","type":"tuple[]"}],"stateMutability":"nonpayable","type":"function"}]'
const flaggerABI = '[{"inputs": [{"components": [{"internalType": "address","name": "_contract","type": "address"},{"internalType": "address[]","name": "internalAddresses","type": "address[]"}],"internalType": "struct PolygonFlagger.Input[]","name": "contracts","type": "tuple[]"},{"internalType": "uint256","name": "minPoolWeth","type": "uint256"}],"name": "areInterestingContract","outputs": [{"components": [{"internalType": "address","name": "_contract","type": "address"},{"internalType": "uint8","name": "flag","type": "uint8"}],"internalType": "struct PolygonFlagger.Output[]","name": "","type": "tuple[]"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "inpAddr","type": "address"},{"internalType": "uint256","name": "minPoolWeth","type": "uint256"}],"name": "hasPool","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "inpAddr","type": "address"},{"internalType": "uint256","name": "minPoolWeth","type": "uint256"}],"name": "hasPoolQuickswap","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "inpAddr","type": "address"}],"name": "hasPoolUniV3","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "inpAddr","type": "address"}],"name": "isERC20","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "mainContract","type": "address"},{"internalType": "address[]","name": "internalAddresses","type": "address[]"},{"internalType": "uint256","name": "minPoolWeth","type": "uint256"},{"internalType": "uint256","name": "_gasMargin","type": "uint256"}],"name": "isInterestingContract","outputs": [{"internalType": "uint8","name": "","type": "uint8"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "inpAddr","type": "address"},{"internalType": "uint256","name": "minPoolWeth","type": "uint256"}],"name": "isPool","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "pool","type": "address"},{"internalType": "uint256","name": "minPoolWeth","type": "uint256"}],"name": "isPoolQuickswap","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "poolAddr","type": "address"}],"name": "isUniswapV3Pool","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "nonpayable","type": "function"},{"anonymous": false,"inputs": [{"indexed": true,"internalType": "address","name": "previousOwner","type": "address"},{"indexed": true,"internalType": "address","name": "newOwner","type": "address"}],"name": "OwnershipTransferred","type": "event"},{"inputs": [],"name": "renounceOwnership","outputs": [],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "uint256","name": "gm","type": "uint256"}],"name": "setGasMargin","outputs": [],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "address","name": "newOwner","type": "address"}],"name": "transferOwnership","outputs": [],"stateMutability": "nonpayable","type": "function"},{"inputs": [],"name": "owner","outputs": [{"internalType": "address","name": "","type": "address"}],"stateMutability": "view","type": "function"}]'
const maxReadsPerTx = process.env.MAX_READS_PER_TX
let WETHPrice, minPoolWETH
let aggregatorContract = [] 
let flaggerContract = [] 
let web3IndexLastLoop = 0
let web3Index = 0
let web3 = []

let callsPerformed = 0
let readContracts = 0
let flaggedCount = 0

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
    await getWETHPrice()
    contractPool = await mysql.getBatchVarsToRead(dbConn, chain)
    let start = Date.now()
    if(contractPool.length){
      await refreshVarsValues()
    }
    else 
      console.log("All variables are up to date. Return")
    console.log("loop done")
    let toWait = process.env.STATE_VARS_RUN_INTERVAL_HOURS * 60 * 60 * 1000 - (Date.now() - start) // 1 hour - elapsed
    if(toWait > 0){
      await Utils.sleep(toWait)
    }
  }
}

async function getWETHPrice(){
  let ERC20PricesCached = JSON.parse(await mysql.getFromCache(dbConn,"ERC20_" + chain))
  WETHPrice = ERC20PricesCached[0].USD_price
  minPoolWETH = new BigNumber(process.env.FLAGGER_CONTRACT_MIN_POOL_USD).times(new BigNumber(10).exponentiatedBy(ERC20PricesCached[0].decimals)).div(WETHPrice).toFixed(0) // only used for UniV2 pools
}

function bootstrapWeb3(){
  const varsReaderAddress = require("../data/smart_contracts")["varsReader"][chain]
  const flaggerAddress = require("../data/smart_contracts")["flagger"][chain]
  for(let endp of rpcEndpoints){
    web3.push(new Web3(endp))
    aggregatorContract.push(new web3[web3.length - 1].eth.Contract(JSON.parse(aggregatorABI), varsReaderAddress))
    flaggerContract.push(new web3[web3.length - 1].eth.Contract(JSON.parse(flaggerABI), flaggerAddress))
  }
}

async function refreshVarsValues(){ 
  console.log("Vars values update started")
	await refreshBatch() 
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
      let varObj = contract.addressVars == "NULL" || !contract.addressVars ? null : JSON.parse(contract.addressVars)
      let implVarObj = contract.implVars == "NULL" || !contract.implVars ? null : JSON.parse(contract.implVars)
      _contractsWIP.push({cID: contract.ID, contractAddress: contract.address, varObj: varObj, varObjRaw: contract.addressVars, implVarObj: implVarObj, implVarObjRaw: contract.implVars, pvtAddrVars: [], implPvtAddrVars: []})
      // ==== addressVars
      if(varObj){
        // address vars
        for(let addrVar of varObj.SAV.filter(e => {return Utils.isVarAllowed(e.name)})){
          if(addrVar.vsb == "pvt"){
            _contractsWIP.at(-1).pvtAddrVars.push(addrVar)
            continue
          }
          let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "()")
          varsCalls.push([contract.address, getterSignature])
          contractsWIP.push({isImpl: false, type: 'var', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
        }
        // address arrays
        for(let addrVar of varObj.SAA.filter(e => {return Utils.isVarAllowed(e.name)})){
          let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "(uint256)")
          arrCalls.push([contract.address, getterSignature])
          contractsWIP.push({isImpl: false, type: 'arr', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
        }
        // (uint => address) mappings
        for(let addrVar of varObj.SAM.filter(e => {return Utils.isMapAllowed(e.name)})){
          let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "(" + addrVar.uintSize + ")")
          mapCalls.push([contract.address, getterSignature])
          contractsWIP.push({isImpl: false, type: 'map', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
        }
      }
      // ==== implAddressVars
      if(implVarObj){
        // address vars
        for(let addrVar of implVarObj.SAV.filter(e => {return Utils.isVarAllowed(e.name)})){
          if(addrVar.vsb == "pvt"){
            _contractsWIP.at(-1).implPvtAddrVars.push(addrVar)
            continue
          }
          let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "()")
          varsCalls.push([contract.address, getterSignature])
          contractsWIP.push({isImpl: true, type: 'var', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
        }
        // address arrays
        for(let addrVar of implVarObj.SAA.filter(e => {return Utils.isVarAllowed(e.name)})){
          let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "(uint256)")
          arrCalls.push([contract.address, getterSignature])
          contractsWIP.push({isImpl: true, type: 'arr', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
        }
        // (uint => address) mappings
        for(let addrVar of implVarObj.SAM.filter(e => {return Utils.isMapAllowed(e.name)})){
          let getterSignature = web3[0].eth.abi.encodeFunctionSignature(addrVar.name + "(" + addrVar.uintSize + ")")
          mapCalls.push([contract.address, getterSignature])
          contractsWIP.push({isImpl: true, type: 'map', cAddr: contract.address, cID: contract.ID, varName: addrVar.name, sig: getterSignature}) // to link back results from contract calls
        }
      }
    }

    // call aggregator contract
    let varsResponse = [], arrResponse = [], mapResponse = []
    if(varsCalls.length){
      let _varsResponse = await callContract("aggregator", "getVarValue", varsCalls)
      if(!_varsResponse){ // a call is failing, gotta identify it from the batch
        for(vc of varsCalls){
          _varsResponse = await callContract("aggregator", "getVarValue", [vc])
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
      let _mapResponse = await callContract("aggregator", "getMappingValue", mapCalls)
      if(!_mapResponse){ // a call is failing, gotta identify it from the batch
        for(mp of mapCalls){
          _mapResponse = await callContract("aggregator", "getMappingValue", [mp])
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
      let _arrResponse = await callContract("aggregator", "getMappingValue", arrCalls)
      if(!_arrResponse){ // a call is failing, gotta identify it from the batch
        for(ac of arrCalls){
          _arrResponse = await callContract("aggregator", "getMappingValue", [ac])
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
          let objName = cw.isImpl ? "implVarObj" : "varObj"
          for(let i=0; i< _contractsWIP.length; i++){
            if(_contractsWIP[i].cID == cw.cID){
              if(cw.type == 'map'){
                for(let j=0; j<_contractsWIP[i][objName].SAM.length; j++){
                  if(_contractsWIP[i][objName].SAM[j].name == vName){
                    _contractsWIP[i][objName].SAM[j].val = vVal
                    break
                  }
                }
              } else if(cw.type == 'var'){
                for(let j=0; j<_contractsWIP[i][objName].SAV.length; j++){
                  if(_contractsWIP[i][objName].SAV[j].name == vName){
                    _contractsWIP[i][objName].SAV[j].val = vVal
                    break
                  }
                }
              } else if(cw.type == 'arr'){
                for(let j=0; j<_contractsWIP[i][objName].SAA.length; j++){
                  if(_contractsWIP[i][objName].SAA[j].name == vName){
                    _contractsWIP[i][objName].SAA[j].val = vVal
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

    // now look for private variables to be read in a different way
    for(let _cw of _contractsWIP){
      _cwClone = JSON.parse(JSON.stringify(_cw))
      let toRead = [..._cwClone.pvtAddrVars.map(e => {e["impl"] = false; return e}), ..._cwClone.implPvtAddrVars.map(e => {e["impl"] = true; return e})]
      let vals = await PrivateVarsReader.getPrivateVars(dbConn, _cw.cID, null, toRead)
      if(vals && vals.length == _cw.pvtAddrVars.length + _cw.implPvtAddrVars.length){
        _cw.pvtAddrVars = vals.filter(e => !e.impl)
        _cw.implPvtAddrVars = vals.filter(e => e.impl)
        // move the retrieved values to the main object
        for (pvtVar of _cw.pvtAddrVars)
          for(let addrVar of _cw.varObj.SAV)
            if(addrVar.name == pvtVar.name)
              addrVar.val = pvtVar.val
        for (pvtVar of _cw.implPvtAddrVars)
          for(let addrVar of _cw.implVarObj.SAV)
            if(addrVar.name == pvtVar.name)
              addrVar.val = pvtVar.val
      }
    }
    
    // checks if contracts have to be flagged and updates the object
    await checkFlags(_contractsWIP)

    // update database values
    for(let _cw of _contractsWIP){
      let toWrite = _cw.varObj ? JSON.stringify(_cw.varObj) : null
      let toWriteImpl = _cw.implVarObj ? JSON.stringify(_cw.implVarObj) : null
      if(toWrite || toWriteImpl){
        await mysql.updateAddressVars(dbConn, _cw.cID, _cw.flag, toWrite, toWrite ? toWrite != _cw.implVarObjRaw : null, toWriteImpl, toWriteImpl ? toWriteImpl != _cw.implVarObjRaw : null)
        if(_cw.flag == '1')
          flaggedCount++
      }
      readContracts++
      if(readContracts % 10 == 0 || readContracts == _contractsWIP.length)
        console.log("calls: " + callsPerformed + " - contracts read: " + readContracts + " - contracts flagged: " + flaggedCount)
    }

    await checkAndFill()
  }
}

async function checkFlags(_contractsWIP){
  let calls = []

    // rechecks even if vars did not change
  for(let _cw of _contractsWIP){
    let internalAddresses = []
    if(_cw.varObj){ // "&& JSON.stringify(_cw.varObj) != _cw.varObjRaw" removed to take into account pool liquidity changes
      pushToInternalAddresses(_cw.varObj, internalAddresses)
    }
    if(_cw.implVarObj){ 
      pushToInternalAddresses(_cw.implVarObj, internalAddresses)
    }
    if(internalAddresses.length > 35){ // cap to 50 internal addresses
      internalAddresses = internalAddresses.slice(0, 50)
    }
    calls.push({contractAddr: _cw.contractAddress, internalAddresses: internalAddresses})
  }

  while(calls.length){
    // execute calls
    let callResponse = []
    let batch = [] // gasleft() contract feature not working ¯\_(ツ)_/¯
    let intCount = 0 // internal addresses checks are more expensive (isPool + hasPool vs hasPool)
    let maxAddrCount = chain == "ETH_MAINNET" ? 30 : 50 // currently using some crap rpc providers for ETH, gas limit is capped
    for(let c of calls){
      batch.push(c)
      intCount += c.internalAddresses.length + 1
      if(intCount * 3 + batch.length > maxAddrCount)
        break
    }
    let _callResponse = await callContract("flagger", "areInterestingContract", [callsToRawArray(batch), minPoolWETH])
    if(!_callResponse){ // a call is failing, gotta identify it from the batch
      for(let call of batch){
        _callResponse = await callContract("flagger", "areInterestingContract", [callsToRawArray([call]), minPoolWETH])
        if(_callResponse)
          callResponse.push(_callResponse[0])
        else{
          console.log("Found bad call, setting to flagged")
          callResponse.push([call.contractAddr, '1'])
        }
      }
    }
    else
      callResponse = _callResponse

    // parse results && update input object
    for(let i=callResponse.length - 1; i>=0; i--){ // downward bc we pop elements
      if(callResponse[i][1] == 2) // gas abort
        continue
      // assign flag to contracts and remove from calls list
      for(let _cw of _contractsWIP){
        if(_cw.contractAddress.toLowerCase() == callResponse[i][0].toLowerCase()){
          _cw['flag'] = callResponse[i][1]
        }
      }
      for(let j=0; j<calls.length; j++){
        if(calls[j].contractAddr.toLowerCase() == callResponse[i][0].toLowerCase()){
          calls.splice(j, 1); 
        }
      }
    }

  }

  // data consistency check
  for(let _cw of _contractsWIP){
    if(!_cw['flag']){
      console.log("======= Inspect - Could not find flag for contract") // even if no vars, contractAddress must be checked
      _cw['flag'] = 1
    }
  }

}

function callsToRawArray(callObj){
  let retCalls = []
  for(let co of callObj){
    retCalls.push([co.contractAddr, co.internalAddresses])
  }
  return retCalls
}

function pushToInternalAddresses(_varObj, internalAddresses){
  for(let sav of _varObj.SAV.filter(e => {return Utils.isVarAllowed(e.name) && e.val.length && e.val != "0x0"})){
    internalAddresses.push(sav.val)
  }
  for(let sam of _varObj.SAM.filter(e => {return Utils.isVarAllowed(e.name) && e.val.length && e.val != "0x0"})){
    for(let a of sam.val)
      internalAddresses.push(a)
  }
  for(let saa of _varObj.SAA.filter(e => {return Utils.isVarAllowed(e.name) && e.val.length && e.val != "0x0"})){
    for(let a of saa.val)
      internalAddresses.push(a)
  }
  
}

async function callContract(contract, method, params){
  let fail = 0
  while(fail < Math.min(4, aggregatorContract.length)){ // try all rpc
    try{
      if(contract == "aggregator")
        return await (await getAggregatorContractRoundRobin()).methods[method](params).call()
      else if(contract == "flagger"){
        if(Array.isArray(params))
          return await (await getFlaggerContractRoundRobin()).methods[method](...params).call()
        else
          return await (await getFlaggerContractRoundRobin()).methods[method](params).call()
      }
        
      else{
        console.log("unrecognized contract call - inspect issue")
        process.exit()
      }
    } catch(e){
      fail++
      console.log("Failed contract call " + contract + ":" + method + ", " + e.message + " - fails: " + fail)
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
	if(contractPool.length < maxReadsPerTx * 50){ // margin for concurrency
    contractPool = await mysql.getBatchVarsToRead(dbConn, chain)
  }
}

async function getAggregatorContractRoundRobin(){ // round robin
  await loopWeb3SleepCheck()
  callsPerformed++
  if(aggregatorContract.length == 1) return aggregatorContract[0]
  let ret = aggregatorContract[web3Index]
  web3Index = ++web3Index % web3.length
  return ret
}

async function getFlaggerContractRoundRobin(){ // round robin
  await loopWeb3SleepCheck()
  callsPerformed++
  if(flaggerContract.length == 1) return flaggerContract[0]
  let ret = flaggerContract[web3Index]
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