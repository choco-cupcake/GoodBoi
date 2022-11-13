const axios = require("axios")
const mysql = require('../utils/MysqlGateway');
const Utils = require('../utils/Utils');

let addressBuffer = []
let mysqlConn

getAllSources()

async function getAllSources(){
	if(!mysqlConn){
		mysqlConn = await mysql.getDBConnection()
	}
	if(!addressBuffer.length){
		await Utils.sleep(1000)
		addressBuffer = await mysql.getAddressBatchFromPool(mysqlConn, Utils.chains.ETH_MAINNET) 
		if(!addressBuffer.length){
			console.log("Addresspool is empty. Leaving")
			return
		}
	}
	await crawlSourceCode(Utils.chains.ETH_MAINNET, addressBuffer.pop().address)
	await Utils.sleep(200) // api rate limit
	await getAllSources()
}

async function crawlSourceCode(chain, address){
	let contractInfo = await getRawSource(address)
	if(!contractInfo){
		console.log("ERROR Etherscan API")
		await Utils.sleep(200)
		return
	}
	contractInfo.SourceCode = contractsToObject(contractInfo.SourceCode)
	if(contractInfo.SourceCode == "ERROR_ZERO_LENGTH"){
		console.log("ERROR Etherscan API - Got zero length source code of " + address)
		await Utils.sleep(200)
		return
	}
	let insertRet = await mysql.pushSourceFiles(mysqlConn, chain, contractInfo, address)
	if(insertRet)
		console.log("OK " + address)
	else
		console.log("ERROR pushing to pool source code of " + address)
	await Utils.sleep(200)
}

function contractsToObject(source){
	let src, filesList = []
	try{
		src = JSON.parse(source.substring(1,source.length-1)) // parse JSON containing multiple files
	}
	catch(e){
		if(source && source.length)
			return [{filename: 'single.sol', source: source}]
		return "ERROR_ZERO_LENGTH"
	}
	if(src.language != 'Solidity'){
		return ""
	}
	for(let k of Object.keys(src.sources)){
		let fileName = k.split("/").at(-1)
		let fileSource = cleanImports(src.sources[k].content)
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
		if(pattMatch(l, import_patt)){
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

function pattMatch(line, pattern){
	return line.trim().substring(0, pattern.length) == pattern
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