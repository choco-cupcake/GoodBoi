const axios = require("axios")
const fs = require('fs')
const path = require('path')
const mysql = require('../utils/MysqlGateway')
const Utils = require('../utils/Utils')
const baseUrl = "https://github.com/ethereum/solc-bin/blob/gh-pages/"
const platformData = {
  win: {
    dbField: "Win",
    ghFolder: "windows-amd64"
  },
  linux: {
    dbField: "Linux",
    ghFolder: "linux-amd64"
  }}
let mysqlConn

main()

async function main(){
  while(true){
    mysqlConn = await mysql.getDBConnection()
    let start = Date.now()
    
    for(k in platformData)
    await checkSolcRelease(platformData[k])

    let toWait = 6 * 60 * 60 * 1000 - (Date.now() - start) // 6 hours
    if(toWait > 0){
      await Utils.sleep(toWait)
    }
  }
}

async function checkSolcRelease(pfData){
  // get last parsed commit from database
  let oldCommit = await mysql.getLastSolcCommit(mysqlConn, pfData.dbField)
  if(!oldCommit)
    return
  // get all commits newer than the last parsed one
  let newCommits = await getNewCommits(oldCommit, pfData.ghFolder)
  if(!newCommits.length){
    console.log("No new commit for platform " + pfData.dbField)
    return
  }
  // for each commit, download the new uploaded files
  for(nc of newCommits){
    console.log("Processing new commit " + nc.sha)
    await downloadUploadedFiles(pfData, nc.url)
    await Utils.sleep(5000) // graceful bootstrap
  }
  // update last commit on the db
  let lastCommitHash = newCommits.at(-1).sha
  await mysql.updateLastSolcCommit(mysqlConn, lastCommitHash, pfData.dbField)
}

async function getNewCommits(oldCommit, folderPath){
  const username = 'ethereum';
  const repoName = 'solc-bin';
  const apiUrl = `https://api.github.com/repos/${username}/${repoName}/commits?path=${folderPath}`;
  let resp
  try{
    resp = await axios.get(apiUrl)
  }
  catch(e){
    console.log(e.message)
    return []
  }
  let newCommits = []
  for(commit of resp.data){
    if (commit.sha != oldCommit)
      newCommits.unshift(commit) // inserts at the beginning of the array so that we have the oldest first
    else
      break
  }
  return newCommits
}

async function downloadUploadedFiles(pfData, commitUrl){ //res.data[0].url
  let filesResp = await axios.get(commitUrl + "?per_page=50")
  let parentFolder = pfData.ghFolder
  let addedFiles = filesResp.data.files.filter(e => e.filename.substring(0, parentFolder.length) == parentFolder && !e.filename.includes("latest") )
  let files = addedFiles.map(e => e.filename)
  for(let file of addedFiles){ 
    if (['linux-amd64/list.js', 'linux-amd64/list.json', 'linux-amd64/list.txt'].includes(file.filename)) // gave up the map filter
      continue
    let localPath = path.join("./solc-bin", file.filename)
    if(file.status == "modified") // binary updated
      deleteFile(localPath)
    try {
      if (!fs.existsSync(localPath)) {
        await downloadFile(path.join(baseUrl, encodeURI(file.filename)) + "?raw=true", localPath)
        console.log("Downloaded " + localPath)
      }
    } catch(err) {
      console.error(err)
    }
  }
}

function deleteFile(filepath){
  if (fs.existsSync(filepath)) 
    fs.unlinkSync(filepath)
}

async function downloadFile(fileUrl, outputLocationPath) { 
  const writer = fs.createWriteStream(outputLocationPath);

  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) {
          resolve(true);
        }
      });
    });
  });
}

