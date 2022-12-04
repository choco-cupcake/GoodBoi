const crypto = require("crypto");
class Utils {

  static chains = {
      ETH_MAINNET: "ETH_MAINNET",
      BSC_MAINNET: "BSC_MAINNET",
      POLYGON: "POLYGON"
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
  
}

module.exports = Utils;