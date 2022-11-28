const Database = require('./DB');
const Utils = require('./Utils');


async function updateLastParsedBlock(conn, block){
  let query = "UPDATE status set `lastParsedBlock_eth_mainnet` = ? WHERE ID = 1"
  try{
    let [data, fields] = await conn.query(query, block);
    if(!data.affectedRows){
      Utils.printQueryError(query, block, "Error setting lastParsedBlock_eth_mainnet")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, block, "Error setting lastParsedBlock_eth_mainnet - " + e.message)
    return false
  }
}

async function getLastParsedBlock(conn){
    let query = "SELECT lastParsedBlock_eth_mainnet FROM status WHERE ID=1;"
    try{
      let [data, fields] = await conn.query(query)
      if(!data.length){
        console.log("WARNING - Can't get last parsed block - length = 0")
        return null
      }
      return data
    }
    catch(e){
      console.log("ERROR - Can't get last parsed block", e.message)
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

async function getAddressesOldBalance(conn, chain, daysOld){
  let query = "SELECT ID, address FROM balances WHERE chain=? AND lastUpdate < NOW() - INTERVAL ? DAY LIMIT 3000"
  try{
    let [data, fields] = await conn.query(query, [chain, daysOld]);
    return data
  }
  catch(e){
    Utils.printQueryError(query, chain, e.message)
    return []
  }
}

async function getBatchToAnalyze(conn, len, chain, minUsdValue, detectors){
// analysis table analyzes sourcefile, not contract. results viewer will get related contracts


  let endOfResults = false
  let limit = (len * 5) // 5 files per contract on avg
  let detSub = buildDetectorsFindSubquery(detectors)
  let query = ''.concat("SELECT DISTINCT sf.* FROM contract AS c ",  
            "INNER JOIN contract_sourcefile AS csf ON csf.contract = c.ID ",
            "INNER JOIN sourcefile AS sf ON csf.sourcefile=sf.ID ",
            "INNER JOIN balances AS b ON b.chain = c.chain and b.address = c.address ",
            "LEFT JOIN analysis AS an ON an.contract = c.ID ",
            "WHERE c.chain = ? AND b.usdValue >= ? AND c.compiler_error=0 ", // AND c.analyzed_std=0 
            detSub,  // keeps only contracts not yet analyzed for these detectors (NULL if contract has not been analyzed yet for any detector)
            "LIMIT ", limit)
  console.log(query)
  try{
    let [data, fields] = await conn.query(query, [chain, minUsdValue])
    if(!data.length){
      console.log("WARNING - Can't get contracts to analyze - length = 0")
      return {eor: true, data: []}
    }
    if(data.length < limit){
      endOfResults = true
    }
    else{
      let lastContract = data.at(-1).contract
      data = data.filter(e => e.contract != lastContract) // last contract may lack some files
    }
    let contracts = []
    for(let d of data) // group files by contract
      if(!contracts.includes(d.contract)) 
        contracts.push(d.contract)
    let returnData = []
    for(let c of contracts){
      let files = data.filter(e => e.contract == c)
      returnData.push({ID: c, files: files})
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
    ret.push("(an.`" + d + "` IS NULL OR an.`" + d + "`=-1)")
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

async function markContractAsErrorAnalysis(conn, contractID){
  let query = "UPDATE contract set `compiler_error` = 1 WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, contractID);
    if(!data.affectedRows){
      Utils.printQueryError(query, contractID, "Error setting contract as analyzed")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, contractID, "Error setting contract as analyzed - " + e.message)
    return false
  }
}


async function insertFindingsToDB(conn, contractID, findings){ 
  // try to update the existing record, insert if update fails 
  let query = "UPDATE analysis SET " + buildFindingsUpdateSubquery(findings.findings) + " WHERE contract = ?"
  try{
    let [data, fields] = await conn.query(query, [contractID]);
    if(!data.affectedRows){ // contract not yet analyzed by any detector
      return _insertFindingsToDB(conn, contractID, findings) // insert new record
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, [contractID, findings.findings], "Error updating analysis record - " + e.message)
    return false
  }
}

function buildFindingsUpdateSubquery(findings){
  let ret = []
  for(let k of Object.keys(findings))
    ret.push("`" + k + "` = " + findings[k])
  return ret.join(", ")
}

async function _insertFindingsToDB(conn, contractID, findings){ 
  let query = "INSERT INTO analysis (contract,report,`" + Object.keys(findings.findings).join("`,`") + "`) VALUES (" + [contractID, "?", ...Object.values(findings.findings)].join(",") + ")"
  console.log(query)
  try{
    let [data, fields] = await conn.query(query, findings.report);
    if(!data.affectedRows){
      Utils.printQueryError(query, [], "Error pushing analysis")
      return false
    }
    if(!data.insertId){
      Utils.printQueryError(query, [], "Error pushing analysis - insertID is null")
      return false
    }
    await markContractAsAnalyzed(conn, contractID) // temporary to track analyzed contract, to be removed once everything is stable
    console.log("#" + contractID + " inserted to database") 
    return true
  }
  catch(e){
    Utils.printQueryError(query, [], "Error pushing analysis - " + e.message)
    return false
  }
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
  let contractQuery = "INSERT INTO contract (chain, address, contractName, compilerVersion, optimizationUsed, runs, constructorArguments, EVMVersion, library, licenseType, proxy, implementation, swarmSource)" +
    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
  let contractID = await performInsertQuery(conn, contractQuery, [chain, contractAddress, contractObj.ContractName, contractObj.CompilerVersion, contractObj.OptimizationUsed, contractObj.Runs, 
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
  for(let f of contractObj.SourceCode){
    // compute codehash
    let sourceHash = Utils.hash(f.source)
    // check if sourcehash is already in table, add contract_sourcefile record [ + push sourcefile]
    let previouslyFound = await getHashFromDB(conn, sourceHash)
    let csfID
    if(previouslyFound.length){ // same source already parsed, link new contract to old sourcefile
      let prevID = previouslyFound[0].ID
      csfID = await insertToContractSourcefile(conn, contractID.data, prevID)
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
      console.log("ERROR - could not insert new record into contract_sourcefile")
    }
  }

  // remove address from addresspool
  await deleteAddressFromPool(conn, chain, contractAddress)

  return contractID.data
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
  let inserted = 0
  for(let addr of addressesList){
    let insertID = await pushAddressToParsedTable(conn, chain, addr)
    if(insertID){ // it has been inserted in the table, it means it's new
      let error = 1
      while(error <= 5){
        if(await pushAddressToPoolTable(conn, chain, addr, 'addresspool')){
          inserted++
          break
        }
        console.log("Error inserting addr " + addr + " to pool. Error #" + error)
        error++
        await Utils.sleep(200)
      }
    }
  }
  console.log(inserted + " of " + addressesList.length + " new contracts added to db")
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


async function getDBConnection(){
  return await Database.getDBConnection()
}

module.exports = {updateLastParsedBlock, getLastParsedBlock, insertToContractSourcefile, getHashFromDB, performInsertQuery, markAsUnverified, updateBalance, getAddressesOldBalance, pushSourceFiles, markContractAsErrorAnalysis, getDBConnection, pushAddressesToPool, deleteAddressFromPool, getAddressBatchFromPool, insertFindingsToDB, markContractAsAnalyzed, getBatchToAnalyze};