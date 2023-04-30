const mysql = require('../utils/MysqlGateway');
const crypto = require("crypto")

let username = ""
let clearpass = ""
let availableDetectors = {
  "unprotected-write": true, 
  "requires-in-loop": true, 
  "load-not-store": true, 
  "for-continue-increment": true
}

main()

async function main(){
  if(!username.length || !clearpass.length){
    console.log("Empty inputs")
    return
  }
  let mysqlConn = await mysql.getDBConnection()
  let pass = crypto.createHash('sha256').update(clearpass).digest('base64')
  let detsInUse = Object.keys(availableDetectors).filter(e => availableDetectors[e])
  let detsField = detsInUse.join(",")

  let query = "INSERT INTO webui_user (username, pass, detectors) VALUES(?, ?, ?)"
  
  try{
    let params = [username, pass, detsField]
    let [data, fields] = await mysqlConn.query(query, params);
    if(!data.insertId){
      console.log("Error during user creation")
    }
    console.log("Account created")
  }
  catch(e){
    console.log("Error during user creation: ", e.message)
  }
}