const Database = require('./DB');
const Utils = require('./Utils');



async function getBatchToAnalyze(conn, len){
  let query = "SELECT sf.* FROM contract AS c INNER JOIN sourcefile AS sf ON c.ID=sf.contract WHERE c.analyzed_std=0 AND c.analyzed_error=0 LIMIT " + (len * 5) // on avg 5 files per contract
  try{
    let [data, fields] = await conn.query(query);
    if(!data.length){
      console.log("ERROR - Can't get contracts to analyze - length = 0")
      return data
    }
    let lastContract = data.at(-1).contract
    data = data.filter(e => e.contract != lastContract) // last contract may lack some files
    let contracts = []
    for(let d of data)
      if(!contracts.includes(d.contract)) 
        contracts.push(d.contract)
    let returnData = []
    for(let c of contracts){
      let files = data.filter(e => e.contract == c)
      returnData.push({ID: c, files: files})
    }
    return returnData
  }
  catch(e){
    console.log("ERROR - Can't get contracts to analyze", e.message)
  }
}

async function markContractAsAnalyzed(conn, contractID){
  let query = "UPDATE contract set `analyzed_std` = 1, `analyzed_error` = 0 WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, contractID);
    if(!data.affectedRows){
      Utils.printQueryError(query, contractID, "Error setting contract as analyzed_error")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, contractID, "Error setting contract as analyzed_error - " + e.message)
    return false
  }
}

async function markContractAsErrorAnalysis(conn, contractID){
  let query = "UPDATE contract set `analyzed_error` = 1 WHERE ID = ?"
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
  let query = Object.keys(findings.findings).length ?
    "INSERT INTO analysis (contract,report,`" + Object.keys(findings.findings).join("`,`") + "`) VALUES (" + [contractID, "?", ...Object.values(findings.findings)].join(",") + ")"
    :
    "INSERT INTO analysis (contract) VALUES (" + contractID + ")"
  console.log(query)
  try{
    let [data, fields] = await conn.query(query, findings.report);
    if(!data.affectedRows){
      Utils.printQueryError(query, [], "Error pushing analysis")
      return {data: null}
    }
    if(!data.insertId){
      Utils.printQueryError(query, [], "Error pushing analysis - insertID is null")
      return {data: null}
    }
    await markContractAsAnalyzed(conn, contractID)
    console.log("#" + contractID + " inserted to database") 
    return data.insertId
  }
  catch(e){
    Utils.printQueryError(query, [], "Error pushing analysis - " + e.message)
    return {data: null}
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

  // update source files
  let insertFileQuery 
  for(let f of contractObj.SourceCode){
    insertFileQuery = "INSERT INTO sourcefile (contract, name, sourceText) VALUES (?, ?, ?)"
    let sourcecodeID = (await performInsertQuery(conn, insertFileQuery, [contractID.data, f.filename, f.source])).data
    if(!sourcecodeID){
      console.log("ERROR inserting sourcefile for contract " + contractID.data)
      await deleteContract(conn, chain, contractID.data) // delete inserted contract
      return null
    }
  }

  // remove address from addresspool
  await deleteAddressFromPool(conn, chain, contractAddress)

  return contractID.data
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
  console.log(inserted + " of " + addressesList.length + " new addresses added to db")
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
    Utils.printQueryError(query, params, e.message)
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
    Utils.printQueryError(query, params, e.message)
  }
}

async function getAddressBatchFromPool(conn, chain){
  let query = "SELECT address FROM addresspool WHERE chain = ? LIMIT 50"
  try{
    let [data, fields] = await conn.query(query, chain);
    return data
  }
  catch(e){
    Utils.printQueryError(query, params, e.message)
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

module.exports = {pushSourceFiles, markContractAsErrorAnalysis, getDBConnection, pushAddressesToPool, deleteAddressFromPool, getAddressBatchFromPool, insertFindingsToDB, markContractAsAnalyzed, getBatchToAnalyze};