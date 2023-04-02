require("dotenv").config()
const axios = require("axios")
const mysql = require('../../utils/MysqlGateway');
const Utils = require('../../utils/Utils');

let addressBuffer = []
let mysqlConn
let refillInterval
let crawlInterval
let done = false
let lastRequests = []

main()

async function main(){
	console.log("loop started")
	let start = Date.now()
	await getAllSources(Utils.chains.POLYGON)
	let toWait = process.env.SOURCE_GETTER_RUN_INTERVAL_MINUTES * 60 * 1000 - (Date.now() - start) // 20min - elapsed
	console.log("loop done")
	if(toWait > 0){
		await Utils.sleep(toWait)
	}
	main()
}


async function getAllSources(chain){ 
	mysqlConn = await mysql.getDBConnection()
	await checkAndFill(chain) 
	refillInterval = setInterval(checkAndFill, 3000, chain)
	crawlInterval = setInterval(getSource, 200, chain)
	return new Promise((resolve, reject) => {
		setInterval(() => {if(done) resolve()}, 1000)
	})
}

async function getSource(chain){
	if(!addressBuffer.length){
		console.log("Addresspool is empty. Leaving")
		clearInterval(crawlInterval)
		done = true
		return
	}
	// check req rate
	let dateNow = Date.now()
	let reqLastSec = 0
	for(let lr of lastRequests){
		if(dateNow - lr < 1000)
			reqLastSec++
	}
	if(reqLastSec == 5){
		console.log("======= RATE LIMIT - abort")
		return
	}
	// add request
	if(lastRequests.length >= 5) 
		lastRequests.pop()
	lastRequests = [dateNow].concat(lastRequests)
	await crawlSourceCode(chain, addressBuffer.pop().address)
}

async function checkAndFill(chain) {
	if(addressBuffer.length < 50){
		addressBuffer = await mysql.getAddressBatchFromPool(mysqlConn, chain) 
		if(addressBuffer.length < 200){
			clearInterval(refillInterval)
		}
	}
}

async function crawlSourceCode(chain, address){
	let contractInfo = await getRawSource(address)
	if(!contractInfo){
		console.log("ERROR Etherscan API")
		return
	}
	if(contractInfo.ABI == "Contract source code not verified"){
		await mysql.markAsUnverified(mysqlConn, chain, address)
		console.log("unverified")
		return
	}
	if(!contractInfo.SourceCode){
		console.log("ERROR Etherscan API - Got zero length source code of " + address)
		return
	}
	contractInfo.SourceCode = contractsToObject(contractInfo.SourceCode)
	if(contractInfo.SourceCode == "ERROR_ZERO_LENGTH"){
		console.log("ERROR Etherscan API - Got zero length source code of " + address)
		return
	}
  
	// compute main compiler version (e.g. 'v0.8.9+commit.e5eed63a' -> '0.8'), to make it efficiently queriable
	let t = contractInfo.CompilerVersion.split('.',3)
	contractInfo['CompilerVersion_int'] = t[0].substring(1) + '.' + t[1]

	let insertRet = await mysql.pushSourceFiles(mysqlConn, chain, contractInfo, address)
	if(insertRet)
		console.log("OK " + address)
	else
		console.log("ERROR pushing to pool source code of " + address)
}

function contractsToObject(source){
	let src, filesList = []
  // around 99% of the sources are wrapped in {{}}, we need only a pair of {}
	try{
		if(source.substring(0,2) == "{{"){
			source = source.substring(1,source.length-1)
		}
		src = JSON.parse(source) // parse JSON containing multiple files
	}
	catch(e){
		if(source && source.length)
			return [{filename: 'single.sol', source: cleanVerificationDateHeader(source)}]
		return "ERROR_ZERO_LENGTH"
	}
	if(src.language && src.language != 'Solidity'){
		return ""
	}
  let root = src.sources ? src.sources : src // 99% of the sources are wrapped in .sources

	// check if there are multiple contracts with the same name in different folders. 
	// if so, don't flat the folder structure. folder structure gets flattened by default to avoid maaany possible errors
	let duplicatedNames = false
	let buff = []
	for(let k of Object.keys(root)){
		let fileName = k.split("/").at(-1)
		if(buff.includes(fileName)){
			duplicatedNames = true
			break
		}
		buff.push(fileName)
	}

	for(let k of Object.keys(root)){
		let fileName = k // keep folder path if duplicate names
		let fileSource = cleanVerificationDateHeader(root[k].content)
		if(!duplicatedNames){
			fileName = k.split("/").at(-1) // only keep filename
			fileName = Utils.cleanWeirdChars(fileName)
			fileSource = Utils.cleanImports(fileSource) // clean imports from path in source
		}
		filesList.push({filename: fileName, source: fileSource})
	}
	return filesList
}

function cleanVerificationDateHeader(source){
  if(source.substring(0,70).includes("Submitted for verification at BscScan.com on ")){
    let index = source.indexOf("*/")
    if(index != -1){
      let ret = source.substring(index + 2)
      while(ret.substring(0,2) == "\r\n"){
        ret = ret.substring(2) // remove leading newlines to hopefully make contracts match with eth ones
      }
      return ret
    }
  }
  return source
}


async function getRawSource(address){
	let url = "https://api.polygonscan.com/api?module=contract&action=getsourcecode&address=" + address + "&apikey=" + process.env.POLYGONSCAN_API
	try {
		const response = await axios.get(url);
		if(response?.data?.result && response?.data?.result.length){
			if(Array.isArray(response?.data?.result)) 
				return response?.data?.result[0]
			console.log(response?.data?.result)
		}
		return null
	}
	catch (error) {
		console.log(error);
		return null
	}
	
}
