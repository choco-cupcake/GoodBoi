const Database = require('./goodboiDB');

async function getFromCache(conn, tag){
  let query = "SELECT value FROM cache WHERE tag = ? AND datareg + INTERVAL expire_minutes MINUTE > NOW()"
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

async function getDetectorHitCount(conn, detector, value){
  let query = "SELECT COUNT(*) AS count FROM slither_analysis WHERE `" + detector + "` = ?"
  try{
    let [data, fields] = await conn.query(query, value)
    if(!data.length){
      console.log("ERROR - Can't get detector hit counts")
      return null
    }
    return data[0].count
  }
  catch(e){
    console.log("ERROR -Can't get detector hit counts", e.message)
    return null
  }
}

async function getCompilationErrors(conn){
  let query = "SELECT an.error, COUNT(an.error) AS count FROM contract AS c INNER JOIN slither_analysis AS an ON c.ID = an.contract WHERE an.failedAnalysis > 0 GROUP BY an.error;"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get compilation errors")
      return null
    }
    return data
  }
  catch(e){
    console.log("ERROR -Can't get compilation errors", e.message)
    return null
  }
}

async function getSourcefilesCount(conn){
  let query = "SELECT COUNT(*) AS c FROM sourcefile"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get sourcefiles count")
      return null
    }
    return data[0].c
  }
  catch(e){
    console.log("ERROR -Can't get sourcefiles count", e.message)
    return null
  }
}

async function getContractsLast24h(conn){
  let query = "SELECT COUNT(*) AS c FROM contract WHERE dateFound > NOW() - INTERVAL 1 DAY"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get contracts last 24h")
      return null
    }
    return data[0].c
  }
  catch(e){
    console.log("ERROR -Can't get contracts last 24h", e.message)
    return null
  }
}

async function getContractsPerChain(conn){
  let query = "SELECT `chain`, COUNT(*) AS c FROM contract GROUP BY `chain`"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get contracts by chain")
      return null
    }
    let outObj = {}
    for(let d of data)
      outObj[d.chain] = d.c
    return outObj
  }
  catch(e){
    console.log("ERROR -Can't get contracts by chain", e.message)
    return null
  }
}

async function getSlitherAnalysisColumns(conn){
  let query = "SELECT `COLUMN_NAME` FROM `INFORMATION_SCHEMA`.`COLUMNS` WHERE `TABLE_SCHEMA`='goodboi' AND `TABLE_NAME`='slither_analysis' AND `COLUMN_NAME` NOT IN ('ID', 'report', 'failedAnalysis', 'error', 'contract');"
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

async function getDBConnection(){
  return await Database.getDBConnection()
}

module.exports = {getFromCache, updateCache, getSlitherAnalysisColumns, getDetectorHitCount, getCompilationErrors, getSourcefilesCount, getContractsLast24h, getContractsPerChain, getDBConnection}