class Utils {

  static chains = {
      ETH_MAINNET: "ETH_MAINNET",
      BSC_MAINNET: "BSC_MAINNET"
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

  
}

module.exports = Utils;