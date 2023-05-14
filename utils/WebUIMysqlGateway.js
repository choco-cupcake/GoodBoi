const crypto = require("crypto");
const Database = require('./DB')

async function getCompilationErrors(conn){
  let query = "SELECT an.error, COUNT(an.error) AS count FROM contract AS c INNER JOIN slither_analysis AS an ON c.sourcefile_signature = an.sourcefile_signature WHERE an.failedAnalysis > 0 GROUP BY an.error;"
  try{
    let [data, fields] = await conn.query(query)
    return data
  }
  catch(e){
    console.log("ERROR - Can't get compilation errors ", e.message)
    return {error: "Query error"}
  }
}

async function getContractsLast24h(conn){
  let query = "SELECT COUNT(*) AS c FROM contract WHERE dateFound > NOW() - INTERVAL 1 DAY"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get contracts last 24h")
      return {error: "Query error"}
    }
    return {count: data[0].c}
  }
  catch(e){
    console.log("ERROR -Can't get contracts last 24h ", e.message)
    return {error: "Query error"}
  }
}

async function getContractsPerChain(conn, flagged = false){
  let flaggedQ = flagged ? " WHERE (C.poolFlag=1 OR C.balanceFlag=1 OR C.reflPoolFlag=1 OR C.reflBalanceFlag=1) " : ""
  let query = "SELECT `chain`, COUNT(*) AS c FROM contract AS C " + flaggedQ + " GROUP BY `chain`"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      console.log("ERROR - Can't get contracts by chain")
      return {error: "Query error"}
    }
    let outObj = {}
    for(let d of data)
      outObj[d.chain] = d.c
    return outObj
  }
  catch(e){
    console.log("ERROR -Can't get contracts by chain ", e.message)
    return {error: "Query error"}
  }
}

async function getTokenUser(conn, token){
  let query = "SELECT user FROM webui_user_token WHERE token=? AND DATE_SUB(NOW(), INTERVAL 2 DAY) < datareg"
  try{
    let [data, fields] = await conn.query(query, token)
    if(!data.length){
      return null
    }
    return data[0].user
  }
  catch(e){
    console.log("ERROR -Can't get token user ", e.message)
    return null
  }
}


async function getAvailableDetectors(conn, user, revState){
  ret = []
  let detectorsAvail = await getUserDetectors(conn, user)
  let detectorsAvailArr = detectorsAvail.split(",")
  for(let det of detectorsAvailArr){
    let count = await getDetectorHitsCount(conn, det, revState)
    ret.push({name: det, count: count})
  }
  return ret
}

async function getUserDetectors(conn, user){
  let query = "SELECT detectors FROM webui_user WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, user)
    return data[0].detectors
  }
  catch(e){
    console.log("ERROR - Can't detectors list", e.message)
    return {error: "Query error"}
  }
}

async function getDetectorHitsCount(conn, detector, revState){
  let query = "SELECT count(*) AS c FROM slither_analysis AS sa CROSS JOIN contract AS c ON c.sourcefile_signature = sa.sourcefile_signature WHERE `" + detector + "`= 1 AND `manualRev_" + detector + "` = ?"
  try{
    let [data, fields] = await conn.query(query, revState)
    if(!data.length){
      return {error: "Query error"}
    }
    return data[0].c
  }
  catch(e){
    console.log("ERROR -Can't get det hit count", e.message)
    return {error: "Query error"}
  }
}

async function getAnalysisCount(conn, detector){
  let query = "SELECT count(*) AS count FROM slither_analysis AS sa CROSS JOIN contract AS c ON c.sourcefile_signature = sa.sourcefile_signature WHERE `" + detector + "` != -1"
  try{
    let [data, fields] = await conn.query(query)
    if(!data.length){
      return {error: "Query error"}
    }
    return data[0]
  }
  catch(e){
    console.log("ERROR -Can't get det hit count", e.message)
    return {error: "Query error"}
  }
}

async function getDetectorHits(conn, user, detector, revState, offset){
  let availDetectors = await getUserDetectors(conn, user)
  if(!availDetectors.includes(detector))
    return {error: "Unauthorized"}

  let query = "SELECT sa.ID, c.address, c.chain, sa.`rep_" + detector + "` AS report, c.poolFlag AS PF, c.balanceFlag AS BF, c.reflPoolFlag AS RPF, c.reflBalanceFlag AS RBF, c.lastTX, analysisDate AS anDate, c.compilerVersion FROM slither_analysis AS sa CROSS JOIN contract AS c ON c.`sourcefile_signature` = sa.`sourcefile_signature` WHERE sa.`" + detector + "` = 1 AND sa.`manualRev_" + detector + "` = ? ORDER BY analysisDate DESC LIMIT 500 OFFSET " + offset
  try{
    let [data, fields] = await conn.query(query, revState)
    return data
  }
  catch(e){
    console.log("ERROR -Can't get det hits", e.message)
    return {error: "Query error"}
  }
}

async function updateRevState(conn, user, id, detector, revState){
  let availDetectors = await getUserDetectors(conn, user)
  if(!availDetectors.includes(detector))
    return {error: "Unauthorized"}
  if(isNaN(revState) || revState < 0 || revState > 4)
    return {error: "Bad revState"}
  if(isNaN(id))
    return {error: "Bad id"}

  let field = "manualRev_" + detector
  let query = "UPDATE slither_analysis SET `" + field + "` = ? WHERE ID = ?"
  try{
    let [data, fields] = await conn.query(query, [revState, id])
    if(!data.affectedRows){
      return {error: "No row affected"}
    }
    return {status: "200"}
  }
  catch(e){
    console.log("ERROR -Can't update revState ", e.message)
    return {error: "Query error"}
  }
}

async function login(conn, username, pass){
  let hashedPass = crypto.createHash('sha256').update(pass).digest('base64');
  let query = "SELECT ID FROM webui_user WHERE username = ? AND pass = ?"
  try{
    let [data, fields] = await conn.query(query, [username, hashedPass])
    if(!data.length){
      return {error: true}
    }
    let userID = data[0].ID
    return {token: await createToken(conn, userID)}
  }
  catch(e){
    console.log("ERROR -Can't login ", e.message)
    return {error: true}
  }
}

async function createToken(conn, userID){
  let token = crypto.randomBytes(20).toString('hex');
  let query = "INSERT INTO webui_user_token (token, user) VALUES(?, ?)"
  try{
    await conn.query(query, [token, userID])
    return token
  }
  catch(e){
    console.log("ERROR -Can't set token ", e.message)
    return {error: true}
  }
}

async function getDBConnection(){
  return await Database.getDBConnection()
}

module.exports = {getDBConnection, login, getTokenUser, getDetectorHits, getCompilationErrors, getContractsLast24h, getContractsPerChain, getAvailableDetectors, updateRevState, getAnalysisCount, getUserDetectors, getDetectorHitsCount}