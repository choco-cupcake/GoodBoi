const { parentPort, workerData } = require('worker_threads');
const fs = require('fs')
const { spawnSync } = require('child_process');
const Utils = require('../utils/Utils');

runAnalysis()

async function runAnalysis(){
  //setTimeout(() => { console.log("######## WORKER KILLED"); process.exit() }, 20000)
  let startTime = Date.now()
  let slitherOutput = await executeSlither(workerData.workingPath, workerData.analysisPath, workerData.detectors)
  if(!slitherOutput){
    parentPort.postMessage({output:{success: false, error: 'Empty Slither output - Likely solc error'}, elapsed: 0});
    process.exit()
  }
  let slitherResult = inspectSlitherOutput(slitherOutput, workerData.detectors)
  let hits = Object.keys(slitherResult.findings).filter( k => slitherResult.findings[k] == 1).join(",")
  if(hits.length) console.log("hit: " + hits)
  let elapsed = Date.now() - startTime
  parentPort.postMessage({output:slitherResult, elapsed: elapsed});
  process.exit()
}

function executeSlither(workingPath, analysisPath, detectors){
  let slitherParams = ['-m', 'slither.__main__', analysisPath, '--checklist', '--detect', detectors.join(","), '--json', '-', '--solc', workerData.solcpath]
  // run slither
  const slitherProg = spawnSync('python3', slitherParams, {cwd: workingPath}); 
  let out = slitherProg.stdout.toString()
  if(!out.length)
    return null
  return JSON.parse(out)
}

function inspectSlitherOutput(slitherOutput, detectorsUsed){
  let findingsObj = {} 
  if(!slitherOutput.success){
    return {success: false, error: slitherOutput.error}
  }
  if(!slitherOutput.results?.detectors){
    for(let det of detectorsUsed)
      findingsObj[det] = {isHit: 0, report: ''}
    return {success: true, findings: findingsObj} 
  }
  let detectorsHit = new Set()
  let detectorsReport = {}
  for(let det of slitherOutput.results.detectors){
    detectorsHit.add(det.check)
    if(!detectorsReport[det.check])
      detectorsReport[det.check] = det.description
    else
      detectorsReport[det.check] += det.description + "\n"
  }

  // build the full detectors outcome
  for(let det of detectorsUsed){
    let isHit = detectorsHit.has(det) ? 1 : 0
    let rep = isHit ? detectorsReport[det] : ''
    findingsObj[det] = {isHit: isHit, report: rep}
  }
  if(detectorsHit.length){
    console.log(Array.from(detectorsHit).join(", "))
  }
  return {success: true, findings: findingsObj}
}