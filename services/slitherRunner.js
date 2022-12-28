const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process');
const { Worker } = require('worker_threads');
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');
const Detectors = require('../data/slither_detectors');

const slitherInstances = process.env.SLITHER_INSTANCES
const poolSize = slitherInstances * 100
let mysqlConn
let filling = false // concurrency lock pool fill
let contractPool = []
let analyzedCounter = 0
let detectorsOfInterest, chain, minUsdValue, compilerVersionInt
let endOfResults = false
let activeWorkers = 0

launchAnalysis()

async function launchAnalysis(_chain, _minUsdValue, _compilerVersion){ 
  mysqlConn = await mysql.getDBConnection()
  detectorsOfInterest = await getActiveDetectors()
  chain = _chain || 'all'
  minUsdValue = _minUsdValue || 0
  compilerVersionInt = _compilerVersion || '0.8'

  // todo set solc version based on compilerVersionInt

  await fillPool()
  createAnalysisFolder()
  for(let i=0; i < slitherInstances; i++){
    await launchWorker()
    activeWorkers++
    await Utils.sleep(100)
  }
}

async function createAnalysisFolder(){ // buffer to write .sol file to feed slither
  const tmpFolderPath = "./tmp_analysis"
  if (!fs.existsSync(tmpFolderPath)){
    fs.mkdirSync(tmpFolderPath);
  }
  else await Utils.emptyFolder(tmpFolderPath)
}

async function getActiveDetectors(){
  let allDetectors = Detectors.detectors_slither_high.concat(Detectors.custom_detectors)
  let analysisColumn = (await mysql.getSlitherAnalysisColumns(mysqlConn)).map(e => 
    e.COLUMN_NAME.toLowerCase()
    )
  for(let detector of allDetectors){
    if(!analysisColumn.includes(detector.toLowerCase())){
      // add database column if missing (new detector just added)
      await mysql.addSlitherAnalysisColumns(mysqlConn, detector)
    }
  }
  return allDetectors
}

async function launchWorker(){
  analyzedCounter++
  console.log("#" + analyzedCounter + " start")
  let contract = await contractPool.pop()
  let folderpath = preparePath(contract.files)
  _launchWorker(contract, folderpath)
}

async function workerCleanup(toClean){
  if(toClean?.output?.success){
    console.log("Analysis of contract ID=" + toClean.contractID + " successfully finished")
    await mysql.insertFindingsToDB(mysqlConn, toClean.contractID, toClean.output)
  }
  else{
    console.log("Analysis of contract ID=" + toClean.contractID + " resulted in an ERROR")
    await mysql.markContractAsErrorAnalysis(mysqlConn, toClean.contractID)
  }
  await Utils.deleteFolder(toClean.folderpath)
  if(!contractPool.length){
    if(endOfResults){
      if(activeWorkers == 1)
        console.log("Analysis done")
      activeWorkers--
      return
    }
    await fillPool()
  }
  launchWorker()
}

function _launchWorker(contract, folderpath){
  let _toClean = {folderpath: folderpath, contractID: contract.ID}
  let w = new Worker('./workers/slitherWorker.js', { 
    workerData: { 
      folderpath: path.join(folderpath, '.'), 
      detectors: contract.detectors
    }
  })
  w.on('error', (err) => { console.log(err.message); });
  w.on('exit', () => {
    console.log("#" + contract.ID + " done")
    workerCleanup(_toClean)
  })
  w.on('message', (msg) => {
    _toClean['output'] = msg
  });
}


async function fillPool(){
  filling = true
  let newPool = await mysql.getBatchToAnalyze(mysqlConn, poolSize, chain, minUsdValue, compilerVersionInt, detectorsOfInterest)
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
    fs.writeFileSync(path.join(folderpath, f.filename), fixPragma(f.sourceText), {flag: 'w'});
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
      let ver = lineClean.substring(pragma_patt.length).replaceAll(">","").replaceAll(">","").replaceAll("=","").replaceAll(";","").replaceAll("^","").trim()
      if(ver.includes(" "))
        ver = ver.split(" ")[0]
      line = pragma_patt + '>' + ver + ' <0.9.0;'
    }
    processed += line + "\n"
  }
  return processed
}

module.exports = {launchAnalysis}