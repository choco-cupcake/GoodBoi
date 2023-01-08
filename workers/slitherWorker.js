const { parentPort, workerData } = require('worker_threads');
const fs = require('fs')
const { spawnSync } = require('child_process');
const Utils = require('../utils/Utils');

runAnalysis()

async function runAnalysis(){
  //setTimeout(() => { console.log("######## WORKER KILLED"); process.exit() }, 20000)
  let startTime = Date.now()
  let slitherOutput = await executeSlither(workerData.workingPath, workerData.analysisPath, workerData.detectors)
  let slitherResult = inspectSlitherOutput(slitherOutput, workerData.detectors)
  console.log(slitherResult)
  let elapsed = Date.now() - startTime
  console.log("ELAPSED " + elapsed)
  parentPort.postMessage(slitherResult);
  process.exit()
}

function executeSlither(workingPath, analysisPath, detectors){
  let slitherParams = ['-m', 'slither.__main__', analysisPath, '--checklist', '--detect', detectors.join(","), '--json', '-', '--solc', workerData.solcpath]
  // run slither
  const slitherProg = spawnSync('python3', slitherParams, {cwd: workingPath}); 
  let out = slitherProg.stdout.toString()
  return JSON.parse(out)
}

function inspectSlitherOutput(slitherOutput, detectorsUsed){
  let detectorsResult = {} 
  if(!slitherOutput.success){
    return {success: false, error: slitherOutput.error}
  }
  if(!slitherOutput.results?.detectors){
    for(let det of detectorsUsed)
      detectorsResult[det] = 0
    return {success: true, report: '', findings: detectorsResult} 
  }
  let descriptions = []
  let detectorsHit = new Set()
  for(let det of slitherOutput.results.detectors){
    detectorsHit.add(det.check)
    descriptions.push(det.description)
  }
  // build the full detectors outcome
  for(let det of detectorsUsed){
    let v = 0
    if(detectorsHit.has(det)) 
      v = 1
    detectorsResult[det] = v
  }
  return {success: true, report: descriptions.join("\n"), findings: detectorsResult}
}