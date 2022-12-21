// Based on Glacier's example: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/examples.html#Amazon_Glacier__Multi-part_Upload
require("dotenv").config()
var fs = require('fs');
var AWS = require('aws-sdk');
AWS.config = new AWS.Config()
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID
AWS.config.secretAccessKey = process.env.BPYAfBkn5IjQx5EeFhenqkdfnobGzu5OFVfSgFwK
const partSize = 1024 * 1024 * 5; // Minimum 5MB per chunk (except the last part) http://docs.aws.amazon.com/AmazonS3/latest/API/mpUploadComplete.html
const maxUploadTries = 3;
var s3 = new AWS.S3();
var numPartsLeft
var startTime
var multipartMap = {
    Parts: []
};

async function pushToBucket(filePath, fileName, bucket){
  return new Promise((resolve, reject) => {
    try{
      main(filePath, fileName, bucket)
    }
    catch(e){
      reject(e.message)
    }

    function completeMultipartUpload(s3, doneParams) {
      s3.completeMultipartUpload(doneParams, function(err, data) {
        if (err) {
          console.log("An error occurred while completing the multipart upload");
          console.log(err);
          reject(err)
        } else {
          var delta = (new Date() - startTime) / 1000;
          console.log('Completed upload in', delta, 'seconds');
          console.log('Final upload data:', data);
          resolve(data)
          // {Location: 'https://goodboi-backup.s3.eu-central-1.amazonaws.com/actafi+whitepaper.pdf', Bucket: 'goodboi-backup', Key: 'actafi whitepaper.pdf', ETag: '"fbe16b1204a8e089701c8c39232ed0fe-15"'}
        }
      });
    }
    
    function uploadPart(s3, multipart, partParams, bucket, fileKey, tryNum = 0) {
      var tryNum = tryNum || 1;
      s3.uploadPart(partParams, function(multiErr, mData) {
        if (multiErr){
          console.log('multiErr, upload part error:', multiErr);
          if (tryNum < maxUploadTries) {
            console.log('Retrying upload of part: #', partParams.PartNumber)
            uploadPart(s3, multipart, partParams, bucket, fileKey, tryNum + 1);
          } else {
            console.log('Failed uploading part: #', partParams.PartNumber)
          }
          return;
        }
        multipartMap.Parts[this.request.params.PartNumber - 1] = {
          ETag: mData.ETag,
          PartNumber: Number(this.request.params.PartNumber)
        };
        console.log("Completed part", this.request.params.PartNumber);
        console.log('mData', mData);
        if (--numPartsLeft > 0) return; // complete only when all parts uploaded
    
        var doneParams = {
          Bucket: bucket,
          Key: fileKey,
          MultipartUpload: multipartMap,
          UploadId: multipart.UploadId
        };
    
        console.log("Completing upload...");
        completeMultipartUpload(s3, doneParams);
      });
    }
    
    
    async function main(filePath, fileName, bucket){
      let buffer = fs.readFileSync(filePath);
      numPartsLeft = Math.ceil(buffer.length / partSize);
      let multiPartParams = {
          Bucket: bucket,
          Key: fileName,
          ContentType: 'application/pdf'
      };
      startTime = new Date();
      console.log("Creating multipart upload for:", fileName);
      s3.createMultipartUpload(multiPartParams, function(mpErr, multipart){
        if (mpErr) { console.log('Error!', mpErr); return; }
        console.log("Got upload ID", multipart.UploadId);
    
        // Grab each partSize chunk and upload it as a part
        let partNum = 0
        for (var rangeStart = 0; rangeStart < buffer.length; rangeStart += partSize) {
          partNum++;
          var end = Math.min(rangeStart + partSize, buffer.length),
              partParams = {
                Body: buffer.slice(rangeStart, end),
                Bucket: bucket,
                Key: fileName,
                PartNumber: String(partNum),
                UploadId: multipart.UploadId
              };
    
          // Send a single part
          console.log('Uploading part: #', partParams.PartNumber, ', Range start:', rangeStart);
          uploadPart(s3, multipart, partParams, bucket, fileName);
        }
      });
    }
  })
}




async function listObjectsInBucket(bucket){
  return new Promise((resolve,reject) => {
    var params = { 
      Bucket: bucket,
      Delimiter: '/',
      // Prefix: 's/5469b2f5b4292d22522e84e0/ms.files/'
    }
  
    s3.listObjects(params, function (err, data) {
      if(err)throw err;
      console.log(data);
      resolve(data)
    });

  })
}

async function deleteFileFromBucket(bucket, key){
  return new Promise((resolve,reject) => {
    var params = {  Bucket: bucket, Key: key };

    s3.deleteObject(params, function(err, data) {
      if (err){
        console.log(err, err.stack); 
      }
      resolve();              
    });
  })
}

module.exports = {pushToBucket, listObjectsInBucket, deleteFileFromBucket, }