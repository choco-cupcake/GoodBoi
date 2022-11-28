const Database = require('./DB')
const Utils = require('./Utils')

async function getDBConnection(){
  return await Database.getDBConnection()
}

async function updateLastParsedAddress(conn, chain, address){
  let field = 'lastParsedAddress_' + chain.toLowerCase()
  let query = "UPDATE status set `" + field + "` = ? WHERE ID = 1"
  try{
    let [data, fields] = await conn.query(query, address);
    if(!data.affectedRows){
      Utils.printQueryError(query, address, "Error setting lastParsedBlock_eth_mainnet")
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, address, "Error setting lastParsedBlock_eth_mainnet - " + e.message)
    return false
  }
}

async function getLastParsedAddress(conn, chain){
  let field = 'lastParsedAddress_' + chain.toLowerCase()
  let query = "SELECT `" + field + "` FROM status WHERE ID=1;"
   try{
      let [data, fields] = await conn.query(query)
      if(!data.length){
        console.log("WARNING - Can't get last parsed address - length = 0")
        return null
      }
      return data[0][field]
    }
    catch(e){
      console.log("ERROR - Can't get last parsed address", e.message)
      return null
    }
}

async function pushVerifiedAddresses(conn, chain, addressesList){
  // double check it has not been inserted 
  let inserted = 0
  for(let addr of addressesList){
    if(!await pushAddressToPoolTable(conn, chain, addr, 'addresspool')){
     console.log("Error inserting addr " + addr + " to pool")
     continue
    }
    let previouslyFound = await setContractVerified(conn, chain, addr)
    if(previouslyFound){
      console.log("Found previously inserted address, set to verified=1")
    } else{
      console.log("Found new address, set to verified=1")
      pushAddressToParsedTable(conn, chain, addr)  
    }
  }
  console.log(inserted + " of " + addressesList.length + " new addresses added to db")
  return inserted
}


async function pushAddressToParsedTable(conn, chain, address){
    // try to update verified=1
    // if fail, insert new record
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let insertQuery = "INSERT INTO " + parsedTable + " (address) VALUES (?);"
  return (await performInsertQuery(conn, insertQuery, [address], true, true)).data 
}

async function pushAddressToPoolTable(conn, chain, address, table){
  let insertQuery = "INSERT INTO " + table + " (address, chain) VALUES (?,?);"
  let ret = (await performInsertQuery(conn, insertQuery, [address, chain]) ).data
  return ret
}

async function setContractVerified(conn, chain, address){
  let parsedTable = 'parsedaddress_' + chain.toLowerCase()
  let query = "UPDATE " + parsedTable + " SET verified = 1 WHERE address = ?"
  try{
    let [data, fields] = await conn.query(query, address);
    if(!data.affectedRows){
      return false
    }
    return true
  }
  catch(e){
    Utils.printQueryError(query, address, "Error setting verified=1 on lastParsedBlock_eth_mainnet - " + e.message)
    return false
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


module.exports = {updateLastParsedAddress, getDBConnection, pushVerifiedAddresses, getLastParsedAddress}