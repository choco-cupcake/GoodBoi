const { parentPort, workerData } = require('worker_threads');
const fs = require('fs')
const { spawnSync } = require('child_process');
const Utils = require('../utils/Utils');

runAnalysis()

async function runAnalysis(){
  setTimeout(() => { console.log("######## WORKER KILLED"); process.exit() }, 20000)
  let startTime = Date.now()
  let resultsRaw = await executeSlither(workerData.folderpath, workerData.detectors)
  let findings = inspectSlitherOutput(resultsRaw)
  let elapsed = Date.now() - startTime
  console.log("ELAPSED " + elapsed)
  parentPort.postMessage(findings);
  process.exit()
}

function executeSlither(folderpath, detectors){
  let output = ''
  const slitherProg = spawnSync('python3', ['-m', 'slither.__main__', folderpath, '--checklist', '--detect', detectors.join(",")]); 
  let err = slitherProg.stderr.toString()
  let out = slitherProg.stdout.toString()
  return {err: err, out: out}
}

function inspectSlitherOutput(results){ 
  if(!results.out.length){
    if(results.err.includes("Error: Function needs to specify overridden contracts "))
      console.log("REQUIRED EXPLICIT OVERRIDE")
    else if(results.err.includes("Error: Source file requires different compiler version "))
      console.log("DIFFERENT COMPILER VERSIONS")
    else
      console.log("OTHER ERROR")
    return {error: "SLITHER_EMPTY_OUTPUT"}
  } 
  let summary = results.out.substring("Summary\r\n".length)
  let findings = {}
  if(!summary.indexOf("## ")) 
    return findings // no findings
  let findingsStrings = summary.split("## ").slice(1)
  for(let findStr of findingsStrings){    
    let name = findStr.split("\r\n")[0].trim()
    let count = findStr.split(" - [ ] ID-").length - 1
    if(!workerData.detectors.includes(name)){
      console.log("ERROR Unrecognized detector '" + name + "'")
    }
    else{
      findings[name] = count
    }
  }
  return {report: summary, findings: findings}
}