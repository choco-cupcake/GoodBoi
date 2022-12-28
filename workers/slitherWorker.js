const { parentPort, workerData } = require('worker_threads');
const fs = require('fs')
const { spawnSync } = require('child_process');
const Utils = require('../utils/Utils');

runAnalysis()

async function runAnalysis(){
  //setTimeout(() => { console.log("######## WORKER KILLED"); process.exit() }, 20000)
  let startTime = Date.now()
  let slitherOutput = await executeSlither(workerData.folderpath, workerData.detectors)
  let slitherResult = inspectSlitherOutput(slitherOutput, workerData.detectors)
  console.log(slitherResult)
  let elapsed = Date.now() - startTime
  console.log("ELAPSED " + elapsed)
  parentPort.postMessage(slitherResult);
  process.exit()
}

function executeSlither(folderpath, detectors){
  let slitherParams = ['-m', 'slither.__main__', folderpath, '--checklist', '--detect', detectors.join(","), '--json', '-']
  // run slither
  const slitherProg = spawnSync('python3', slitherParams); 
  let out = slitherProg.stdout.toString()
  return JSON.parse(out)
}

function inspectSlitherOutput(slitherOutput, detectorsUsed){ 
  if(!slitherOutput.success){
    return {success: false}
  }
  if(!slitherOutput.success){
    return {success: true, report: '', findings: []}
  }
  let descriptions = []
  let detectorsHit = new Set()
  for(let det of slitherOutput.results.detectors){
    detectorsHit.add(det.check)
    descriptions.push(det.description)
  }
  // build the full detectors outcome
  let detectorsResult = {}
  for(let det of detectorsUsed){
    let v = 0
    if(detectorsHit.has(det)) 
      v = 1
    detectorsResult[det] = v
  }
  return {success: true, report: descriptions.join("\n"), findings: detectorsResult}
}