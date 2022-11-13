const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process');
const { Worker } = require('worker_threads');
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');

const slitherInstances = process.env.SLITHER_INSTANCES
const poolSize = slitherInstances * 20
let mysqlConn
let filling = false // concurrency lock pool fill
let contractPool = []
let analyzedCounter = 0
let detectorsOfInterest

launchAnalysis(require("../data/slither_detectors").detectors_slither_high)

async function launchAnalysis(_detectorsOfInterest){ 
  detectorsOfInterest = _detectorsOfInterest
  mysqlConn = await mysql.getDBConnection()
  await fillPool()
  createAnalysisFolder()
  for(let i=0; i < slitherInstances; i++){
    await launchWorker()
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
  console.log("#" + analyzedCounter + " start")
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
    await fillPool()
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
    console.log("#" + contract.ID + " done")
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
  if(contractPool.length < 0.2 * poolSize && !filling){
    filling = true
    console.log("============================== POOL REFRESH ======")
    let newPool = await mysql.getBatchToAnalyze(mysqlConn, poolSize)
    contractPool.length = 0
    for(let c of newPool)
      contractPool.push(c)
    filling = false
  }
}

function preparePath(files){
  let foldername, folderpath
  do{
    foldername = Utils.makeid(15)
    folderpath = path.join("tmp_analysis", foldername)
  }while(fs.existsSync(folderpath))
  fs.mkdirSync(folderpath)
  for(let f of files)
    fs.writeFileSync(path.join(folderpath, f.name), f.sourceText, {flag: 'w'});
  return folderpath
}
