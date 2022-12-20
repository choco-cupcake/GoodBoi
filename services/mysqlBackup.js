require("dotenv").config()
const fs = require("fs")
const AWS = require('aws-sdk')
const mysqldump = require('mysqldump')
const Utils = require('../utils/Utils')
const S3Helper = require("../Utils/S3Helper.js")
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
  let bkObj = await backupToFile()
  let toRemove = await deleteOldBackupLocal()
  // upload to s3
  let S3Obj = await S3Helper.pushToBucket(bkObj.path, bkObj.filename, bucketName)
  console.log(S3Obj)
  // delete toRemove from s3
  if(toRemove)
    await S3Helper.deleteFileFromBucket(bucketName, toRemove)

  // update backup date
  await mysql.updateLastBackupDB(dbConn)

}

async function deleteOldBackupLocal(){
  let files = fs.readdirSync("./mysqlBackup")
  if(files.length < 2) 
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

