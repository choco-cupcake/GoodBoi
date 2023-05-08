const mysql = require('../utils/MysqlGateway');
const fs = require("fs")
const { program } = require('commander');

let mysqlConn

program.option('--regex <string>', 'regex to be used with "regex" method');
program.option('--pattern <string>', 'pattern to look for. can use placeholders "%" and "_" ');
program.parse();
const cliOptions = program.opts();

if(!cliOptions.regex && !cliOptions.pattern){
  console.log("Provide a pattern or a regex. --help")
  process.exit()
}

let method = cliOptions.regex ? "regex" : "query"
let input = cliOptions.regex || cliOptions.pattern
console.log("Executing " + method + " " + input)

launchAnalysis()

async function launchAnalysis(){ 
  mysqlConn = await mysql.getDBConnection()
  setInterval(mysqlKeepAlive, 5000)
  let st = Date.now()
  let results = await mysql.spotAnalysis(mysqlConn, method, input)
  console.log("Found " + results.length + " results, elapsed " + getElapsed(Date.now() - st))
  if(!results.length)
    return
  let out = convertToCSV(results)
  let filename = "spot_analysis_" + Date.now() + ".csv"
  let outpath = "./spotAnalysis"
  if (!fs.existsSync(outpath))
    fs.mkdirSync(outpath)
  fs.writeFileSync(outpath + "/" + filename, out);
  console.log("Results written to ./spotAnalysis/" + filename)
}

function convertToCSV(arr) {
  const array = [Object.keys(arr[0])].concat(arr)

  return array.map(it => {
    return Object.values(it).toString()
  }).join('\n')
}

function getElapsed(ms){
  ms = Math.floor(ms / 1000)
  return Math.floor(ms / 60) + ":" + Math.floor((ms % 60))
}

async function mysqlKeepAlive(){
  await mysql.keepAlive(mysqlConn)
}