const mysql = require('../utils/goodboiMysql')
const { listApps} = require('../providers/pm2/api')

const getGoodBoiData = async () => {
  let mysqlConn = await mysql.getDBConnection()
  
  let contInfo = await mysql.getFromCache(mysqlConn, "CONTRACT_INFO")
  if(!contInfo)
    contInfo = await getContractsInfo(mysqlConn)
  else contInfo = JSON.parse(contInfo)

  let modulesStatus = await mysql.getFromCache(mysqlConn, "MODULES_STATUS")
  if(!modulesStatus)
    modulesStatus = await getModulesStatus(mysqlConn)
  else modulesStatus = JSON.parse(modulesStatus)

  let detectorsFindings = await mysql.getFromCache(mysqlConn, "DETECTORS_FINDINGS")
  if(!detectorsFindings)
    detectorsFindings = await getDetectorsResult(mysqlConn, contInfo.parsedTot - contInfo.compilationErrorsTotal)
  else detectorsFindings = JSON.parse(detectorsFindings)

  let stringified = JSON.stringify({modulesStatus: modulesStatus, contractInfo: contInfo, findings: detectorsFindings})

  return stringified
}

async function getDetectorsResult(mysqlConn, contractsNumber){
  let outObj = []
  let analysisColumn = (await mysql.getSlitherAnalysisColumns(mysqlConn)).map(e => e.COLUMN_NAME.toLowerCase())
  for(let col of analysisColumn){
    let positive = await mysql.getDetectorHitCount(mysqlConn, col, '1')
    let negative = await mysql.getDetectorHitCount(mysqlConn, col, '0')
    let percAnalyzed = (((positive + negative) * 100) / contractsNumber).toFixed(1)
    let analyzed = (positive + negative) + '   -   ' + percAnalyzed + '%'
    outObj.push({name: col, hits: positive, analyzed: analyzed})
  }
  outObj.sort(function(a, b) {return b.hits - a.hits})
  await mysql.updateCache(mysqlConn, "DETECTORS_FINDINGS", JSON.stringify(outObj))
  return outObj
}

async function getContractsInfo(mysqlConn){
  let outObj = {}
  let contractsByChain = await mysql.getContractsPerChain(mysqlConn)
  outObj['parsedPerChain'] = [contractsByChain.BSC_MAINNET, contractsByChain.ETH_MAINNET, contractsByChain.POLYGON]
  outObj['parsedTot'] = contractsByChain.BSC_MAINNET + contractsByChain.ETH_MAINNET + contractsByChain.POLYGON
  outObj['parsedLast24h'] = await mysql.getContractsLast24h(mysqlConn)
  outObj['compilationErrors'] = (await mysql.getCompilationErrors(mysqlConn)).sort(function(a, b) {return b.count - a.count})
  outObj['compilationErrorsTotal'] = outObj['compilationErrors'].reduce((old, curr) => curr.count + old, 0)
  outObj['compilationErrorsPerc'] = ((outObj['compilationErrorsTotal'] * 100) / outObj['parsedTot']).toFixed(1) + '%'
  outObj['uniqueSourcefiles'] = await mysql.getSourcefilesCount(mysqlConn)
  await mysql.updateCache(mysqlConn, "CONTRACT_INFO", JSON.stringify(outObj))
  return outObj
}

async function getModulesStatus(mysqlConn){
  let statusOut = {}
  let apps = await listApps()
  let modules = ["sourceGetter", "balanceGetter", "blockParser"]
  let chains = ["eth_mainnet", "bsc_mainnet", "polygon"]
  for(let m of modules){
    for(let c of chains){
      let moduleName = m + "_" + c
      let status = getModuleStatus(apps, moduleName)
      statusOut[moduleName] = status
    }
  }
  
  // get mysqlBackup status
  statusOut['mysqlBackup'] = getModuleStatus(apps, 'mysqlBackup')
  statusOut['contractsPruner'] = false

  await mysql.updateCache(mysqlConn, "MODULES_STATUS", JSON.stringify(statusOut))
  return statusOut
}

function getModuleStatus(parsedStatus, moduleName){
  let res = parsedStatus.filter(e => e.name == moduleName)
  if(!res.length || res[0].status != 'online')
    return false
  return true
}


module.exports = {
  getGoodBoiData
}