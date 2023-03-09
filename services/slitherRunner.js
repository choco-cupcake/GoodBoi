const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process');
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
let failedCounter = 0
let detectorsOfInterest, chain, minUsdValue
let endOfResults = false
let activeWorkers = 0
let startTime

launchAnalysis('all', 1000)

async function launchAnalysis(_chain, _minUsdValue){ 
  mysqlConn = await mysql.getDBConnection()
  detectorsOfInterest = await getActiveDetectors()
  chain = _chain || 'all'
  minUsdValue = _minUsdValue || 0

  await fillPool()
  createAnalysisFolder()
  startTime = Date.now()
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
  let allDetectors = Detectors.detectors_slither_high.concat(Detectors.custom_detectors).concat(Detectors.detectrs_slither_badcode)
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
  let contract = await contractPool.pop()
  let solcPath = getSolcPath(contract.files[0].compilerVersion)
  let folderpath = preparePath(contract.files)
  _launchWorker(contract, folderpath, solcPath)
}

function logStatus(id, elapsedSlither){// #XXX start - speed: 78apm - avg analysis time: 1234ms - in 24h:
  let elapsedTotal = Date.now() - startTime
  let speed_apm = Math.floor(analyzedCounter / (elapsedTotal / 1000 / 60)) // apm = analysis per minute
  let avgtime = Math.floor(elapsedTotal / analyzedCounter)
  let in24h = Math.floor(24 * 60 * 60 * 1000 / avgtime)
  let errorRate = Math.floor(failedCounter * 10000 / analyzedCounter) / 100
  console.log("#" + id + " done - took " + elapsedSlither + "ms  -  speed: " + speed_apm + "apm  -  in 24h: " + in24h + "  -  error rate: " + errorRate + "%")

}

function getSolcPath(compVer){
  let solcVer = compVer.split("+")[0].substring(1)
  let solcFiles = fs.readdirSync("./solc-bin/windows-amd64")
  //solc-windows-amd64-v0.4.7+commit.822622cf.exe
  for(let f of solcFiles){
    let fVer = f.split("+")[0].substring("solc-windows-amd64-v".length)
    if(fVer == solcVer)
      return path.resolve("./solc-bin/windows-amd64/" + f)
  }
  return null
}

async function workerCleanup(toClean){
  if(toClean?.elapsed){
    logStatus(toClean.contractID, toClean.elapsed)
  }
  if(toClean?.output?.success){
    await mysql.insertFindingsToDB(mysqlConn, toClean.sourcefile_signature, toClean.output)
  }
  else{
    failedCounter++
    console.log("Analysis of contract ID=" + toClean.contractID + " resulted in an ERROR:", toClean?.output?.error)
    let _error = parseAnalysisError(toClean?.output?.error)
    await mysql.markContractAsErrorAnalysis(mysqlConn, toClean.sourcefile_signature, false, _error)
  }
  await Utils.deleteFolder(toClean.folderpath.workingPath)
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

function parseAnalysisError(err){
  if(!err) return "NO_ERROR_MESSAGE"
  let knownErrors = [
    {extract: "Source file requires different compiler version", code: "COMPILER_VERSION"},
    {extract: "Invalid solc compilation Compiler error: Stack too deep.", code: "STACK_TOO_DEEP"},
    {extract: "Python310\\site-packages\\slither\\detectors\\custom\\", code: "CUSTOM_DETECTOR_FAIL"},
    {extract: "crytic_compile.platform.exceptions.InvalidCompilation", code: "INVALID_COMPILATION"},
  ]
  for(let ke of knownErrors)
    if(err.includes(ke.extract))
      return ke.code
  return "UNCATEGORIZED_ERROR"
  
}

function _launchWorker(contract, folderpath, solcpath){
  let _toClean = {folderpath: folderpath, contractID: contract.ID, sourcefile_signature: contract.sourcefile_signature}
  let w = new Worker('./workers/slitherWorker.js', { 
    workerData: { 
      workingPath: folderpath.workingPath, 
      analysisPath: folderpath.analysisPath, 
      detectors: contract.detectors,
      solcpath: solcpath
    }
  })
  w.on('error', (err) => { console.log(err.message); });
  w.on('exit', () => {
    workerCleanup(_toClean)
  })
  w.on('message', (msg) => {
    _toClean['output'] = msg.output
    _toClean['elapsed'] = msg.elapsed
  });
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
  let foldername, folderpath, folders = new Set(), analysisDir = '.'
  do{
    foldername = Utils.makeid(15)
    folderpath = path.join("tmp_analysis", foldername)
  }while(fs.existsSync(folderpath))
  fs.mkdirSync(folderpath)
  for(let f of files){
    let writePath = path.join(folderpath, f.filename)

    // clean leading '/'
    if(f.filename.substring(0,1) == '/') f.filename = f.filename.substring(1)

    let struct = f.filename.split("/")
    let outpath = folderpath
    if(struct.length > 1){
      // add all layers folders
      for(let j=0; j< struct.length - 1; j++)
        folders.add(struct.slice(0, j+1).join("/"))
      outpath = f.filename.substring(0, f.filename.length - struct[struct.length - 1].length - 1)
      outpath = path.join(folderpath, outpath)
      fs.mkdirSync(outpath, { recursive: true });
      writePath = path.join(outpath, struct[struct.length - 1])
    }
    fs.writeFileSync(writePath, fixPragma(f.sourceText, f.compilerVersion), {flag: 'w+'});
  }
  folders = Array.from(folders)
  folders.sort(function(a, b) { // inspect higher level first
    return (a.match(/\//g) || []).length - (b.match(/\//g) || []).length
  })
  if(folders.length){
    // find the master contract folder and append it to folderpath
    analysisDir = getMasterFolder(folders)
    if(!analysisDir.length){
      console.log("WARNING - can't find master folder") 
      analysisDir = "." // will throw an error at analysis time
    }
  }
  return {workingPath: folderpath, analysisPath: analysisDir}
}

function getMasterFolder(folders){
  const patterns = ["contracts", "deploy", "src"]
  // exact match
  for(let patt of patterns){
    for(let folder of folders){
      let folderName = folder.split("/").at(-1)
      if(folderName.substring(0, patt.length) == patt)
        return folder
    }
  }
  // partial match
  for(let patt of patterns){
    for(let folder of folders){
      let folderName = folder.split("/").at(-1)
      if(folderName.includes(patt))
        return folder
    }
  }
  return ""
}

// replace the current pragma line with the compiler version used to verify the source code
// don't ask me why, even used the same compiler version used by etherscan/bscscan/polygonscan, I still have solc versions compilation issues around
function fixPragma(source, compilerVer){ 
  const pragma_patt = "pragma solidity "
  let processed = ''
  let lines = source.split("\n")
  for(let line of lines){
    let lineClean = line.trim().toLowerCase()
    if(lineClean.substring(0, pragma_patt.length) == pragma_patt){
      try{
        let ver = compilerVer.split("+")[0].substring(1)
        line = pragma_patt + '>=' + ver + ';'
      }
      catch(e){ 
        console.log("WARNING Error processing pragma line in fixPragma")
        continue;
      }
    }
    processed += line + "\n"
  }
  return processed
}

module.exports = {launchAnalysis}