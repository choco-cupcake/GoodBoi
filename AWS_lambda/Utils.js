function printQueryError(query, params, error = null){
  console.log("ERROR '" + error + "'during execution of query '" + query + "'", "Query parameters: " + JSON.stringify(params))
}

const chains = {
      ETH_MAINNET: "ETH_MAINNET",
      BSC_MAINNET: "BSC_MAINNET",
      POLYGON: "POLYGON"
    }
module.exports = {printQueryError, chains}