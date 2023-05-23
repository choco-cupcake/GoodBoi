const path = require("path")
const fs = require("fs")
const Web3 = require("web3")
const mysql = require('./MysqlGateway');
const Utils = require('./Utils');
const TMP_PATH = "tmp/tmp_pvt_vars_read"

main()

async function main(){
  let dbConn = await mysql.getDBConnection()
  await getPrivateImmutableVars(dbConn, 2174583, null, [{name: "proxyRegistryAddress"}])
}

async function getPrivateImmutableVars(conn, contractID, contractFiles, vars){
  await createTmpFolder()

  let contract = await mysql.getContractByID(conn, contractID)
  
  if(!contractFiles)
    contractFiles = await mysql.getContractFiles(conn, contractID, contract.address, contract.chain)

  let success = preprocessSourceCode(contractFiles, contract.contractName, vars, contract.constructorArguments)
  if(!success)
    return vars

  // download contract to temporary folder (restructure /temp/analysis /temp/privatevars)
  let path = Utils.preparePath(contractFiles, contract.contractName, true, TMP_PATH)

  fs.rmSync(path.workingPath, { recursive: true, force: true })

  return vars
}

// Note: this approach misses situation where the immutable pvt var is contained in an inherited contract. 
// Won't expand the code to cover that case ad complexity skyrockets and it's a not so common scenario
function preprocessSourceCode(contractFiles, contractName, vars, deployConstructorArgs){
  // look for the right file to fix
  const breakingKeywords = ["function", "modifier", "receive", "fallback"]
  let header = "contract " + contractName
  let argsObj
  for(let k=0; k<contractFiles.length; k++){
    let cf = contractFiles[k]
    let inContract = false
    let inConstructor = false
    let lines = cf.sourceText.split("\n")
    for(let j=0; j<lines.length; j++){
      let l = lines[j].trim()
      let line = l.trim().split(";")[0].trim()
      if(!inContract){
        if(Utils.startsWith(line, header))
          inContract = true
      } else{
        if(!inConstructor){
          if(Utils.startsWith(line, "constructor")){
            // parse constructor args
            argsObj = getConstructorArgs(line)
            inConstructor = true
          }
        }
        else{
          // we are inside the constructor, check for assignment to imm vars
          for(let _var of vars){
            let assignRegex = new RegExp(_var.name + "(\\s)?=")
            if(line.match(assignRegex)){
              // get right side, get associated argsObj, add varName
              let rightSide = line.split("=").at(-1).trim()
              for(let i=0; i<argsObj.length; i++){
                if(rightSide.includes(argsObj[i].argName))
                  argsObj[i]['varName'] = _var.name
              }
            }
          }
          for(let bk of breakingKeywords){
            if(Utils.startsWith(line, bk))
              break
          }
        }
      }
    }
    if(inContract){
      break
    }
  }
  if(!argsObj)
    return null

  // scan argsObj, get associated construtorArgs
  const typesArray = argsObj.map(e => e.type)
  const namesArray = argsObj.map(e => e.varName)
  let decodedParams = new Web3().eth.abi.decodeParameters(typesArray, "0x" + deployConstructorArgs);
  for(_var of vars){ // if no vars found ok
    let varIndex = namesArray.indexOf(_var.name)
    _var['val'] = decodedParams[varIndex]
  }
  return vars
}

async function createTmpFolder(){ 
  const tmpFolderPath = path.join("./", TMP_PATH)
  if (!fs.existsSync(tmpFolderPath)){
    fs.mkdirSync(tmpFolderPath, { recursive: true });
  }
  else await Utils.emptyFolder(tmpFolderPath)
}

function getConstructorArgs(line){
  let argObj = []
  let _rawArgs = line.substring("constructor(".length).split(")")[0]
  let rawArgs = _rawArgs.split(",").map(e => e.trim())
  for(let rarg of rawArgs){
    let components = rarg.split(" ")
    argObj.push({type: components[0], argName: components.at(-1)})
  }
  return argObj
}

module.exports = {getPrivateImmutableVars}