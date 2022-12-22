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
	await getAllSources(Utils.chains.ETH_MAINNET)
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
			return [{filename: 'single.sol', source: source}]
		return "ERROR_ZERO_LENGTH"
	}
	if(src.language && src.language != 'Solidity'){
		return ""
	}
  let root = src.sources ? src.sources : src // 99% of the sources are wrapped in .sources
	for(let k of Object.keys(root)){
		let fileName = k.split("/").at(-1)
		let fileSource = cleanImports(root[k].content)
		filesList.push({filename: fileName, source: fileSource})
	}
	return filesList
}

function cleanImports(source){
	let cleanedSource = ''
	let import_patt = 'import '
	let breakChars = ["'", "\"", "\\", "/"]
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
			cleanedSource += 'import "./' + fileName + '";\n'
		}
		else
		cleanedSource += l + '\n'
	}
	return cleanedSource
}


async function getRawSource(address){
	let url = "https://api.etherscan.io/api?module=contract&action=getsourcecode&address=" + address + "&apikey=" + process.env.ETHERSCAN_API
	try {
		const response = await axios.get(url);
		return response.data.result[0];
	}
	catch (error) {
		console.log(error);
		return null
	}
	
}