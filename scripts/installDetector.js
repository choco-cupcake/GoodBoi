// installs detector on the analysis server
const { Client } = require('node-scp')
require("dotenv").config()
const path = require('path')
const fs = require('fs');
const remote_server = {
  host: process.env.ANALYSIS_SERVER_HOST, 
  port: 22, 
  username: process.env.ANALYSIS_SERVER_USER, 
  password: process.env.ANALYSIS_SERVER_PASS
}

const tmpAllDetPath = "./tmp_alldet.py"
const detectorData = {
  customDetFolder: "custom",
  sourcePath: "C:/Users/nicop/AppData/Local/Packages/PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0/LocalCache/local-packages/Python310/site-packages/slither/detectors",
  targetPath: "/usr/local/lib/python3.10/dist-packages/slither/detectors",
  detectors: [ // it's useful to have the list since detectors receive upgrades from time to time
    { 
      toUpdate: false,
      detectorFilename: "unprotected_write",
      detectorArg: "unprotected-write",
      detectorClass: "UnprotectedWrite"
    },
    { 
      toUpdate: true,
      detectorFilename: "withdraw_balanceof_dependant",
      detectorArg: "withdraw-balanceof-dependant",
      detectorClass: "WithdrawBalanceofDependant"
    }
  ]
}

main()

async function main(){
  for(let det of detectorData.detectors){
    if(!det.toUpdate)
      continue
    // upload detector file
    let sourceDet = cleanPath(path.join(detectorData.sourcePath, detectorData.customDetFolder, det.detectorFilename + ".py"))
    let targetDet = cleanPath(path.join(detectorData.targetPath, detectorData.customDetFolder, det.detectorFilename + ".py"))
    let succ = await sendFile(sourceDet, targetDet)
    if(succ)
      console.log("Detector " + det.detectorArg + " sent")
    else
      process.exit()

    // download all_detectors.py
    let sourcePath = cleanPath(path.join(detectorData.targetPath, "all_detectors.py").replace())
    if(!await downloadFile(sourcePath, tmpAllDetPath))
      process.exit()
    // add line + upload all_detectors.py
    if(addDetector(det))
      await sendFile(tmpAllDetPath, sourcePath)
    fs.unlinkSync(tmpAllDetPath);
  }
}

function cleanPath(_in){
  return _in.replace(/\\/g, "/")
}

async function sendFile(source, dest){
  try {
    const c = await Client(remote_server)
    await c.uploadFile(source, dest)
    c.close()
    return true
  } catch (e) {
    console.log(e)
    return false
  }
}

async function downloadFile(file_path, destination_path){
  try {
      const client = await Client(remote_server)
      await client.downloadFile(file_path, destination_path)
      client.close()
      return true
    } catch(e) {
      console.log(e)
      return false
    }
}

function addDetector(det){
  let allDetRaw = getFileContent(tmpAllDetPath)
  let installLine = "from ." + detectorData.customDetFolder + "." + det.detectorFilename + " import " + det.detectorClass
  let lines = allDetRaw.split("\n")
  let found = false
  for(let line of lines){
    line = line.trim()
    if(line == installLine){
      found = true
      console.log("Detector " + det.detectorArg + " already installed in all_detectors.py")
      break
    }
  }
  if(!found){
    allDetRaw += "\n" + installLine
    writeFileContent(tmpAllDetPath, allDetRaw)
    console.log("Detector " + det.detectorArg + " installed on all_detectors.py")
    return true
  }
  return false
}

function getFileContent(path){
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    console.error(err);
    return null
  }
}

function writeFileContent(path, data){
  try {
    fs.writeFileSync(path, data);
    return true
  } catch (err) {
    console.error(err);
    return false
  }
}