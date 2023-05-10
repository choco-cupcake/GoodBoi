const os = require("os")
const fs = require('fs')
const path = require('path')
const { Worker } = require('worker_threads');
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');
const Detectors = require('../data/slither_detectors');
const { program } = require('commander');

program.option('--refilter <string>', 'detector to refilter (only analyzes this detector\'s previous hits');
program.option('--retryErrors', 'detector to refilter (only analyzes this detector\'s previous hits');
program.option('--chain <string>', 'chain to operate on');

program.parse();
const cliOptions = program.opts();
const chain = cliOptions.chain || 'all'

if(chain != 'all' && !Object.values(Utils.chains).includes(chain)){
  console.log("Unrecognized chain, abort.")
  process.exit()
}
console.log("Operating on chain: " + chain)

if(cliOptions.retryErrors){
  console.log("Retrying errored analysis")
  cliOptions.refilter = null
}

if(cliOptions.refilter)
  console.log("Refiltering detector: " + cliOptions.refilter)

const isWindows = os.platform() === 'win32'
const slitherInstances = process.env.SLITHER_INSTANCES
const poolSize = slitherInstances * 100
const INSTANCE_TIMEOUT = 120000
let mysqlConn
let contractPool = []
let analyzedCounter = 0
let failedCounter = 0
let detectorsOfInterest
let startTime
let isFilling = false
let instancesMonitor = new Array(slitherInstances)
let status = {dbEmpty: false, activeWorkers: 0}
let monitorTimer

launchAnalysis()

async function launchAnalysis(){ 
  mysqlConn = await mysql.getDBConnection()
  detectorsOfInterest = await getActiveDetectors()
  await analyzeAll()  
}

async function analyzeAll(){
  let noResults = await fillPool(true)
  if(noResults)
    return
  createAnalysisFolder()
  startTime = Date.now()
  setInterval(mysqlKeepAlive, 5000)
  for(let i=0; i < slitherInstances; i++){
    await launchWorker(i)
    status.activeWorkers++
    await Utils.sleep(100)
  }
  monitorTimer = setInterval(() => {monitorStuckInstances()}, 1000)
}

function evalEndLoop(){
  if(status.dbEmpty && !status.activeWorkers){
    if(cliOptions.refilter){
      console.log("Refilter done")
      process.exit()
    }
    console.log("Database empty, restart in 2 mins")
    if(monitorTimer)
      clearInterval(monitorTimer)
    status.dbEmpty = false
    setTimeout(() => {analyzeAll()}, 2 * 60 * 1000) // 2 mins
    return true
  }
  return false
}

async function mysqlKeepAlive(){
  await mysql.keepAlive(mysqlConn)
}

async function createAnalysisFolder(){ // buffer to write .sol file to feed slither
  const tmpFolderPath = "./tmp_analysis"
  if (!fs.existsSync(tmpFolderPath)){
    fs.mkdirSync(tmpFolderPath);
  }
  else await Utils.emptyFolder(tmpFolderPath)
}

async function getActiveDetectors(){
  let allDetectors = []
  // concat all the detector categories
  for(let k of Object.keys(Detectors)){
    allDetectors = allDetectors.concat(Detectors[k])
  }
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

async function launchWorker(index){
  let contract = await contractPool.pop()
  if(!contract){
    console.log("Worker #" + index + " done")
    status.activeWorkers--
    return
  }
  let solcPath = getSolcPath(contract.files[0].compilerVersion)
  let folderpath = preparePath(contract.files)
  _launchWorker(contract, folderpath, solcPath, index)
}

function logStatus(id, elapsedSlither, hitsString, index){
  let elapsedTotal = Date.now() - startTime
  let speed_apm = Math.floor(analyzedCounter / (elapsedTotal / 1000 / 60)) // apm = analysis per minute
  let avgtime = Math.floor(elapsedTotal / analyzedCounter)
  let in24h = Math.floor(24 * 60 * 60 * 1000 / avgtime)
  let errorRate = Math.floor(failedCounter * 10000 / analyzedCounter) / 100
  console.log(Utils.getTime() + " - Instance:" + index + "    #" + id + " done - took " + elapsedSlither + "ms  -  speed: " + speed_apm + "apm  -  in 24h: " + in24h + "  -  error rate: " + errorRate + "%" + hitsString)
}

function getSolcPath(compVer){
  let solcFolder = isWindows ? "windows-amd64" : "linux-amd64"
  let solcVer = compVer.split("+")[0].substring(1)
  let solcFiles = fs.readdirSync("./solc-bin/" + solcFolder)
  for(let f of solcFiles){
    let fVer = f.split("+")[0].substring(("solc-" + solcFolder + "-v").length)
    if(fVer == solcVer)
      return path.resolve("./solc-bin/" + solcFolder + "/" + f)
  }
  return null
}

async function workerCleanup(toClean){
  analyzedCounter++
  if(toClean?.elapsed){
    let hitsDetectors = [], hitsString = ""
    if(toClean?.output?.success && toClean?.output?.findings){
      for(let k of Object.keys(toClean.output.findings)){
        if(toClean.output.findings[k].isHit != 0){
          hitsDetectors.push(k)
        }
      }
    }
    if(hitsDetectors.length){
      hitsString = " - Hits: " + hitsDetectors.join(", ")
    }
    logStatus(toClean.contractID, toClean.elapsed, hitsString, toClean.index)
  }
  if(toClean?.output?.success){
    await mysql.insertFindingsToDB(mysqlConn, toClean.sourcefile_signature, toClean.output)
  }
  else{
    failedCounter++
    let _error = parseAnalysisError(toClean?.output?.error)
    console.log("Analysis of contract ID=" + toClean.contractID + " resulted in an ERROR:", _error)
    await mysql.markContractAsErrorAnalysis(mysqlConn, toClean.sourcefile_signature, false, _error)
  }

  await Utils.deleteFolder(toClean.folderpath.workingPath)

  if(!contractPool.length){
    let noRes = await fillPool()
    if(status.dbEmpty){
      console.log("Worker #" + toClean.index + " done")
      status.activeWorkers--
      evalEndLoop() // need to check this
      return
    }
  }
  launchWorker(toClean.index)
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

function _launchWorker(contract, folderpath, solcpath, index){
  let _toClean = {folderpath: folderpath, contractID: contract.ID, sourcefile_signature: contract.sourcefile_signature, index: index}
  let w = new Worker('./workers/slitherWorker.js', { 
    workerData: { 
      workingPath: folderpath.workingPath, 
      analysisPath: folderpath.analysisPath, 
      detectors: contract.detectors,
      solcpath: solcpath
    }
  })
  instancesMonitor[index] = {worker: w, start: Date.now()}
  w.on('error', (err) => { 
    console.log(err.message); 
  });
  w.on('exit', () => {
    workerCleanup(_toClean)
  })
  w.on('message', (msg) => {
    _toClean['output'] = msg.output
    _toClean['elapsed'] = msg.elapsed
    
  });
}

async function monitorStuckInstances(){
  for(let i=0; i< instancesMonitor.length; i++){
    if(Date.now() - instancesMonitor[i].start > INSTANCE_TIMEOUT){
      console.log("Terminating stuck worker #" + i)
      await instancesMonitor[i].worker.terminate()
      instancesMonitor[i].start = Date.now() // give it time, things can get really stuck
    }
  }
}

async function fillPool(first = false){
  if(!first && cliOptions.refilter){
    status.dbEmpty = true 
    evalEndLoop()
    return
  }
  let noResults = false
  if(isFilling){
    console.log("Detected filling ongoing, waiting")
    return new Promise((resolve, reject) =>{
      let intervalCheck = setInterval(() => {
        if(!isFilling){
          clearInterval(intervalCheck); 
          resolve();
        }
      }, 1000)
    })
  }
  isFilling= true
  console.log("Filling pool triggered")
  let newPool = await mysql.getBatchToAnalyze(mysqlConn, poolSize, chain, detectorsOfInterest, cliOptions.refilter, cliOptions.retryErrors)
  console.log("Pool filled with " + newPool.data.length + " contracts")
  contractPool = newPool.data 
  if(!contractPool.length){
    status.dbEmpty = true 
    noResults = evalEndLoop()
  }
  isFilling = false
  return noResults
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