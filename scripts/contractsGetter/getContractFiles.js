const mysql = require('../../utils/MysqlGateway');
const fs = require('fs')
const path = require('path')
const { program } = require('commander');

program
  .option('--ID <int>', 'ID of the contract table')
  .option('-a, --address <string>', 'Contract address')
  .option('-c, --chain <string>', 'Contract chain');

program.parse();
const options = program.opts();

main()

async function main(){
  let mysqlConn = await mysql.getDBConnection()
  contractObj = await mysql.getContractFiles(mysqlConn, options.ID, options.address, options.chain) // 
  preparePath(contractObj, options)
}

function preparePath(files){
  let foldername, folderpath, folders = new Set(), analysisDir = '.'
  foldername = Date.now().toString()
  folderpath = path.join("scripts","contractsGetter","download", foldername)
  fs.mkdirSync(folderpath)

  for(let f of files){
    let writePath = path.join(folderpath, f.filename)

    // clean leading '/'
    if(f.filename.substring(0,1) == '/') f.filename = f.filename.substring(1)

    let struct = f.filename.split("/")
    let outpath = folderpath
    if(struct.length > 1){
      // add all layers folders
      for(let j=0; j< struct.length - 1; j++)
        folders.add(struct.slice(0, j+1).join("/"))
      outpath = f.filename.substring(0, f.filename.length - struct[struct.length - 1].length - 1)
      outpath = path.join(folderpath, outpath)
      fs.mkdirSync(outpath, { recursive: true });
      writePath = path.join(outpath, struct[struct.length - 1])
    }
    fs.writeFileSync(writePath, fixPragma(f.sourceText, f.compilerVersion), {flag: 'w+'});
  }
  folders = Array.from(folders)
  folders.sort(function(a, b) { // inspect higher level first
    return (a.match(/\//g) || []).length - (b.match(/\//g) || []).length
  })
  if(folders.length){
    // find the master contract folder and append it to folderpath
    analysisDir = getMasterFolder(folders)
  }
  console.log("Downloaded folder: " + folderpath)
  console.log("Master dir: "+ analysisDir)
  console.log("solc version: " + files[0].compilerVersion)
  let fullPath = path.resolve(folderpath)
  require('child_process').exec('start "" "' + fullPath + '"');
  setTimeout(() => {process.exit()}, 1000) // time to run explorer
}

function getMasterFolder(folders){
  const patterns = ["contracts", "deploy", "src"]
  // exact match
  for(let patt of patterns){
    for(let folder of folders){
      let folderName = folder.split("/").at(-1)
      if(folderName.substring(0, patt.length) == patt)
        return folder
    }
  }
  // partial match
  for(let patt of patterns){
    for(let folder of folders){
      let folderName = folder.split("/").at(-1)
      if(folderName.includes(patt))
        return folder
    }
  }
  return ""
}

function fixPragma(source, compilerVer){ 
  const pragma_patt = "pragma solidity "
  let processed = ''
  let lines = source.split("\n")
  for(let line of lines){
    let lineClean = line.trim().toLowerCase()
    if(lineClean.substring(0, pragma_patt.length) == pragma_patt){
      try{
        let ver = compilerVer.split("+")[0].substring(1)
        line = pragma_patt + '>=' + ver + ';'
      }
      catch(e){ 
        console.log("WARNING Error processing pragma line in fixPragma")
        continue;
      }
    }
    processed += line + "\n"
  }
  return processed
}