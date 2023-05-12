const mysql = require('../utils/MysqlGateway');
const crypto = require("crypto")
const { program } = require('commander');

program.option('--user <string>', 'username');
program.option('--pass <number>', 'password');

program.parse();
const cliOptions = program.opts();

let username = cliOptions.user
let clearpass = cliOptions.pass

if(!username || !clearpass){
  console.log("Insert user and pass")
  process.exit()
}

let availableDetectors = {
  "unprotected-write": true, 
  "requires-in-loop": true, 
  "load-not-store": true, 
  "reentrancy-eth": true, 
  "reentrancy-no-eth": true, 
  "for-continue-increment": true,
  'pess-before-token-transfer': true,
  'pess-call-forward-to-protected': true,
  'pess-double-entry-token-alert': true,
  'pess-dubious-typecast': true,
  'pess-event-setter': true,
  'pess-only-eoa-check': true,
  'pess-inconsistent-nonreentrant': true,
  'pess-magic-number': true,
  'pess-multiple-storage-read': true,
  'pess-nft-approve-warning': true,
  'pess-readonly-reentrancy': true,
  'pess-strange-setter': true,
  'pess-timelock-controller': true,
  'pess-token-fallback': true,
  'pess-tx-gasprice': true,
  'pess-uni-v2': true,
  'pess-unprotected-initialize': true,
  'pess-unprotected-setter': true
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