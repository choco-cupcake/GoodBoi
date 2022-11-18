const Utils = require('./utils/Utils');
const _detectors = require("./data/slither_detectors")
const readlinePromises = require('node:readline/promises')

const commandsToFunction = {
  getsource: getSource, 
  emptybuffer: downloadBuffer,
  analyze: launchAnalysis,
  getbalances: syncBalances
} // mapping command strings to functions

const rl = readlinePromises.createInterface({
  input: process.stdin,
  output: process.stdout
});

//getInput()
require("./modules/slitherManager").launchAnalysis(["public-mint"], Utils.chains.ETH_MAINNET, 0)
//require("./modules/sourceGetter2").main(Utils.chains.ETH_MAINNET)

async function getInput(){
  let input = await rl.question("GoodBoi entry point. write help to print available commands\n")
  var argv = require('minimist')(('--' + input).split(" "))
  let insertedCmd = Object.keys(argv)[1]
  if(insertedCmd == 'help'){
    console.log("\nAvailable commands:\n\nemptybuffer    --chain\n\ngetsource    --chain\n\nanalyze    --chain   --detectors   --minval\n\ngetbalances   --chain   --daysold\n\n")
  }
  else if(Object.keys(commandsToFunction).includes(insertedCmd)){
    console.log("Launching module")
    await commandsToFunction[insertedCmd](argv)
  }
  else{
    console.log("Command not recognized")
  }
  await getInput()
}

async function getState(){
  // TODO compute bufferPoolSize, missing sources, balance last sync and print
}

async function downloadBuffer(argv){
  let chain = argv?.chain || Utils.chains.ETH_MAINNET // TODO implement multiple chains
  await require("./modules/bufferDownloader").downloadCloudPool(chain)
}

async function getSource(argv){
  let chain = argv?.chain || Utils.chains.ETH_MAINNET
  await require("./modules/sourceGetter").getAllSources(chain)
}

async function launchAnalysis(argv){
  let detectors = argv?.detectors ? argv.detectors.split(",") : _detectors.detectors_slither_high
  let chain = argv?.chain || Utils.chains.ETH_MAINNET
  let minUsdValue = argv?.minval || 0
  console.log("detectors: ", detectors)
  console.log("chain: ", chain)
  console.log("minUsdValue: ", minUsdValue)
  console.log("Analysis starting")
  await require("./modules/slitherManager").launchAnalysis(detectors, chain, minUsdValue)
}

async function syncBalances(argv){
  let chain = argv?.chain || Utils.chains.ETH_MAINNET
  let daysOld = argv?.days || 2
  await require("./modules/valueReader").refreshBalances(chain, daysOld)
}