require("dotenv").config()
const config = require('../data/config')
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');

const reflectInstances = config.analysisFlag.reflectedFlag.parallelInstances

let mysqlConn, toreflectPool, processed=0, reflections=0


main()

async function main(){
	mysqlConn = await mysql.getDBConnection()
  while(true){
    console.log("loop started")
    let start = Date.now()
    await reflectAllFlags()
    let toWait = config.analysisFlag.reflectedFlag.runInterval_minutes * 60 * 1000 - (Date.now() - start) 
    console.log("loop done")
    if(toWait > 0){
      await Utils.sleep(toWait)
    }
  }
}

async function reflectAllFlags(){ 
  console.log("Flags reflect started")
  toreflectPool = await mysql.getFlaggedContractsToReflect(mysqlConn)
	for(let i=0; i<reflectInstances; i++){
    reflectFlags()
	}
  return new Promise((resolve, reject) =>{
    let intervalCheck = setInterval(() => {
      if(!toreflectPool.length){
        clearInterval(intervalCheck); 
        resolve();
      }
    }, 1000)
  })
}

async function reflectFlags(){
  while(toreflectPool.length){
    toReflect = toreflectPool.pop()
    let references = await mysql.getContractHavingAddressInVars(mysqlConn, toReflect.address, toReflect.chain)
    for(let reference of references){
      reflections++
      await mysql.flagReflection(mysqlConn, reference.ID, toReflect.poolFlag, toReflect.balanceFlag)
    }
    await mysql.updateFlagReflectionDate(mysqlConn, toReflect.ID)
    processed++
    if(processed % 10 == 0)
      console.log("Processed " + processed + " contracts - " + reflections + " refl flags set")
  }
}