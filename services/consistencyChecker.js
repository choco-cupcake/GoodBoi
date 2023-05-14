// this module will cover for edge case bugs, eg deadlocks on inserts
const mysql = require('../utils/MysqlGateway');
const Crypto = require('crypto')
const Utils = require('../utils/Utils')
require("dotenv").config()

let dbConn

main()

async function main(){
  while(true){
    console.log("loop started")
    dbConn = await mysql.getDBConnection()
    let start = Date.now()

    await fixSourcefileSignature()
    await checkAnalysisRecords()
    await checkBalanceRecords()

    // TODO redownload failed analysis

    let toWait = process.env.CONSISTENCY_CHECKER_INTERVAL * 60 * 60 * 1000 - (Date.now() - start)
    if(toWait > 0){
      await Utils.sleep(toWait)
    }
  }
}

async function fixSourcefileSignature(){
  let toFix = await mysql.getContractsNullSignature(dbConn)
  for (tf of toFix){
    let sourcefileIDs = await mysql.getSourcefileIDs(dbConn, tf.ID)
    if(!sourcefileIDs.length){
      console.log("ERROR - No sourcefiles detected for contract #" + tf.ID) 
      // messed up, redownload
      await mysql.pruneContract(dbConn, null, null, tf)
      await mysql.pushAddressToPoolTable(dbConn, tf.chain, tf.address, 'addresspool')
      continue
    }
    let sourcefileSignature = sourcefileIDs.sort(function(a,b) { return a - b }).join("-")
    let hashedSignature = Crypto.createHash('sha256').update(sourcefileSignature).digest('hex')
    await mysql.updateSourcefileSignature(dbConn, tf.ID, hashedSignature)
    console.log("Inserted signature for contract #" + tf.ID + " : " + hashedSignature)
  }
}

async function checkAnalysisRecords(){
  // insert select single query
  let q = `INSERT INTO slither_analysis (sourcefile_signature, error)
  SELECT DISTINCT c.sourcefile_signature,'' FROM contract AS c 
  LEFT JOIN slither_analysis AS an ON an.sourcefile_signature=c.sourcefile_signature
  WHERE an.ID IS NULL AND c.sourcefile_signature IS NOT NULL;`
  try{
    let [data, fields] = await dbConn.query(q)
    if(data.affectedRows){
      console.log("WARNING - Analysis row was inserted - ", JSON.stringify(data.affectedRows))

    }
  }
  catch(e){
    console.log("ERROR - checkAnalysisRecords ", e.message)
  }
}

async function checkBalanceRecords(){
  // insert select single query
  let q = "INSERT INTO balances (`chain`, address) SELECT c.`chain`, c.address FROM contract AS c LEFT JOIN balances AS b ON b.chain=c.chain AND b.address=c.address WHERE b.ID IS NULL AND c.sourcefile_signature IS NOT NULL;"
  try{
    let [data, fields] = await dbConn.query(q)
    if(data.affectedRows){
      console.log("WARNING - Analysis row was inserted - ", JSON.stringify(data.affectedRows))

    }
  }
  catch(e){
    console.log("ERROR - checkBalanceRecords ", e.message)
  }
}