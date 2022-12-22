require("dotenv").config()
const fs = require("fs")
const AWS = require('aws-sdk')
const mysqldump = require('mysqldump')
const Utils = require('../utils/Utils')
const S3Helper = require("../utils/S3Helper.js")
const mysql = require('../utils/MysqlGateway')

const backupTime =  process.env.MYSQL_BACKUP_HOURS
const bucketName = process.env.AWS_BUCKET_NAME
let dbConn

main() 

async function main(){
  while(true){
    await backupDB()
    await Utils.sleep(30 * 60 * 1000) // 30 min
  }
}

async function backupDB(){
  dbConn = await mysql.getDBConnection()
  let oldBkDate = await mysql.getLastBackupDB(dbConn, backupTime)
  if(!oldBkDate){
    console.log("Not yet time to backup. Abort")
    return
  }
  console.log("Backup started")
  let bkObj = await backupToFile()
  console.log(bkObj.filename, " created")
  let toRemove = await deleteOldBackupLocal()
  console.log("toRemove: ", toRemove)
  // upload to s3
  let S3Obj = await S3Helper.pushToBucket(bkObj.path, bkObj.filename, bucketName)
  console.log("File sent to S3")
  console.log(S3Obj)
  // delete toRemove from s3
  if(toRemove){
    await S3Helper.deleteFileFromBucket(bucketName, toRemove)
    console.log("Removed old backup from S3")
  }

  // update backup date
  await mysql.updateLastBackupDB(dbConn)
  console.log("Done")

}

async function deleteOldBackupLocal(){
  let files = fs.readdirSync("./mysqlBackup")
    .filter(e => e.substring(e.length-5) != ".temp") // fix add timeout in cjs.js mysqldump library
  if(files.length <= 3) // keep last 3 backups
    return null
  // sort names ascending
  files.sort((a,b) => a.localeCompare(b))
  let toRemove = files[0]
  // delete file
  await fs.promises.unlink("./mysqlBackup/" + toRemove)
  return toRemove
}

async function backupToFile(){
  let fname = "dump_" + Date.now() + ".sql.gz"
  let fpath = "./mysqlBackup/" + fname
  
  await mysqldump({
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.MYSQL_PASS,
        database: 'goodboi',
    },
    dumpToFile: fpath,
    compressFile: true,
  }); 
  return {path: fpath, filename: fname}
}

