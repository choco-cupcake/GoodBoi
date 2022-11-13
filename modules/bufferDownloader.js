
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const mysql = require('../utils/MysqlGateway');

const dbName = process.env.MONGO_DB_NAME
let mongoClient

/**
 * Imports to local database all the addresses in the cloud pool, then deletes from cloud pool the addresses imported last time
 */

downloadCloudPool("ETH_MAINNET")

async function downloadCloudPool(chain){
  mysqlConn = await mysql.getDBConnection() // setup databases
  await setupMongoDB(chain)

  let deleted = await deleteMarkedUploaded(chain) // delete batches parsed last time
  console.log("Deleted " + deleted.deletedCount + " old batches")

  let batches = await getBufferBatches(chain) // get batches from mongo
  let batchesLengths = batches.map(e => e.addresses.length)
  let totAddresses = batchesLengths.reduce((acc, e) => acc + e, 0)
  console.log("found " + batches.length + " batches. Lengths: " + JSON.stringify(batchesLengths), "Tot new addresses: " + totAddresses)

  let c = 0
  for(let batch of batches){
    console.log("Parsing batch #" + c)
    await mysql.pushAddressesToPool(mysqlConn, chain, batch.addresses) // push to mysql
    let _id = batch._id.toString()
    await markAsUploaded(chain, _id)
    console.log("Batch #" + c + " done")
    c++
  }
  return
}

async function setupMongoDB(chain){
  console.log("Starting MongoDB setup");
  mongoClient = new MongoClient('mongodb+srv://' + process.env.MONGO_USER + ':' + process.env.MONGO_PASS + '@cluster0.jvgcc.mongodb.net', { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  await mongoClient.connect();
  console.log("MongoDB setup done");
}

async function getBufferBatches(chain){
  return (await mongoClient.db(dbName).collection(chain + "_address_pool").find().toArray());
}

async function markAsUploaded(chain, _id){
  let ret = await mongoClient.db(dbName).collection(chain + "_address_pool").updateOne(
    { _id : ObjectId(_id) },
    {
    $set: {uploadedToLocal : true}
    }
  )
  if(ret.modifiedCount != 1 || ret.matchedCount != 1){
    console.log("ERROR marking as uploaded _id:" + _id + "ret: ", ret)
    return false
  }
  return true
}

async function deleteMarkedUploaded(chain){
  return await mongoClient.db(dbName).collection(chain + "_address_pool").deleteMany(
    {uploadedToLocal : true}
  )
}
