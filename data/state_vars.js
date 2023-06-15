const uninteresting_vars = { // blacklist for address and address[] - exclude
  exact: ["shop", "members"], // prefix
  anypos: ["operator", "admin", "owner", // in any position
    "marketing", "receiver", "recipient", "dead", "router", 
    "fee", "logic", "treasury", "dev", "burn", "governance", 
    "minter", "team", "controller", "charity", "metadata", 
    "implementation", "referredby", "maintainer", "voter", 
    "beneficiary", "signer", "royalty", "implementationAuthority",
    "hub", "referral", "leveladdress", "erc721", "shareholder",
    "payout","buyers", "users", "depositors", "players", "bidders",
    "holders", "participants", "wallets", "investors"]
}
const interesting_mappings = { // whitelist for mapping(uintXXX => address) - only include these (most of mappings are crap)
  exact: [],
  anypos: ["pool", "lp"]
}
module.exports = {uninteresting_vars, interesting_mappings}