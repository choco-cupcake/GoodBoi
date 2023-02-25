const Database = require('./DB')
const Utils = require('./Utils')
const Crypto = require('crypto')

async function addSlitherAnalysisColumns(conn, columnName){
  let query = "ALTER TABLE slither_analysis ADD COLUMN `" + columnName + "` TINYINT DEFAULT -1 AFTER failedAnalysis;"
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
  let query = "SELECT `COLUMN_NAME` FROM `INFORMATION_SCHEMA`.`COLUMNS` WHERE `TABLE_SCHEMA`='goodboi' AND `TABLE_NAME`='slither_analysis' AND `COLUMN_NAME` NOT IN ('ID','sourcefile_signature','failedAnalysis','report','error','analysisDate');"
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

async function updateBalance(conn, chain, contractAddress, ERC20USDValue, ERC20Holdings, eth_balance){
  let query = "UPDATE balances SET ERC20Holdings = ?, usdValue = ?, ethBalance_bp = ?, lastUpdate = NOW() WHERE address = ? AND chain = ?"
  try{
    let [data, fields] = await conn.query(query, [ERC20Holdings, ERC20USDValue, eth_balance, contractAddress, chain]);
    if(!data.affectedRows){
      Utils.printQueryError(query, [ERC20Holdings, ERC20USDValue, eth_balance, contractAddress, chain], "Error updating balance - row not found")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, [ERC20Holdings, ERC20USDValue, eth_balance, contractAddress, chain], "Error updating balance - " + e.message)
    return false
  }
}

async function getAddressesOldBalance(conn, chain, daysOld, batchSize){
  let query = "SELECT ID, address FROM balances WHERE chain=? AND lastUpdate < NOW() - INTERVAL ? DAY LIMIT ?"
  try{
    let [data, fields] = await conn.query(query, [chain, daysOld, +batchSize]);
    return data
  }
  catch(e){
    Utils.printQueryError(query, [chain, daysOld, +batchSize], e.message)
    return []
  }
}

async function getBatchToAnalyze(conn, len, chain, minUsdValue, detectors){
// analysis table analyzes sourcefile, not contract. results viewer will get related contracts
  let endOfResults = false
  let detSub = buildDetectorsFindSubquery(detectors)
  let query = ''.concat(
    "SELECT DISTINCT c.sourcefile_signature, c.compilerVersion, csf.contract, csf.filename, sf.*, an.* FROM contract AS c ",
    "INNER JOIN contract_sourcefile AS csf ON csf.contract = c.ID ",
    "INNER JOIN sourcefile AS sf ON csf.sourcefile=sf.ID ",
    "INNER JOIN slither_analysis AS an ON an.sourcefile_signature = c.sourcefile_signature ",
    "INNER JOIN ( ",
    "  SELECT DISTINCT c.sourcefile_signature FROM contract AS c ",
    minUsdValue != 0 ? "  INNER JOIN balances AS b ON b.chain = c.chain and b.address = c.address " : "",
    "  INNER JOIN slither_analysis AS an ON an.sourcefile_signature = c.sourcefile_signature ",
    chain != 'all' ? "  WHERE c.chain = 'POLYGON' " : "",
    minUsdValue != 0 ? "  AND b.usdValue >= 0 " : "",
    "  AND an.failedAnalysis = 0 ",
    detSub, // keeps only contracts not yet analyzed for these detectors
    "  LIMIT " + len,
    ") AS t1 ON c.sourcefile_signature = t1.sourcefile_signature;"
  )

  // build query params array
  let queryParams = []
  if(chain != 'all') queryParams.push(chain)
  if(minUsdValue != 0) queryParams.push(minUsdValue)

  try{
    let [data, fields] = await conn.query(query, queryParams)
    if(!data.length){
      console.log("WARNING - Can't get contracts to analyze - length = 0")
      return {eor: true, data: []}
    }
    if(data.length < limit){
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
      let usedDetectors = Object.keys(files[0]).filter(e => !['sourcefile_signature', 'filename',  'ID',  'sourceText',  'sourceHash',  'failedAnalysis',  'report'].includes(e) && files[0][e] != '-1')
      let detectorsToUse = detectors.filter(e => !usedDetectors.includes(e)) // detectors set by the user - detectors already run on this contract
      returnData.push({ID: c.ID, files: files, detectors: detectorsToUse, sourcefile_signature: c.sourcefile_signature})

    }
    return {eor: endOfResults, data: returnData}
  }
  catch(e){
    console.log("ERROR - Can't get contracts to analyze", e.message)
    process.exit()
  }
}

function buildDetectorsFindSubquery(detectors){
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
    "UPDATE slither_analysis AS an SET an.failedAnalysis = an.failedAnalysis + 1, an.error = ? WHERE an.sourcefile_signature = ?"
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
  let query = "UPDATE slither_analysis AS an SET " + buildFindingsUpdateSubquery(output) + ", an.analysisDate = NOW() WHERE an.sourcefile_signature = ?"
  try{
    let [data, fields] = await conn.query(query, [output.report, sourcefile_signature]);
    if(!data.affectedRows){ 
      Utils.printQueryError(query, [contractID, output.findings], "Error updating analysis record - 0 affected rows")
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
  let ret = []
  for(let k of Object.keys(output.findings))
    ret.push("an.`" + k + "` = " + output.findings[k])
  ret.push("an.report = ?")
  return ret.join(", ")
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

async function pushSourceFiles(conn, chain, contractObj, contractAddress){
  // create contract record
  let contractQuery = "INSERT INTO contract (chain, address, contractName, compilerVersion, compilerVersion_int, optimizationUsed, runs, constructorArguments, EVMVersion, library, licenseType, proxy, implementation, swarmSource)" +
    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  let contractID = await performInsertQuery(conn, contractQuery, [chain, contractAddress, contractObj.ContractName, contractObj.CompilerVersion, contractObj.CompilerVersion_int, contractObj.OptimizationUsed, contractObj.Runs, 
    contractObj.ConstructorArguments,contractObj.EVMVersion, contractObj.Library, contractObj.LicenseType, contractObj.Proxy, contractObj.Implementation, contractObj.SwarmSource], true)
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
        await deleteContract(conn, chain, contractID.data) // delete inserted contract
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
  return contractID.data
}

async function insertAnalysisRecord(conn, hashedSignature){
  // insert empty
  let query = "INSERT INTO slither_analysis (sourcefile_signature, report, error) VALUES (?, '', '')"
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
      await pushAddressToPoolTable(conn, chain, addr, 'addresspool')
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

async function updateLastTx(conn, chain, address){
  let query = "UPDATE contract SET lastTx = NOW() WHERE chain = ? AND address = ?"
  try{
    let [data, fields] = await conn.query(query, [chain, address]);
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

async function pushAddressToPoolTable(conn, chain, address, table){
  let insertQuery = "INSERT INTO " + table + " (address, chain) VALUES (?,?);"
  let ret = (await performInsertQuery(conn, insertQuery, [address, chain]) ).data
  return ret
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

async function deleteContract(conn, chain, id){
  let query = "DELETE FROM contract WHERE ID = ? AND chain = ?"
  try{
    let [data, fields] = await conn.query(query, [id, chain]);
    if(!data.affectedRows){
      console.log("WARNING - Tried to delete contract but it was not there - " + address + " - " + chain)
    }
    return data.insertId
  }
  catch(e){
    Utils.printQueryError(query, [id, chain], e.message)
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
  let query = "SELECT *, (verified = 0 AND (lastCheck + INTERVAL ? day) <= NOW() ) as toRefresh, verified FROM " + parsedTable + " WHERE address = ?"
  try{
    let [data, fields] = await conn.query(query, [address, process.env.BLOCK_PARSER_VERIFIED_RECHECK_DAYS]);
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

module.exports = {addSlitherAnalysisColumns, getSlitherAnalysisColumns, updateLastParsedBlockDownward, getLastParsedBlockDownward, getLastBackupDB, updateLastBackupDB, updateLastParsedBlock, getLastParsedBlock, insertToContractSourcefile, getHashFromDB, performInsertQuery, markAsUnverified, updateBalance, getAddressesOldBalance, pushSourceFiles, markContractAsErrorAnalysis, getDBConnection, pushAddressesToPool, deleteAddressFromPool, getAddressBatchFromPool, insertFindingsToDB, markContractAsAnalyzed, getBatchToAnalyze};