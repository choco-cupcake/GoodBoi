const uninteresting_vars = { // blacklist for vars
  exact: ["shop"],
  anypos: ["factory", "operator", "admin", "owner", 
    "marketing", "receiver", "recipient", "dead", "router", 
    "fee", "logic", "treasury", "dev", "burn", "governance", 
    "minter", "team", "controller", "charity", "metadata", 
    "implementation", "referredby", "maintainer", "voter", 
    "beneficiary", "signer", "royalty", "implementationAuthority",
    "hub", "referral", "leveladdress", "erc721", "shareholder",
    "payout","buyers", "users", "depositors", "players", "bidders",
    "holders", "participants", "wallets", "investors"]
}
const interesting_mappings = { // whitelist for mappings
  exact: [],
  anypos: ["pool", "lp"]
}
module.exports = {uninteresting_vars, interesting_mappings}