const fs = require('fs')
const path = require('path')
const { Worker } = require('worker_threads');
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');
const Detectors = require('../data/slither_detectors');
const { program } = require('commander');

program.option('--refilter <string>', 'detector to refilter (only analyzes this detector\'s previous hits');
program.option('--retryErrors <number>', 'retry failed analysis in the last X hours');
program.option('--chain <string>', 'chain to operate on');

program.parse();
const cliOptions = program.opts();
const chain = cliOptions.chain || 'all'
const TMP_PATH = "tmp/tmp_analysis"

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
    if(cliOptions.refilter || cliOptions.retryErrors){
      console.log((cliOptions.refilter ? "Refilter" : "Error retry") + " done")
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
  const tmpFolderPath = path.join("./", TMP_PATH)
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
  let solcPath = Utils.getSolcPath(contract.files[0].compilerVersion)
  let folderpath = Utils.preparePath(contract.files, contract.contractName, true, TMP_PATH)
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

  await Utils.deleteFolder(toClean.folderpath.workingPath)

  if(toClean?.output?.success){
    await mysql.insertFindingsToDB(mysqlConn, toClean.sourcefile_signature, toClean.output)
  }
  else{
    failedCounter++
    let _error = parseAnalysisError(toClean?.output?.error)
    console.log("Analysis of contract ID=" + toClean.contractID + " resulted in an ERROR:", _error)
    await mysql.markContractAsErrorAnalysis(mysqlConn, toClean.sourcefile_signature, false, _error)
  }

  if(!contractPool.length){
    await fillPool()
    if(status.dbEmpty){
      console.log("Worker #" + toClean.index + " done")
      status.activeWorkers--
      evalEndLoop()
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
  if(!first && (cliOptions.refilter || cliOptions.retryErrors)){
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
