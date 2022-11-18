const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process');
const { Worker } = require('worker_threads');
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');

const slitherInstances = process.env.SLITHER_INSTANCES
const poolSize = slitherInstances * 100
let mysqlConn
let filling = false // concurrency lock pool fill
let contractPool = []
let analyzedCounter = 0
let detectorsOfInterest, chain, minUsdValue
let endOfResults = false
let activeWorkers = 0

async function launchAnalysis(_detectorsOfInterest, _chain, _minUsdValue){ 
  detectorsOfInterest = _detectorsOfInterest
  chain = _chain
  minUsdValue = _minUsdValue
  mysqlConn = await mysql.getDBConnection()
  await fillPool()
  createAnalysisFolder()
  for(let i=0; i < slitherInstances; i++){
    await launchWorker()
    activeWorkers++
    await Utils.sleep(100)
  }
}

function createAnalysisFolder(){ // buffer to write .sol file to feed slither
  if (!fs.existsSync("./tmp_analysis")){
    fs.mkdirSync("./tmp_analysis");
  }
}

async function launchWorker(toClean = null){
  analyzedCounter++
  //console.log("#" + analyzedCounter + " start")
  if(toClean){
    if(toClean.error){
      await mysql.markContractAsErrorAnalysis(mysqlConn, toClean.contractID)
    }
    else{
      if(toClean.contractID){ // if not, analysis somehow crashed
        await mysql.insertFindingsToDB(mysqlConn, toClean.contractID, toClean.findings)
      }
    }
    await deleteFolder(toClean.folderpath)
    if(!contractPool.length){
      if(endOfResults){
        if(activeWorkers == 1)
          console.log("Analysis done")
        activeWorkers--
        return
      }
      await fillPool()
    }
  }
  let contract = await contractPool.pop()
  let folderpath = preparePath(contract.files)
  _launchWorker(contract, folderpath)
}

function _launchWorker(contract, folderpath){
  let _toClean = {folderpath: folderpath}
  let w = new Worker('./workers/slitherWorker.js', { 
    workerData: { 
      folderpath: path.join(folderpath, contract.files[0].name), 
      detectors: detectorsOfInterest
    }
  })
  w.on('error', (err) => { console.log(err.message); });
  w.on('exit', () => {
    //console.log("#" + contract.ID + " done")
    launchWorker(_toClean)
  })
  w.on('message', (msg) => {
    _toClean['contractID'] = contract.ID
    if(msg.error){ 
      console.log("Worker error: " + msg.error)
      _toClean['error'] = msg.error
    }
    else{
      _toClean['findings'] = msg
    }
  });
}

async function deleteFolder(folder){
  try {
    await fs.promises.rm(folder, { recursive: true })
  } catch(e) {
    console.log(e)
  } 
}

async function fillPool(){
  filling = true
  let newPool = await mysql.getBatchToAnalyze(mysqlConn, poolSize, chain, minUsdValue, detectorsOfInterest)
  endOfResults = newPool.eor
  contractPool.length = 0
  for(let c of newPool.data)
    contractPool.push(c)
  filling = false
}

function preparePath(files){
  let foldername, folderpath
  do{
    foldername = Utils.makeid(15)
    folderpath = path.join("tmp_analysis", foldername)
  }while(fs.existsSync(folderpath))
  fs.mkdirSync(folderpath)
  for(let f of files)
    fs.writeFileSync(path.join(folderpath, f.name), fixPragma(f.sourceText), {flag: 'w'});
  return folderpath
}


// NOTE: this function stays here (inefficient, once per analysis) bc im not sure about the side effects (might mess up other cases) so i dont want to make the db dirty (imports cleaning instead is on sourceGetter side) #WIP
function fixPragma(source){ // replaces pragma x with pragma ^x to solve compilation errors by slither. pre fail rate = 0.2 post fail rate= 0.13
  const pragma_patt = "pragma solidity "
  let processed = ''
  let lines = source.split("\n")
  for(let line of lines){
    let lineClean = line.trim().toLowerCase()
    if(lineClean.substring(0, pragma_patt.length) == pragma_patt){
      let ver = lineClean.substring(pragma_patt.length).replaceAll(">","").replaceAll(">","").replaceAll("=","").trim()
      if(ver.includes(" "))
        ver = ver.split(" ")[0]
      if(ver.charAt(0) != "^"){
        line = pragma_patt + '^' + ver
      }
    }
    processed += line + "\n"
  }
  return processed
}

module.exports = {launchAnalysis}