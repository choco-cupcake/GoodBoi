const Database = require('./DB')
const Utils = require('./Utils')
const Crypto = require('crypto')
const Web3 = require("web3")

async function getLastSolcCommit(conn, platform){ // platforms: ["Win", "Linux"]
  let field = "lastSolcCommit" + platform
  let query = "SELECT " + field + " FROM status WHERE ID=1"
  try{
    let [data, fields] = await conn.query(query)
    return data[0][field]
  }
  catch(e){
    console.log("ERROR - getLastSolcCommit ", e.message)
    return null
  }
}
async function updateLastSolcCommit(conn, lastCommitHash, platform){ 
  let field = "lastSolcCommit" + platform
  let query = "UPDATE status SET " + field + " = ? WHERE ID=1"
  try{
    await conn.query(query, lastCommitHash)
  }
  catch(e){
    console.log("ERROR - updateLastSolcCommit ", e.message)
  }
}
async function updateFlagReflectionDate(conn, cID){
  let query = "UPDATE contract SET reflUpdatedAt=NOW() WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, cID)
    if(!data.affectedRows){
      console.log("ERROR - updateReflectionDate " + cID)
    }
  }
  catch(e){
    console.log("ERROR - updateReflectionDate " + cID, e.message)
  }
}

async function flagReflection(conn, cID, poolFlag, balanceFlag){
  let subQ = []
  if(poolFlag==1)
    subQ.push("reflPoolFlag=1")
  if(balanceFlag==1)
    subQ.push("reflBalanceFlag=1")
  
  let query = "UPDATE contract SET " + subQ.join(",") + " WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, cID)
    if(!data.affectedRows){
      console.log("ERROR - Can't update reflection tag for contract " + cID)
    }
  }
  catch(e){
    console.log("ERROR - Can't update reflection tag for contract " + cID, e.message)
  }
}

async function getContractHavingAddressInVars(conn, address, chain){
  let query = "SELECT ID FROM contract WHERE chain=? AND (addressVars LIKE ? OR implAddressVars LIKE ?)"
  try{
    let [data, fields] = await conn.query(query, [chain, "%"+address+"%", "%"+address+"%"])
    return data
  }
  catch(e){
    console.log("ERROR - getContractHavingAddressInVars ", e.message)
    return null
  }

}

async function getFlaggedContractsToReflect(conn){
  let query = "SELECT ID, address, chain, poolFlag, balanceFlag FROM contract WHERE (poolFlag=1 OR balanceFlag=1) AND DATE_SUB(NOW(), INTERVAL ? DAY) > reflUpdatedAt"
  try{
    let [data, fields] = await conn.query(query, process.env.REFLECT_DAYS_REPEAT)
    return data
  }
  catch(e){
    console.log("ERROR - getFlaggedContractsToReflect ", e.message)
    return null
  }

}

async function updateCache(conn, tag, value){
  let query = "UPDATE cache SET value = ?, datareg = NOW() WHERE tag = ?"
  try{
    let [data, fields] = await conn.query(query, [value, tag])
    if(!data.affectedRows){
      console.log("ERROR - Can't update tag " + tag + " in cache")
    }
  }
  catch(e){
    console.log("ERROR - Can't update tag " + tag + " in cache", e.message)
  }
}

async function getFromCache(conn, tag, bypassExpire = false){
  let query = "SELECT value FROM cache WHERE tag = ?"
  if(!bypassExpire)
    query +=  "AND datareg + INTERVAL expire_minutes MINUTE > NOW()"
  try{
    let [data, fields] = await conn.query(query, tag)
    if(!data.length){
      return null
    }
    return data[0].value
  }
  catch(e){
    console.log("ERROR - Can't get tag " + tag + " from cache", e.message)
    return null
  }
}

async function updateProxyImplAddress(conn, chain, cID, implAddress, isChanged){
  let updSubQ = isChanged ? ", implUpdatedAt = NOW(), implAddress = ? " : ""
  let queryParams = isChanged ? [implAddress, cID] : [cID]
  let query = "UPDATE contract SET implCheckedAt = NOW()" + updSubQ + " WHERE ID = ?;"
  try{
    let [data, fields] = await conn.query(query, queryParams);
    if(!data.affectedRows){
      Utils.printQueryError(query, queryParams, "Error updating implAddress")
      return false
    }
    if(isChanged && implAddress != "0x0"){ 
      // add address to DB if not yet parsed
      let alreadyParsed = await getFromParsedPool(conn, chain, implAddress)
      if(!alreadyParsed || !alreadyParsed.length){
        await pushAddressToParsedTable(conn, chain, implAddress)
        await pushAddressToPoolTable(conn, chain, implAddress, 'addresspool', true)
        console.log("Newly discovered implementation pushed to addresspool: " + implAddress)
      }
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, queryParams, "Error updating implAddress - " + e.message)
    return false
  }
}

async function getBatchProxiesToRead(conn, chain){
  const batchLen = process.env.PROXIES_BATCH_LEN
  const daysRefresh = process.env.PROXIES_REFRESH_DAYS
  const waitDays = process.env.PROXIES_WAIT_DAYS
  let query = "SELECT ID, address, implAddress FROM `contract` WHERE `chain`=? AND (contractName LIKE '%proxy%' OR proxy = 1) AND contractName != 'GnosisSafeProxy' AND DATE_SUB(NOW(), INTERVAL ? DAY) > dateFound AND (DATE_SUB(NOW(), INTERVAL ? DAY) > implCheckedAt OR implCheckedAt IS NULL) LIMIT ?;"
  try{
    let [data, fields] = await conn.query(query, [chain, waitDays, daysRefresh, Number(batchLen)])
    return data
  }
  catch(e){
    console.log("ERROR - Can't get batch vars to read", e.message)
    return null
  }
}

async function updateAddressVars(conn, cID, isFlagged, addrVars, areChanged, addrVarsImpl, areChangedImpl){
  let sets = ["varsCheckedAt = NOW()", " poolFlag = ?"]
  let queryParams = [isFlagged]
  if(addrVars){
    sets.push(" addressVars = ?")
    queryParams.push(addrVars)
  }
  if(addrVarsImpl){
    sets.push(" implAddressVars = ?")
    queryParams.push(addrVarsImpl)
  }
  if(areChanged || areChangedImpl){
    sets.push("varsUpdatedAt = NOW()")
  }
  let query = "UPDATE contract SET " + sets.join(",") + " WHERE ID = ?;"
  queryParams.push(cID)
  try{
    let [data, fields] = await conn.query(query, queryParams);
    if(!data.affectedRows){
      Utils.printQueryError(query, queryParams, "Error updating addressVars")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, queryParams, "Error updating addressVars - " + e.message)
    return false
  }
}

async function getBatchVarsToRead(conn, chain){
  const batchLen = process.env.STATE_VARS_BATCH_LEN
  const daysRefresh = process.env.STATE_VARS_REFRESH_DAYS
  const waitDays = process.env.STATE_VARS_WAIT_DAYS
  let query = `SELECT c1.ID, c1.address, c1.addressVars, c1.implAddress, c2.addressVars AS "implVars" FROM contract AS c1 
  LEFT JOIN contract AS c2 ON c1.chain=c2.chain AND c1.implAddress = c2.address
  WHERE c1.chain = ? AND c1.contractName != 'UniswapV2Pair' AND c1.contractName != 'UniswapV3Pool' 
  AND (c1.addressVars IS NOT NULL OR (c1.implAddress IS NOT NULL AND c1.implAddress != "0x0" AND c2.addressVars IS NOT NULL))
  AND DATE_SUB(NOW(), INTERVAL ? DAY) > c1.dateFound 
  AND (DATE_SUB(NOW(), INTERVAL ? DAY) > c1.varsCheckedAt OR c1.varsCheckedAt IS NULL) LIMIT 1000;`
  try{
    let [data, fields] = await conn.query(query, [chain, waitDays, daysRefresh, Number(batchLen)])
    return data
  }
  catch(e){
    console.log("ERROR - Can't get batch vars to read", e.message)
    return null
  }
}

async function keepAlive(conn){
  let query = "SELECT 1;"
  try{
    await conn.query(query);
  }
  catch(e){
    Utils.printQueryError(query, [], "Error keepAlive - " + e.message)
  }
}

async function addSlitherAnalysisColumns(conn, columnName){
  let query = "ALTER TABLE slither_analysis ADD COLUMN `" + columnName + "` TINYINT DEFAULT -1 AFTER failedAnalysis, ADD COLUMN `rep_" + columnName + "` TEXT, ADD COLUMN `manualRev_" + columnName + "` TINYINT DEFAULT 0 AFTER failedAnalysis;"
  try{
    await conn.query(query);
    return true
  }
  catch(e){
    Utils.printQueryError(query, [], "Error adding slither_analysis column - " + e.message)
    return false
  }
}

async function getSlitherAnalysisColumns(conn){
  let query = "SELECT `COLUMN_NAME` FROM `INFORMATION_SCHEMA`.`COLUMNS` WHERE `TABLE_SCHEMA`='goodboi' AND `TABLE_NAME`='slither_analysis' AND `COLUMN_NAME` NOT IN ('ID','sourcefile_signature','failedAnalysis','error','analysisDate');"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get slither_analysis columns")
      return null
    }
    return data
  }
  catch(e){
    console.log("ERROR - Can't get slither_analysis columns", e.message)
    return null
  }
}

async function getLastBackupDB(conn, backupTime){
  let query = "SELECT lastBackupDB FROM status WHERE ID=1 AND DATE_SUB(NOW(), INTERVAL ? HOUR) > lastBackupDB;"
  try{
    let [data, fields] = await conn.query(query, backupTime)
    if(!data.length){
      return null
    }
    return data[0].lastBackupDB
  }
  catch(e){
    console.log("ERROR - Can't get lastBackupDB", e.message)
    return null
  }
}

async function updateLastBackupDB(conn){
  let query = "UPDATE status SET lastBackupDB = NOW() WHERE ID=1;"
  try{
    let [data, fields] = await conn.query(query);
    if(!data.affectedRows){
      Utils.printQueryError(query, [], "Error setting lastBackupDB")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, [], "Error setting lastBackupDB - " + e.message)
    return false
  }
}

async function updateLastParsedBlock(conn, block, chain){
  let field = 'lastParsedBlock_' + chain.toLowerCase()
  let query = "UPDATE status set " + field + " = ? WHERE ID = 1"
  try{
    let [data, fields] = await conn.query(query, block);
    if(!data.affectedRows){
      Utils.printQueryError(query, block, "Error setting " + field)
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, block, "Error setting " + field + " - " + e.message)
    return false
  }
}

async function getLastParsedBlock(conn, chain){
  let field = 'lastParsedBlock_' + chain.toLowerCase()
  let query = "SELECT " + field + " FROM status WHERE ID=1;"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("WARNING - Can't get " + field + " - length = 0")
      return null
    }
    return data[0][field]
  }
  catch(e){
    console.log("ERROR - Can't get " + field, e.message)
    return null
  }
}

async function updateLastParsedBlockDownward(conn, block, chain){
  let field = 'downwardBlock_' + chain.toLowerCase()
  let query = "UPDATE status set " + field + " = ? WHERE ID = 1"
  try{
    let [data, fields] = await conn.query(query, block);
    if(!data.affectedRows){
      Utils.printQueryError(query, block, "Error setting " + field)
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, block, "Error setting " + field + " - " + e.message)
    return false
  }
}
async function getLastParsedBlockDownward(conn, chain){
  let field = 'downwardBlock_' + chain.toLowerCase()
  let query = "SELECT " + field + " FROM status WHERE ID=1;"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("WARNING - Can't get " + field + " - length = 0")
      return null
    }
    return data[0][field]
  }
  catch(e){
    console.log("ERROR - Can't get " + field, e.message)
    return null
  }
}


async function getHashFromDB(conn, h){
  let query = "SELECT ID FROM sourcefile WHERE sourceHash = ?"
  try{
    let [data, fields] = await conn.query(query, h);
    return data
  }
  catch(e){
    Utils.printQueryError(query, h, e.message)
    return []
  }
}

async function updateBalance(conn, chain, contractAddress, totalUSDValue, ERC20Holdings, eth_balance, implAddress){
  let pruned = await checkPruneContract(conn, chain, contractAddress, totalUSDValue)
  if(pruned){
    console.log("pruned ", chain, " - ", contractAddress)
    return true
  }
  let query = "UPDATE balances SET ERC20Holdings = ?, usdValue = ?, ethBalance_bp = ?, lastUpdate = NOW() WHERE address = ? AND chain = ?"
  
  try{
    let [data, fields] = await conn.query(query, [ERC20Holdings, totalUSDValue, eth_balance, contractAddress, chain]);
    if(!data.affectedRows){
      Utils.printQueryError(query, [ERC20Holdings, totalUSDValue, eth_balance, contractAddress, chain], "Error updating balance - row not found")
      return false
    }
    if(Number(totalUSDValue) > process.env.FLAGGER_MIN_BALANCE){
      await flagContractBalance(conn, chain, contractAddress, implAddress)
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, [ERC20Holdings, totalUSDValue, eth_balance, contractAddress, chain], "Error updating balance - " + e.message)
    return false
  }
}

async function flagContractBalance(conn, chain, contractAddress, implAddress){
  let query = "UPDATE contract set balanceFlag=1 WHERE chain=?"
  let queryParams = [chain, contractAddress]
  if(implAddress && implAddress.length){ // if this is a proxy, also flag the implementation
    query += " AND (address=? OR address=?)"
    queryParams.push(implAddress)
  }
  else{
    query += " AND address=?"
  }
  try{
    let [data, fields] = await conn.query(query, queryParams);
    if(!data.affectedRows){
      Utils.printQueryError(query, block, "Error flagging balance")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, block, "Error flagging balance" + e.message)
    return false
  }
}

async function checkPruneContract(conn, chain, contractAddress, totalUSDValue){
  if(process.env.CONTRACT_PRUNER_ENABLED && Number(totalUSDValue) < Number(process.env.CONTRACT_PRUNER_MIN_BALANCE)){
    // check if to prune
    let query = "SELECT ((lastTx + INTERVAL ? day) <= NOW() AND addressVars IS NULL AND address NOT IN (SELECT implAddress FROM contract WHERE chain=?)) AS toPrune FROM contract WHERE address = ? AND `chain` = ?"; // TODO change addressVars IS NULL to poolFlag=0 if db grows too large (unflagged but with addressVars might still be interesting) 
    try{
      let [data, fields] = await conn.query(query, [process.env.CONTRACT_PRUNER_UNACTIVITY_DAYS, chain, contractAddress, chain]); 
      if(!data.length){
        Utils.printQueryError(query, [process.env.CONTRACT_PRUNER_UNACTIVITY_DAYS, contractAddress, chain], "Error checking contract pruning - row not found")
        return false
      }
      if(data[0].toPrune){
        await pruneContract(conn, chain, contractAddress)
        return true
      }
    }
    catch(e){
      Utils.printQueryError(query, [process.env.CONTRACT_PRUNER_UNACTIVITY_DAYS, contractAddress, chain], "Error checking contract pruning - " + e.message)
      return false
    }
  }
  return false
}

async function pruneContract(conn, chain, contractAddress){
  // get contract ID
  let contract = await getContract(conn, chain, contractAddress)
  if(!contract) return
  // get contract_sourcefiles
  let contract_sourcefiles = await getContractSourcefilesFromContract(conn, contract.ID)
  for(let contract_sourcefile of contract_sourcefiles){ 
    //   check if sourcefile unique
    let sameSourcefilesCount = await getCountContractSourcefilesFromSourcefile(conn, contract_sourcefile.sourcefile)
    if(sameSourcefilesCount == 1){ // unique: sourcefile was only used by this contract
      // delete sourcefile
      await deleteSourcefile(conn, contract_sourcefile.sourcefile)
    }
    // delete contract_sourcefile entry
    await deleteContractSourcefile(conn, contract_sourcefile.ID)
  }
  // delete parsedaddress
  await deleteParsedAddress(conn, chain, contractAddress)
  // delete analysis
  await deleteAnalysis(conn, contract.sourcefile_signature)
  // delete balance
  await deleteBalance(conn, chain, contractAddress)
  // delete contract
  await deleteContract(conn, contract.ID)
}

async function deleteBalance(conn, chain, contractAddress){
  let query = "DELETE FROM balances WHERE `chain`=? AND address=?"
  try{
    await conn.query(query, [chain, contractAddress]);
  }
  catch(e){
    Utils.printQueryError(query, [chain, contractAddress], e.message)
  }
}

async function deleteParsedAddress(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let query = "DELETE FROM " + parsedTable + " WHERE address = ?"
  try{
    await conn.query(query, [address]);
  }
  catch(e){
    Utils.printQueryError(query, [address], e.message)
  }
}

async function deleteAnalysis(conn, sourcefile_signature){
  if(await getAnalysisCount(conn, sourcefile_signature) != 1)
    return // analysis non only for this contract
    
  let query = "DELETE FROM slither_analysis WHERE sourcefile_signature = ?"
  try{
    await conn.query(query, [sourcefile_signature]);
  }
  catch(e){
    Utils.printQueryError(query, [sourcefile_signature], e.message)
  }
}

async function getAnalysisCount(conn, sourcefile_signature){
  let query = "SELECT COUNT(*) AS c FROM slither_analysis WHERE sourcefile_signature = ?"
  try{
    let [data, fields] = await conn.query(query, [sourcefile_signature]);
    if(!data.length)
      return null
    return Number(data[0].c)
  }
  catch(e){
    Utils.printQueryError(query, [sourcefile_signature], e.message)
    return null
  }
}

async function getContractSourcefilesFromContract(conn, contractID){
  let query = "SELECT * FROM contract_sourcefile WHERE contract=?"
  try{
    let [data, fields] = await conn.query(query, [contractID]);
    if(!data.length){
      Utils.printQueryError(query, [contractID], "cant find contract_sourcefile from contract")
      return []
    }
    return data
  }
  catch(e){
    Utils.printQueryError(query, [contractID], e.message)
    return []
  }
}

async function getCountContractSourcefilesFromSourcefile(conn, sourcefile){
  let query = "SELECT COUNT(*) AS c FROM contract_sourcefile WHERE sourcefile=?"
  try{
    let [data, fields] = await conn.query(query, [sourcefile]);
    if(!data.length){
      Utils.printQueryError(query, [sourcefile], "cant find contract_sourcefile from sourcefile")
      return null
    }
    return Number(data[0].c)
  }
  catch(e){
    Utils.printQueryError(query, [sourcefile], e.message)
    return null
  }
}

async function deleteSourcefile(conn, sourcefile){
  let query = "DELETE FROM sourcefile WHERE ID=?"
  try{
    await conn.query(query, [sourcefile]);
  }
  catch(e){
    Utils.printQueryError(query, [sourcefile], e.message)
  }
}

async function deleteContractSourcefile(conn, contract_sourcefileID){
  let query = "DELETE FROM contract_sourcefile WHERE ID=?"
  try{
    await conn.query(query, [contract_sourcefileID]);
  }
  catch(e){
    Utils.printQueryError(query, [contract_sourcefileID], e.message)
  }
}

async function getContract(conn, chain, address){
  let query = "SELECT ID, sourcefile_signature FROM contract WHERE `chain`=? AND address=?"
  try{
    let [data, fields] = await conn.query(query, [chain, address]);
    if(!data.length){
      Utils.printQueryError(query, [chain, address], "cant find contract ID from (address,chain)")
      return null
    }
    return data[0]
  }
  catch(e){
    Utils.printQueryError(query, [chain, address], e.message)
    return null
  }
}

async function getAddressesOldBalance(conn, chain, daysOld, batchSize){
let query = "SELECT b.ID, b.address, c.implAddress FROM balances AS b, contract AS c WHERE b.`chain`=? AND b.lastUpdate < NOW() - INTERVAL ? DAY AND c.address=b.address AND c.`chain`=b.`chain` ORDER BY c.lastTx ASC LIMIT ? "
  try{
    let [data, fields] = await conn.query(query, [chain, daysOld, +batchSize]);
    return data
  }
  catch(e){
    Utils.printQueryError(query, [chain, daysOld, +batchSize], e.message)
    return []
  }
}

async function getContractFiles(conn, contractID, address, chain){
    // used by scripts/getContractsFiles.js
    let subQ, params
    if(contractID){
      subQ = "WHERE c.ID = ?"
      params = [contractID]
    } else{
      subQ = "WHERE c.address = ? AND c.chain = ?"
      params = [address, chain]
    }
    let query = ''.concat(
      "SELECT c.compilerVersion, csf.contract, csf.filename, sf.*FROM contract AS c ",
      "INNER JOIN contract_sourcefile AS csf ON csf.contract = c.ID ",
      "INNER JOIN sourcefile AS sf ON csf.sourcefile=sf.ID ",
      "INNER JOIN slither_analysis AS an ON an.sourcefile_signature = c.sourcefile_signature ",
      subQ
    )
  
    try{
      let [data, fields] = await conn.query(query, params)
      if(!data.length){
        console.log("WARNING - Can't get contract with ID " + contractID)
        return null
      }
      return data
    }
    catch(e){
      console.log("ERROR - Can't get contracts to analyze", e.message)
      process.exit()
    }
  }

async function getBatchToAnalyze(conn, len, chain, detectors, refilterDetector, retryErrors){
// analysis table analyzes sourcefile, not contract. results viewer will get related contracts
  let endOfResults = false
  let detSub = retryErrors ? "" : buildDetectorsFindSubquery(detectors, refilterDetector)
  let query = ''.concat(
    "SELECT DISTINCT c.sourcefile_signature, c.compilerVersion, csf.contract, csf.filename, sf.*, an.* FROM contract AS c ",
    "INNER JOIN contract_sourcefile AS csf ON csf.contract = c.ID ",
    "INNER JOIN sourcefile AS sf ON csf.sourcefile=sf.ID ",
    "INNER JOIN slither_analysis AS an ON an.sourcefile_signature = c.sourcefile_signature ",
    "INNER JOIN ",
    "(SELECT ID FROM contract WHERE sourcefile_signature IN ",
    " (SELECT DISTINCT c.sourcefile_signature FROM contract AS c ",
    " INNER JOIN slither_analysis AS an ON an.sourcefile_signature = c.sourcefile_signature ",
    " WHERE ",
    retryErrors ? " an.failedAnalysis > 0 " : " an.failedAnalysis = 0 ",
    " AND (c.poolFlag=1 OR c.balanceFlag=1 OR c.reflPoolFlag=1 OR c.reflBalanceFlag=1)",
    chain != 'all' ? "  AND c.chain = ? " : "",
    detSub, // keeps only contracts not yet analyzed for these detectors
    ") ",
    refilterDetector ? "" : (" LIMIT " + len), // get full results for refiltering, not to overlap with subsequent batches
    ") AS t1 ON c.ID = t1.ID;"
  )

  // build query params array
  let queryParams = []
  if(chain != 'all') queryParams.push(chain)

  try{
    let [data, fields] = await conn.query(query, queryParams)
    if(!data.length){
      console.log("WARNING - Can't get contracts to analyze - length = 0")
      return {eor: true, data: []}
    }
    if(data.length < len){
      endOfResults = true
    }
    else{
      let lastContract = data.at(-1).contract
      data = data.filter(e => e.contract != lastContract) // remove last contract since it may lack some files
    }
    let contracts = []
    for(let d of data) // group files by contract
      if(!contracts.includes(d.contract)) 
        contracts.push({ID: d.contract, sourcefile_signature: d.sourcefile_signature})
    let returnData = []
    let signaturesSeen = [] // remove duplicates - sorry not sorry the proper sql query was too demanding + could be unpleasant only the first few cycles of a new detector + its late i want to play with custom detectors + first tests suggest its better that anticipated
    for(let c of contracts){
      if(signaturesSeen.includes(c.sourcefile_signature))
        continue
      signaturesSeen.push(c.sourcefile_signature)
      // get files
      let files = data.filter(e => e.contract == c.ID)
      // exclude already run detectors
      let usedDetectors = Object.keys(files[0]).filter(e => !['sourcefile_signature', 'filename',  'ID',  'sourceText',  'sourceHash',  'failedAnalysis'].includes(e) && files[0][e] != '-1')
      let detectorsToUse = refilterDetector ? [refilterDetector] : detectors.filter(e => !usedDetectors.includes(e)) // detectors set by the user - detectors already run on this contract
      returnData.push({ID: c.ID, files: files, detectors: detectorsToUse, sourcefile_signature: c.sourcefile_signature})

    }
    return {eor: endOfResults, data: returnData}
  }
  catch(e){
    console.log("ERROR - Can't get contracts to analyze", e.message)
    process.exit()
  }
}

function buildDetectorsFindSubquery(detectors, refilterDetector){
  if(refilterDetector){
    return " AND an.`" + refilterDetector + "` = 1 "
  }
  let ret = []
  for(let d of detectors)
    ret.push("(an.`" + d + "`=-1)")
  return " AND (".concat(ret.join(" OR "), ") ")
}

async function markContractAsAnalyzed(conn, contractID){
  let query = "UPDATE contract set `analyzed_std` = 1, `compiler_error` = 0 WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, contractID);
    if(!data.affectedRows){
      Utils.printQueryError(query, contractID, "Error setting contract as compiler_error")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, contractID, "Error setting contract as compiler_error - " + e.message)
    return false
  }
}

async function markContractAsErrorAnalysis(conn, sourcefile_signature, reset = false, error = ''){
  let query = reset ?
    "UPDATE slither_analysis AS an SET an.failedAnalysis = 0, an.error = ? WHERE an.sourcefile_signature = ?"
    :
    "UPDATE slither_analysis AS an SET an.failedAnalysis = an.failedAnalysis + 1, an.error = ?, an.analysisDate = NOW() WHERE an.sourcefile_signature = ?"
  try{
    let [data, fields] = await conn.query(query, [error, sourcefile_signature]);
    if(!data.affectedRows){
      Utils.printQueryError(query, sourcefile_signature, "Error updating failedAnalysis")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, sourcefile_signature, "Error updating failedAnalysis - " + e.message)
    return false
  }
}


async function insertFindingsToDB(conn, sourcefile_signature, output){ 
  // try to update the existing record, insert if update fails 
  let subQuery = buildFindingsUpdateSubquery(output)
  let query = "UPDATE slither_analysis AS an SET " + subQuery.subQuery + ", an.analysisDate = NOW() WHERE an.sourcefile_signature = ?"
  try{
    if(Object.keys(output.findings).length){ // skip if no findings
      let [data, fields] = await conn.query(query, [...subQuery.params, sourcefile_signature]);
      if(!data.affectedRows){ 
        Utils.printQueryError(query, [contractID, output.findings], "Error updating analysis record - 0 affected rows")
      }
    }
    await markContractAsErrorAnalysis(conn, sourcefile_signature, true) // reset failedAnalysis to 0
    return true
  }
  catch(e){
    Utils.printQueryError(query, [sourcefile_signature, output.findings], "Error updating analysis record - " + e.message)
    return false
  }
}

function buildFindingsUpdateSubquery(output){
  let queryParts = []
  let queryParams = []
  for(let k of Object.keys(output.findings)){
    queryParts.push("an.`" + k + "` = " + output.findings[k].isHit)
    queryParts.push("an.`rep_" + k + "` = ?")
    queryParams.push(output.findings[k].report) 

  }
  return {subQuery: queryParts.join(", "), params: queryParams}
}

async function markAsUnverified(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let query = "UPDATE " + parsedTable + " SET verified = 0 WHERE address = ?"
  try{
    let [data, fields] = await conn.query(query, address);
    if(!data.affectedRows){ 
      Utils.printQueryError(query, address, "Error marking address as unverified")
    }
    await deleteAddressFromPool(conn, chain, address)
    return true
  }
  catch(e){
    Utils.printQueryError(query, address, "Error marking address as unverified " + e.message)
    return false
  }
}

// contracts are marked as verified by default, and later set as unverified. This function is used for contracts verified days after deployment
async function markAsVerified(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let query = "UPDATE " + parsedTable + " SET verified = 1 WHERE address = ?"
  try{
    let [data, fields] = await conn.query(query, address);
    if(!data.affectedRows){ 
      Utils.printQueryError(query, address, "Error marking address as unverified")
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, address, "Error marking address as unverified " + e.message)
    return false
  }
}

async function pushSourceFiles(conn, chain, contractObj, contractAddress){
  // check if sourcefiles are https link, drop contract if so (hit rate 4/700k , close to no loss)
  for(let f of contractObj.SourceCode){
    let patt = "https://"
    if(f.filename.toLowerCase().substring(0, patt.length) == patt){
      // remove address from addresspool
      await deleteAddressFromPool(conn, chain, contractAddress)
      return 1
    }
  }

  // get address state variables object
  let stateVarsObj = Utils.getAddressVars(contractObj.SourceCode, contractObj.ContractName)

  // create contract record
  let queryFields = ["chain", "address", "contractName", "compilerVersion", "compilerVersion_int", "optimizationUsed", "runs", "constructorArguments", "EVMVersion", "library", "licenseType", "proxy", "implementation"]
  let queryParams = [chain, contractAddress, contractObj.ContractName, contractObj.CompilerVersion, contractObj.CompilerVersion_int, contractObj.OptimizationUsed, contractObj.Runs, 
    contractObj.ConstructorArguments,contractObj.EVMVersion, contractObj.Library, contractObj.LicenseType, contractObj.Proxy, contractObj.Implementation]
  if(stateVarsObj){ // no addr vars/mappings found, leave default NULL
    queryFields.push("addressVars")
    queryParams.push(JSON.stringify(stateVarsObj))
  }
  let contractQuery = "INSERT INTO contract (" + queryFields.join(",") + ") VALUES (" + "?,".repeat(queryFields.length - 1) + "?)"
  let contractID = await performInsertQuery(conn, contractQuery, queryParams, true)
  if(!contractID || contractID.error){
    if(contractID.error == 'ER_DUP_ENTRY'){
      console.log("WARNING - Trying to push a contract already inserted")
      await deleteAddressFromPool(conn, chain, contractAddress)
      return
    }
    console.log("ERROR - query error inserting contract", contractID.error)
    return
  } 

  // create empty balance record
  let balanceQuery = "INSERT INTO balances (chain, address) VALUES (?, ?)"
  let balanceID = await performInsertQuery(conn, balanceQuery, [chain, contractAddress])
  if(!balanceID || balanceID.error){
      console.log("WARNING - could not create empty balance for address " + contractAddress)
  } 


  // update source files
  let insertFileQuery 
  let sourcefileIDs = []
  for(let f of contractObj.SourceCode){
    // compute codehash
    let sourceHash = Utils.hash(f.source)
    // check if sourcehash is already in table, add contract_sourcefile record [ + push sourcefile]
    let previouslyFound = await getHashFromDB(conn, sourceHash)
    let csfID
    if(previouslyFound.length){ // same source already parsed, link new contract to old sourcefile
      let prevID = previouslyFound[0].ID
      csfID = await insertToContractSourcefile(conn, f.filename, contractID.data, prevID)
    }
    else{ // new source, push it + add contract_sourcefile entry
      insertFileQuery = "INSERT INTO sourcefile (sourceText, sourceHash) VALUES (?, ?)"
      let sourcecodeID = (await performInsertQuery(conn, insertFileQuery, [f.source, sourceHash])).data
      if(!sourcecodeID){
        console.log("ERROR inserting sourcefile for contract " + contractID.data)
        await deleteContract(conn, contractID.data) // delete inserted contract
        return null
      }
      csfID = await insertToContractSourcefile(conn, f.filename, contractID.data, sourcecodeID)
    }
    if(!csfID){
      console.log("ERROR - could not insert new record into contract_sourcefile") // proper logging will come 
    }
    else sourcefileIDs.push(csfID)

  }

  // compute sourcefile_signature to analyze only once the same contract deployed multiple times with different constructor parameters. hopefully most of the times
  let sourcefileSignature = sourcefileIDs.sort(function(a,b) { return a - b }).join("-") // separator for uniqueness
  let hashedSignature = Crypto.createHash('sha256').update(sourcefileSignature).digest('hex') // some contracts have > 100 (up to 180) different sourcefiles
  await updateSourcefileSignature(conn, contractID.data, hashedSignature)

  // create empty analysis record if not yet at db
  await insertAnalysisRecord(conn, hashedSignature)

  // remove address from addresspool
  await deleteAddressFromPool(conn, chain, contractAddress)

  // mark address as verified, in case of a succesful recheck
  await markAsVerified(conn, chain, contractAddress)

  return contractID.data
}

async function insertAnalysisRecord(conn, hashedSignature){
  // insert empty
  let query = "INSERT INTO slither_analysis (sourcefile_signature, error) VALUES (?, '')"
  await performInsertQuery(conn, query, hashedSignature, true) // ignore if sourcefile_signatre already in db
}

async function updateSourcefileSignature(conn, contractID, signature){
  let query = "UPDATE contract SET sourcefile_signature = ? WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, [signature, contractID]);
    if(!data.affectedRows){ 
      Utils.printQueryError(query, [signature, contractID], "Error updating sourcefile_signature. affectedRows=0")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, [signature, contractID], "Error updating sourcefile_signature", e.message)
    return false
  }
}


async function insertToContractSourcefile(conn, filename, contract, sourcefileID){
  let query = "INSERT INTO contract_sourcefile (contract,sourcefile,filename) VALUES (?,?,?)"
  try{
    let [data, fields] = await conn.query(query, [contract, sourcefileID, filename]);
    if(!data.insertId){
      Utils.printQueryError(query, [contract, sourcefileID, filename], "Error pushing analysis - " + e.message)
    }
    return data.insertId
  }
  catch(e){
    Utils.printQueryError(query, [contract, sourcefileID, filename], "Error pushing analysis - " + e.message)
    return false
  }
}

async function pushAddressesToPool(conn, chain, addressesList){
  // double check it has not been inserted 
  let inserted = 0, rechecks = 0
  for(let addr of addressesList){
    let prevInsert =  await getFromParsedPool(conn, chain, addr)
    if(!prevInsert.length || prevInsert[0].toRefresh == true){
      await pushAddressToPoolTable(conn, chain, addr, 'addresspool', true) // mute errors for (addr,chain) already in addresspool - in case of system stuck for a while ad addresspool full of stuff
      inserted++
      if(!prevInsert.length){
        await pushAddressToParsedTable(conn, chain, addr)
      }
      else{
        rechecks++
      }
    }
    if(prevInsert.length && prevInsert[0].verified == 1)  
      await updateLastTx(conn, chain, addr)
  }
  console.log((inserted - rechecks) + " of " + addressesList.length + " new contracts added to db, " + rechecks + " rechecks")
}

async function pushAddressesToPoolBatch(conn, chain, addressesList){
  let prevInsert =  await getFromParsedPoolBatch(conn, chain, addressesList)

  let newAddresses = addressesList.filter(e => prevInsert.filter(h => h.address.toLowerCase() == e.toLowerCase()).length == 0 ).map(e => Web3.utils.toChecksumAddress(e))
  let toRecheck = prevInsert.filter(e => e.verified == 0 && e.toRecheck == 1).map(e => Web3.utils.toChecksumAddress(e.address))
  let toInsert = newAddresses.concat(toRecheck)
  let toUpdateLastTx = prevInsert.filter(e => e.verified == 1).map(e => e.address)
  if(newAddresses.length)
    await pushAddressToParsedTableBatch(conn, chain, newAddresses)
  if(toInsert.length)
    await pushAddressToPoolTableBatch(conn, chain, toInsert, 'addresspool')
  
  if(toUpdateLastTx.length)
    await updateLastTxBatch(conn, chain, toUpdateLastTx)

  console.log(newAddresses.length + " of " + addressesList.length + " new contracts added to db, " + toRecheck.length + " rechecks")
}

async function updateLastTxBatch(conn, chain, addressBatch){
  addressList = "('" + addressBatch.map(e => e.toLowerCase()).join("','") + "')"
  let query = "UPDATE contract SET lastTx = NOW() WHERE chain = ? AND LOWER(address) IN " + addressList + ";"
  let err = 0
  while(err < 5){ // hack for deadlock issues inspected but not understood - most of the times 2 try is enough and is not worsening performances
    try{
      let [data, fields] = await conn.query(query, chain);
      break;
    }
    catch(e){
      console.log("Error updating lastTx")
      err++
    }
  }
}

async function updateLastTx(conn, chain, address){
  let query = "UPDATE contract SET lastTx = NOW() WHERE chain = ? AND LOWER(address) = ?"
  try{
    let [data, fields] = await conn.query(query, [chain, address.toLowerCase()]);
  }
  catch(e){
    Utils.printQueryError(query, [chain, address], "Error updating lastTx - " + e.message)
  }
}

async function pushAddressToParsedTable(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let insertQuery = "INSERT INTO " + parsedTable + " (address) VALUES (?);"
  return (await performInsertQuery(conn, insertQuery, [address], true, true)).data 
}

async function pushAddressToParsedTableBatch(conn, chain, addressBatch){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  addressBatch = addressBatch.map(e => "('" + e + "')")
  let insertQuery = "INSERT IGNORE INTO " + parsedTable + " (address) VALUES " + addressBatch.join(",")
  try{
    let [data, fields] = await conn.query(insertQuery);
  }
  catch(e){
    Utils.printQueryError(insertQuery, [], "Error inserting batch address to parsed table - " + e.message)
  }
}

async function pushAddressToPoolTable(conn, chain, address, table, muteErrors=false){
  let insertQuery = "INSERT INTO " + table + " (address, chain) VALUES (?,?);"
  let ret = (await performInsertQuery(conn, insertQuery, [address, chain], muteErrors) ).data
  return ret
}

async function pushAddressToPoolTableBatch(conn, chain, addressBatch, table){
  addressBatch = addressBatch.map(e => "('" + e + "','"+ chain +"')")
  let insertQuery = "INSERT IGNORE INTO " + table + " (address, chain) VALUES " + addressBatch.join(",")
  try{
    let [data, fields] = await conn.query(insertQuery);
  }
  catch(e){
    Utils.printQueryError(insertQuery, [], "Error pushAddressToPoolTableBatch - " + e.message)
  }
}

async function deleteAddressFromPool(conn, chain, address){
  let query = "DELETE FROM addresspool WHERE address = ? AND chain = ?"
  try{
    let [data, fields] = await conn.query(query, [address, chain]);
    if(!data.affectedRows){
      console.log("WARNING - Tried to delete address from addresspool but it was not there - " + address + " - " + chain)
    }
    return data.insertId
  }
  catch(e){
    Utils.printQueryError(query, [address, chain], e.message)
  }
}

async function deleteContract(conn, id){
  let query = "DELETE FROM contract WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, [id]);
    if(!data.affectedRows){
      console.log("WARNING - Tried to delete contract but it was not there - " + id)
    }
    return data.insertId
  }
  catch(e){
    Utils.printQueryError(query, [id], e.message)
  }
}

async function getAddressBatchFromPool(conn, chain){
  let query = "SELECT address FROM addresspool WHERE chain = ? LIMIT 200"
  try{
    let [data, fields] = await conn.query(query, chain);
    return data
  }
  catch(e){
    Utils.printQueryError(query, chain, e.message)
    return []
  }
}

async function performInsertQuery(conn, query, params, suppressError = false, isParsedPool = false){
  try{
    let [data, fields] = await conn.query(query, params);
    if(!data.affectedRows){
      if(!suppressError) 
        Utils.printQueryError(query, params, "0 affected rows")
      return {data: null}
    }
    if(!isParsedPool && !data.insertId){ // parsed pool (parsedaddress_eth_mainnet) doesn't have ID key
      if(!suppressError) 
        Utils.printQueryError(query, params, "insertID is null")
      return {data: null}
    }
    return {data: isParsedPool ? true : data.insertId}
  }
  catch(e){
    if(!suppressError) 
      Utils.printQueryError(query, params, e.message)
    return {data: null, error: e.code}
  }
}

async function getFromParsedPool(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let toRefreshSubQuery = (process.env.UNVERIFIED_RECHECK_ENABLED == 1) ? 
    "(verified = 0 AND (lastCheck + INTERVAL ? day) <= NOW() )" : "'0'"
  let query = "SELECT *, " + toRefreshSubQuery + " as toRefresh, verified FROM " + parsedTable + " WHERE address = ?"
  let queryParams = (process.env.UNVERIFIED_RECHECK_ENABLED == 1) ? [process.env.BLOCK_PARSER_VERIFIED_RECHECK_DAYS, address] : [address]
  try{
    let [data, fields] = await conn.query(query, queryParams);
    return data
  }
  catch(e){
    Utils.printQueryError(query, chain, e.message)
    return []
  }
}

async function getFromParsedPoolBatch(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let addressBatch = '("' + address.map(e => e.toLowerCase()).join('","') + '")'
  let recheckCondition = "(verified = 0 AND (lastCheck + INTERVAL ? day) <= NOW() )"

  let query = "SELECT address, verified, "+recheckCondition+" AS toRecheck FROM " + parsedTable + " WHERE LOWER(address) IN " + addressBatch 

  let queryParams = (process.env.UNVERIFIED_RECHECK_ENABLED == 1) ? process.env.BLOCK_PARSER_VERIFIED_RECHECK_DAYS : null
  try{
    let [data, fields] = await conn.query(query, queryParams);
    return data
  }
  catch(e){
    Utils.printQueryError(query, chain, e.message)
    return []
  }
}

async function getDBConnection(){
  return await Database.getDBConnection()
}

module.exports = {updateLastSolcCommit, getLastSolcCommit, updateFlagReflectionDate, flagReflection, getContractHavingAddressInVars, getFlaggedContractsToReflect, pushAddressesToPoolBatch, getFromCache, updateCache, updateProxyImplAddress, getBatchProxiesToRead, updateAddressVars, getBatchVarsToRead, getContractFiles, keepAlive, addSlitherAnalysisColumns, getSlitherAnalysisColumns, updateLastParsedBlockDownward, getLastParsedBlockDownward, getLastBackupDB, updateLastBackupDB, updateLastParsedBlock, getLastParsedBlock, insertToContractSourcefile, getHashFromDB, performInsertQuery, markAsUnverified, updateBalance, getAddressesOldBalance, pushSourceFiles, markContractAsErrorAnalysis, getDBConnection, pushAddressesToPool, deleteAddressFromPool, getAddressBatchFromPool, insertFindingsToDB, markContractAsAnalyzed, getBatchToAnalyze};