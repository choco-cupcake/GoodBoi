const { spawnSync } = require('child_process');
const path = require("path")
const fs = require("fs")
const Web3 = require("web3")
const mysql = require('./MysqlGateway');
const Utils = require('./Utils');
const rpcEndpoints = require("../data/rpcEndpoints")
const TMP_PATH = "tmp/tmp_pvt_vars_read"

async function getPrivateVars(conn, contractID, contractFiles, vars){
  await createTmpFolder()

  let contract = await mysql.getContractByID(conn, contractID)
  
  if(!contractFiles)
    contractFiles = await mysql.getContractFiles(conn, contractID, contract.address, contract.chain)

  // download contract to temporary folder (restructure /temp/analysis /temp/privatevars)
  let path = Utils.preparePath(contractFiles, contract.contractName, true, TMP_PATH)

  // get solc path
  let solcPath = Utils.getSolcPath(contract.compilerVersion)

  // run slither and get json result
  let resultPath = executeSlitherReadStorage(path.workingPath, path.analysisPath, contract.contractName, solcPath)


  let storageLayout = readResults(resultPath)

  if(!storageLayout)
    return null

  for(let _var of vars){
    // get variable slot,size,offset
    let varObj = storageLayout[_var.name]
    if(!varObj){
      console.log("Warning, variable " + _var.name + " not found")
    }

    // get random RPC
    let web3 = getWeb3(contract.chain)

    // read block
    let slot
    try{
      slot = await web3.eth.getStorageAt(contract.address, varObj.slot)
      if(slot.length != 66){ // 64 + "0x"
        console.log("ERROR - slot value of unexpected length " + slot.length)
        continue
      }
    } catch(e){continue}

    let charSize = varObj.size / 4
    let charOffset = varObj.offset / 4

    // cut address
    let address = "0x" + slot.substring(slot.length - charOffset - charSize, slot.length - charOffset)

    _var["val"] = address
  }

  fs.rmSync(path.workingPath, { recursive: true, force: true })
  fs.rmSync(resultPath)

  return vars
}

function readResults(resultsPath){
  if(!fs.existsSync(resultsPath))
    return null
  let raw = fs.readFileSync(resultsPath, { encoding: 'utf8', flag: 'r' })
  try{
    return JSON.parse(raw)
  }
  catch(e){
    return null
  }
}

function executeSlitherReadStorage(workingPath, analysisPath, contractName, solcPath){
  let jsonPath = generateJsonPath()
  let slitherParams = ['-m', 'slither.tools.read_storage.__main__', analysisPath, '--contract-name', contractName, '--solc', solcPath, "--json", path.resolve(jsonPath)]
  // run slither
  try{
    spawnSync('python3', slitherParams, {cwd: workingPath, timeout: 30000}); 
  }catch(e){ 
    return null
  }

  return jsonPath
}

function generateJsonPath(){
  let filepath
  do{
    let filename = Utils.makeid(15) + ".json"
    filepath = path.join("./", TMP_PATH, filename)
  }while(fs.existsSync(filepath))
  return filepath
}

async function createTmpFolder(){ 
  const tmpFolderPath = path.join("./", TMP_PATH)
  if (!fs.existsSync(tmpFolderPath)){
    fs.mkdirSync(tmpFolderPath, { recursive: true });
  }
  else await Utils.emptyFolder(tmpFolderPath)
}

function getWeb3(chain){
  let _endpoints = rpcEndpoints[chain]
  let web3Index = getRandomInt(0, _endpoints.length - 1)
  let endp = _endpoints[web3Index]
  return new Web3(endp)
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {getPrivateVars}