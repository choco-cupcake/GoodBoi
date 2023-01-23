const crypto = require("crypto")
const fs = require('fs')
const path = require('path')
class Utils {

  static chains = {
    ETH_MAINNET: "ETH_MAINNET",
    BSC_MAINNET: "BSC_MAINNET",
    POLYGON: "POLYGON"
  }
  static verifiedUrl = {
      ETH_MAINNET: "https://etherscan.io/contractsVerified",
      BSC_MAINNET: "https://bscscan.com/contractsVerified",
      POLYGON: "https://polygonscan.com/contractsVerified"
    }

  static printQueryError(query, params, error = null){
    console.log("ERROR '" + error + "'during execution of query '" + query + "'", "Query parameters: " + JSON.stringify(params))
  }

    
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  
  static getRandomInt(min, max) {
    return min + Math.floor(Math.random() * max);
  }

  static makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  static preprocessSource(source){
    // removes licence, pragma, empty lines, single line comments
    let lines = source.split("\n")
    let ret = ''
    for(let l of lines){
      let lClean = l.trim()
      if(!lClean.length) continue
      if(this.pattMatch(lClean, "//")) continue
      if(this.pattMatch(lClean, "pragma")) continue
      ret = ret.concat(l , "\n")
    }
    return ret
  }
  
  static hash(input){
    let sha256Hasher = crypto.createHmac("sha256", "whosagoodboi");
    return sha256Hasher.update(this.preprocessSource(input)).digest("hex")
  }

  static pattMatch(line, pattern){
    return line.trim().substring(0, pattern.length) == pattern
  }
  
  static async emptyFolder(folderPath) {
    try {
        // Find all files in the folder
        let _files = fs.readdirSync(folderPath);
        for (const file of _files) {
          let filePath = path.join(folderPath, file)
          if(fs.lstatSync(filePath).isDirectory()){
            this.deleteFolder(filePath)
          }
          else{
            fs.unlinkSync(filePath);
          }
        }
        console.log(`tmp_analysis folder cleaned`);
    } catch (err){
        console.log(err);
    }
  }
  
  static async deleteFolder(folder){
    try {
      fs.rmSync(folder, { recursive: true })
    } catch(e) {
      console.log(e)
    } 
  }
  
  static cleanImports(source){
    let cleanedSource = ''
    let import_patt = 'import '
    let breakChars = ["'", "\"", "\\", "/", '"', ' ']
    let lines = source.split('\n')
    for(let l of lines){
      if(Utils.pattMatch(l, import_patt)){
        let p1 = l.lastIndexOf(".sol")
        let fileName = ".sol"
        for(let i=p1-1; i>0; i--){
          let c = l.charAt(i)
          if(breakChars.includes(c))
            break
          fileName = l.charAt(i) + fileName
        }
        if(l.includes(' from ')){
          let pre = l.split(" from ")[0]
          cleanedSource += pre + ' from "./' + fileName + '";\n'
        }
        else{
          cleanedSource += 'import "./' + fileName + '";\n'
        }
      }
      else
      cleanedSource += l + '\n'
    }
    return cleanedSource
  }

static cleanWeirdChars(str){ // this covers only the case of a not imported contract, 
															// where the three structure gets flattened (no filename duplicates).
															// happened once in 800k contracts it should not impact much
	return str.replace(/[^\x20-\x7E]/g, ""); // keeps ascii chars [32-126]
}
}

module.exports = Utils;