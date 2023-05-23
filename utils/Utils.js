const os = require("os")
const crypto = require("crypto")
const fs = require('fs')
const path = require('path')
class Utils {

  static chains = {
    ETH_MAINNET: "ETH_MAINNET",
    BSC_MAINNET: "BSC_MAINNET",
    POLYGON: "POLYGON",
    ARBITRUM: "ARBITRUM"
  }

  static chainToMoralisID(chain){
    let map = {
      ETH_MAINNET: "0x1",
      BSC_MAINNET: "0x38",
      POLYGON: "0x89",
      ARBITRUM: "0xa4b1"
    }
    return map[chain]
  }

  static isL2(chain){
    const L2s = ["ARBITRUM", "OPTIMISM"]
    return L2s.includes(chain)
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
      if(this.pattMatch(l, import_patt)){
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

  static cleanWeirdChars(str){ 
    // this covers only the case of a not imported contract, 
    // where the three structure gets flattened (no filename duplicates).
    // happened once in 800k contracts it should not impact much
	  return str.replace(/[^\x20-\x7E]/g, ""); // keeps ascii chars [32-126]
  }

  static getAddressVars(sourcefiles, contractName){ 
    // get the specific source file if it matches with the contract name
    let desiredContract = sourcefiles.filter(e => e.filename == contractName + ".sol")
    // or get the single one, or chain all of them and look for the contract definition
    if(desiredContract.length)
      desiredContract = desiredContract[0].source || desiredContract[0].sourceText
    else
      desiredContract = sourcefiles.map(e => e.source || e.sourceText).join("\n")
    // assumption: state vars are declared before constructor/modifiers/functions. 
    // This should hold on properly written contracts (handling decent amount of money)
    const breakingKeywords = ["constructor", "function", "modifier", "receive", "fallback"]
    const varRegex = /^(address|ERC20|I[a-zA-Z0-9]{1,20}) / 
    const varRegex_public = /^(address|ERC20|I[a-zA-Z0-9]{1,20}) public / // hits not public are private -> get value from storage
    const varRegex_const_pvt = /(?!.*\bpublic\b)(address|ERC20|I[a-zA-Z0-9]{1,20})(?:\s(private|internal))? constant(?:\s(private|internal))?/ // get the value from the code
    const varRegex_imm_pvt = /(?!.*\bpublic\b)(address|ERC20|I[a-zA-Z0-9]{1,20})(?:\s(private|internal))? immutable(?:\s(private|internal))?/ // get the value from the constructor args
    const arrRegex = /^(address|ERC20|IERC20)\[\] public / 
    const mappingRegex = /^mapping ?\( ?uint(256|128|64|32|16|8) ?=> ?(address|ERC20|IERC20)\) public / // same for pools
    let lines = desiredContract.split("\n")
    let header = "contract " + contractName
    let inContract = false
    let stateAddressVars = [], mappingUintAddress = [], stateAddressArrays = []
    let inheritedContractsVarsObjects = []
    outerLoop:
    for(let l of lines){
      let line = l.trim().split(";")[0].trim()
      if(!inContract){
        if(this.startsWith(line, header)){
          inContract = true
          if(l.includes(" is ")){
            let t = l.split(" is ")[1]
            let inheritedContracts = t.split("{")[0].split(",")
            inheritedContracts = inheritedContracts.map(e => e.trim())
            for(let ic of inheritedContracts){
              inheritedContractsVarsObjects.push(this.getAddressVars(sourcefiles, ic))
            }
          }
        }
      }
      else{
        for(let bk of breakingKeywords){
          if(this.startsWith(line, bk))
            break outerLoop
        }
        // check if is state var
        let mappingMatchStr = line.match(mappingRegex)
        if(line.match(varRegex)){
          let _varName = this.getVarName(line)
          if(this.isVarAllowed(_varName)){
            let visibility = {}
            let val = ''
            if (line.match(varRegex_const_pvt)){
              visibility = {vsb: "pvt_const"}
              val = this.readValueFromConstantAssignment(line)
            }
            else if (line.match(varRegex_imm_pvt)) visibility = {vsb: "pvt_imm"}
            else if (!line.match(varRegex_public)) visibility = {vsb: "pvt"}
            stateAddressVars.push({name: _varName, val: val, ...visibility}) // no vsb attribute means public
          }
        } else if(mappingMatchStr){ // in the end won't use this, but who knows in the future
          let uintSize = this.getUintSize(mappingMatchStr[0])
          mappingUintAddress.push({name: this.getMappingName(line), uintSize: uintSize, val: []})
        } else if(line.match(arrRegex)){ // array of addresses
          stateAddressArrays.push({name: this.getVarName(line), val: []})
        }
      }
    }
    for(let icObj of inheritedContractsVarsObjects){
      if(icObj){
        for(let icSAV of icObj.SAV)
          if(!this.isVarContained(stateAddressVars, icSAV)) // if not shadowed
            stateAddressVars.push(icSAV)
        for(let icSAA of icObj.SAA)
          if(!this.isVarContained(stateAddressArrays, icSAA))
          stateAddressArrays.push(icSAA)
        for(let icSAM of icObj.SAM)
          if(!this.isVarContained(mappingUintAddress, icSAM))
          mappingUintAddress.push(icSAM)
      }
    }
    if(!stateAddressVars.length && !mappingUintAddress.length && !stateAddressArrays.length)
      return null
    return {SAV: stateAddressVars, SAA: stateAddressArrays, SAM: mappingUintAddress}
  }

  static readValueFromConstantAssignment(line){
    line = line.replaceAll("[]", "") // using this function also for array vars
    let eqPos = line.indexOf("=")
    if(eqPos >= 0){
      line = line.substring(eqPos + 1).trim()
    }
    else 
      return ''

    const addrRegex = /0x[a-fA-F0-9]{40}/ // regex is used to ignore cast to interface stuff
    const match = line.match(addrRegex);
    return match ? match[0] : ''
  }

  static isVarContained(arr, varName){
    for(let e of arr){
      if(e.name == varName.name)
        return true
    }
    return false
  }

  static getUintSize(mappingLine){
    let t = mappingLine.split("=>")[0].trim()
    let type = t.split("(")[1].trim()
    return type == 'uint' ? 'uint256' : type 
  }

  static getVarName(line){
    // address public varname = address(0);
    line = line.replaceAll("[]", "") // using this function also for array vars
    let eqPos = line.indexOf("=")
    if(eqPos >= 0){
      line = line.substring(0, eqPos).trim()
    }
    let words = line.split(" ")
    return words[words.length - 1].trim()
  }

  static getMappingName(line){
    // mapping (uint256 => address) public mapname;
    let words = line.split(" ")
    return words[words.length - 1].trim()
  }

  static isVarAllowed(varName){
    let uninteresting_vars = require("../data/state_vars").uninteresting_vars
    for(let exact of uninteresting_vars.exact){
      if(varName == exact)
        return false
    }
    for(let anypos of uninteresting_vars.anypos){
      if(varName.toLowerCase().includes(anypos))
        return false
    }
    return true
  }

  static isMapAllowed(varName){
    let interesting_mappings = require("../data/state_vars").interesting_mappings
    for(let exact of interesting_mappings.exact){
      if(varName == exact)
        return true
    }
    for(let anypos of interesting_mappings.anypos){
      if(varName.toLowerCase().includes(anypos))
        return true
    }
    return false
  }

  static preparePath(files, contractName, targetMainContract, tempPath){
    let foldername, folderpath, folders = new Set(), analysisDir
    if(targetMainContract){
      for(let file of files)
        if(file.sourceText.match("contract " + contractName)){
          analysisDir = file.filename
          break;
        }
        analysisDir = analysisDir || "."
    }
    else analysisDir = "."

    do{
      foldername = this.makeid(15)
      folderpath = path.join(tempPath, foldername)
    }while(fs.existsSync(folderpath))
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
      fs.writeFileSync(writePath, this.fixPragma(f.sourceText, f.compilerVersion), {flag: 'w+'});
    }
    folders = Array.from(folders)
    folders.sort(function(a, b) { // inspect higher level first
      return (a.match(/\//g) || []).length - (b.match(/\//g) || []).length
    })
    if(folders.length){
      // find the master contract folder and append it to folderpath
      analysisDir = this.getMainContractPath(files, contractName) || this.getMasterFolder(folders)
      if(!analysisDir){
        console.log("WARNING - can't find master folder") 
        analysisDir = "." // will throw an error at analysis time
      }
    }
    return {workingPath: path.resolve(folderpath), analysisPath: analysisDir}
  }
  
  static getSolcPath(compVer){
    const isWindows = os.platform() === 'win32'
    let solcFolder = isWindows ? "windows-amd64" : "linux-amd64"
    let solcVer = compVer.split("+")[0].substring(1)
    if(solcVer.includes("-"))
      solcVer = solcVer.split("-")[0]
    let solcFiles = fs.readdirSync("./solc-bin/" + solcFolder)
    for(let f of solcFiles){
      let fVer = f.split("+")[0].substring(("solc-" + solcFolder + "-v").length)
      if(fVer == solcVer)
        return path.resolve("./solc-bin/" + solcFolder + "/" + f)
    }
    return null
  }
  
  static getMainContractPath(files, contractName){
    for(let file of files){
      try{
        let p = file.split("/").at(-1)
        if(p.split(".")[0] == contractName)
          return file.substring(0, file.length - p.length - 1)
      } catch(e){return null}
    }
    return null
  }
  
  static getMasterFolder(folders){
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
    return null
  }

  static fixPragma(source, compilerVer){ 
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

  static startsWith(str, patt){
    str = str.substring(0, patt.length + 1)
    for(let post of [" ", "{", "[", "(", ";"])
      if(str == patt + post)
        return true
    return false
  }

  static getTime(){
    const currentDate = new Date()
    const hours = String(currentDate.getHours()).padStart(2, '0')
    const minutes = String(currentDate.getMinutes()).padStart(2, '0')
    const seconds = String(currentDate.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`;
  }
}

module.exports = Utils;