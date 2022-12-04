const ERC20s_of_interest = {"ETH_MAINNET" : [
    {"token":"ETH","address":"0x0000000000000000000000000000000000000000","decimals":"18"},
    {"token":"wETH","address":"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2","decimals":"18"},
    {"token":"USDT","address":"0xdac17f958d2ee523a2206206994597c13d831ec7","decimals":"6"},
    {"token":"BNB","address":"0x418d75f65a02b3d53b2418fb8e1fe493759c7605","decimals":"18"},
    {"token":"USDC","address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","decimals":"6"},
    {"token":"BUSD","address":"0x4fabb145d64652a948d72533023f6e7a623c7c53","decimals":"18"},
    {"token":"MATIC","address":"0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0","decimals":"18"},
    {"token":"stETH","address":"0xae7ab96520de3a18e5e111b5eaab095312d7fe84","decimals":"18"},
    {"token":"HEX","address":"0x2b591e99afe9f32eaa6214f7b7629768c40eeb39","decimals":"8"},
    {"token":"SHIB","address":"0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE","decimals":"18"},
    {"token":"DAI","address":"0x6b175474e89094c44da98b954eedeac495271d0f","decimals":"18"},
    {"token":"OKB","address":"0x75231f58b43240c9718dd58b4967c5114342a86c","decimals":"18"},
    {"token":"UNI","address":"0x1f9840a85d5af5bf1d1762f925bdaddc4201f984","decimals":"18"},
    {"token":"WBTC","address":"0x2260fac5e5542a773aa44fbcfedf7c193bc2c599","decimals":"8"},
    {"token":"LEO","address":"0x2af5d2ad76741191d15dfe7bf6ac92d4bd912ca3","decimals":"18"},
    {"token":"LINK","address":"0x514910771af9ca656af840dff83e8264ecf986ca","decimals":"18"},
    {"token":"CRO","address":"0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b","decimals":"8"},
    {"token":"NEAR","address":"0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4","decimals":"24"},
    {"token":"QNT","address":"0x4a220e6096b25eadb88358cb44068a3248254675","decimals":"18"},
    {"token":"FRAX","address":"0x853d955acef822db058eb8505911ed77f175b99e","decimals":"18"},
    {"token":"CHZ","address":"0x3506424f91fd33084466f402d5d97f05f8e3b4af","decimals":"18"},
    {"token":"XCN","address":"0xa2cd3d43c775978a96bdbf12d733d5a1ed94fb18","decimals":"18"},
    {"token":"SAND","address":"0x3845badAde8e6dFF049820680d1F14bD3903a5d0","decimals":"18"},
    {"token":"APE","address":"0x4d224452801aced8b2f0aebe155379bb5d594381","decimals":"18"},
    {"token":"TUSD","address":"0x0000000000085d4780B73119b644AE5ecd22b376","decimals":"18"},
    {"token":"USDP","address":"0x8e870d67f660d95d5be530380d0ec0bd388289e1","decimals":"18"},
    {"token":"LDO","address":"0x5a98fcbea516cf06857215779fd812ca3bef1b32","decimals":"18"},
    {"token":"GUSD","address":"0x056fd409e1d7a124bd7017459dfea2f387b6d5cd","decimals":"2"},
    {"token":"USDD","address":"0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6","decimals":"18"},
    {"token":"KCS","address":"0xf34960d9d60be18cc1d5afc1a6f012a723a28811","decimals":"6"},
    {"token":"BTT","address":"0xc669928185dbce49d2230cc9b0979be6dc797957","decimals":"18"},
    {"token":"HT","address":"0x6f259637dcd74c767781e37bc6133cd6a68aa161","decimals":"18"},
    {"token":"MKR","address":"0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2","decimals":"18"},
    {"token":"PAXG","address":"0x45804880De22913dAFE09f4980848ECE6EcbAf78","decimals":"18"},
    {"token":"FTM","address":"0x4e15361fd6b4bb609fa63c81a2be19d873717870","decimals":"18"},
    {"token":"GRT","address":"0xc944e90c64b2c07662a292be6244bdf05cda44a7","decimals":"18"},
    {"token":"NEXO","address":"0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206","decimals":"18"},
    {"token":"SNX","address":"0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f","decimals":"18"},
    {"token":"BAT","address":"0x0d8775f648430679a709e98d2b0cb6250d2887ef","decimals":"18"},
    {"token":"XDCE","address":"0x41ab1b6fcbb2fa9dced81acbdec13ea6315f2bf2","decimals":"18"},
    {"token":"BIT","address":"0x1a4b46696b2bb4794eb3d4c26f1c55f9170fa4c5","decimals":"18"},
    {"token":"ENJ","address":"0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c","decimals":"18"},
    {"token":"1INCH","address":"0x111111111117dc0aa78b770fa6a738034120c302","decimals":"18"},
    {"token":"LRC","address":"0xbbbbca6a901c926f240b89eacb641d8aec7aeafd","decimals":"18"},
    {"token":"DFI","address":"0x8fc8f8269ebca376d046ce292dc7eac40c8d358a","decimals":"8"},
    {"token":"FXS","address":"0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0","decimals":"18"},
    {"token":"RPL","address":"0xd33526068d116ce69f19a9ee46f0bd304f21a51f","decimals":"18"},
    {"token":"AMP","address":"0xff20817765cb7f73d4bde2e66e067e58d11095c2","decimals":"18"},
    {"token":"HOT","address":"0x6c6ee5e31d828de241282b9606c8e98ea48526e2","decimals":"18"},
    {"token":"OHM","address":"0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5","decimals":"9"},
    {"token":"COMP","address":"0xc00e94cb662c3520282e6f5717214004a7f26888","decimals":"18"},
    {"token":"DYDX","address":"0x92d6c1e31e14520e676a687f0a93788b716beff5","decimals":"18"},
    {"token":"CEL","address":"0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d","decimals":"4"},
    {"token":"ENS","address":"0xc18360217d8f7ab5e7c516566761ea12ce7f9d72","decimals":"18"},
    {"token":"MCO","address":"0xb63b606ac810a52cca15e44bb630fd42d8d1d83d","decimals":"8"},
    {"token":"GNO","address":"0x6810e776880c02933d47db1b9fc05908e5386b96","decimals":"18"},
    {"token":"IOTX","address":"0x6fb3e0a217407efff7ca062d46c26e5d60a14d69","decimals":"18"},
    {"token":"SUSHI","address":"0x6b3595068778dd592e39a122f4f5a5cf09c90fe2","decimals":"18"},
    {"token":"CHSB","address":"0xba9d4199fab4f26efe3551d490e3821486f135ba","decimals":"8"},
    {"token":"GALA","address":"0x15D4c048F83bd7e37d49eA4C83a07267Ec4203dA","decimals":"8"},
    {"token":"MASK","address":"0x69af81e73a73b40adf4f3d4223cd9b1ece623074","decimals":"18"},
    {"token":"HBTC","address":"0x0316EB71485b0Ab14103307bf65a021042c6d380","decimals":"18"},
    {"token":"wCELO","address":"0xe452e6ea2ddeb012e20db73bf5d3863a3ac8d77a","decimals":"18"},
    {"token":"EURT","address":"0xC581b735A1688071A1746c968e0798D642EDE491","decimals":"6"},
    {"token":"GLM","address":"0x7DD9c5Cba05E151C895FDe1CF355C9A1D5DA6429","decimals":"18"},
    {"token":"rETH","address":"0xae78736cd615f374d3085123a210448e74fc6393","decimals":"18"},
    {"token":"BAL","address":"0xba100000625a3754423978a60c9317c58a424e3d","decimals":"18"},
    {"token":"POLY","address":"0x9992ec3cf6a55b00978cddf2b27bc6882d88d1ec","decimals":"18"},
    {"token":"YFI","address":"0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e","decimals":"18"},
    {"token":"LPT","address":"0x58b6a8a3302369daec383334672404ee733ab239","decimals":"18"},
    {"token":"RSR","address":"0x320623b8e4ff03373931769a31fc52a4e78b5d70","decimals":"18"},
    {"token":"OMG","address":"0xd26114cd6EE289AccF82350c8d8487fedB8A0C07","decimals":"18"},
    {"token":"ZRX","address":"0xe41d2489571d322189246dafa5ebde1f4699f498","decimals":"18"},
    {"token":"RNDR","address":"0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24","decimals":"18"},
    {"token":"WOO","address":"0x4691937a7508860f876c9c0a2a617e7d9e945d4b","decimals":"18"},
    {"token":"CET","address":"0x081f67afa0ccf8c7b17540767bbe95df2ba8d97f","decimals":"18"},
    {"token":"INJ","address":"0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30","decimals":"18"},
    {"token":"VVS","address":"0x839e71613f9aa06e5701cf6de63e303616b0dde3","decimals":"18"},
    {"token":"WAX","address":"0x39bb259f66e1c59d5abef88375979b4d20d98022","decimals":"8"},
    {"token":"UMA","address":"0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828","decimals":"18"},
    {"token":"SRM","address":"0x476c5E26a75bd202a9683ffD34359C0CC15be0fF","decimals":"6"},
    {"token":"SYN","address":"0x0f2d719407fdbeff09d87557abb7232601fd9f29","decimals":"18"},
    {"token":"TEL","address":"0x467Bccd9d29f223BcE8043b84E8C8B282827790F","decimals":"2"},
    {"token":"RBN","address":"0x6123b0049f904d730db3c36a31167d9d4121fa6b","decimals":"18"},
    {"token":"SXP","address":"0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9","decimals":"18"},
    {"token":"SKL","address":"0x00c83aecc790e8a4453e5dd3b0b4b3680501a7a7","decimals":"18"}],
"BSC_MAINNET": [{"token":"ETH","address":"0x2170ed0880ac9a755fd29b2688956bd959f933f8","decimals":"18"},
    {"token":"BSC-USD","address":"0x55d398326f99059ff775485246999027b3197955","decimals":"18"},
    {"token":"WBNB","address":"0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c","decimals":"18"},
    {"token":"USDC","address":"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d","decimals":"18"},
    {"token":"anyUSDC","address":"0x8965349fb649a33a30cbfda057d8ec2c48abe2a2","decimals":"18"},
    {"token":"BUSD","address":"0xe9e7cea3dedca5984780bafc599bd69add087d56","decimals":"18"},
    {"token":"XRP","address":"0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe","decimals":"18"},
    {"token":"DOGE","address":"0xba2ae424d960c26247dd6c32edc70b295c744c43","decimals":"8"},
    {"token":"ADA","address":"0x3ee2200efb3400fabb9aacf31297cbdd1d435d47","decimals":"18"},
    {"token":"MATIC","address":"0xcc42724c6683b7e57334c4e856f4c9965ed682bd","decimals":"18"},
    {"token":"DOT","address":"0x7083609fce4d1d8dc0c979aab8c869ea2c873402","decimals":"18"},
    {"token":"DAI","address":"0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3","decimals":"18"},
    {"token":"LTC","address":"0x4338665cbb7b2485a8855a139b75d5e34ab0db94","decimals":"18"},
    {"token":"SHIB","address":"0x2859e4544c4bb03966803b044a93563bd2d0dd4d","decimals":"18"},
    {"token":"UNI","address":"0xbf5140a22578168fd562dccf235e5d43a02ce9b1","decimals":"18"},
    {"token":"AVAX","address":"0x1ce0c2827e2ef14d5c4f29a091d735a204794041","decimals":"18"},
    {"token":"LINK","address":"0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd","decimals":"18"},
    {"token":"ATOM","address":"0x0eb3a705fc54725037cc9e008bdede697f62f335","decimals":"18"},
    {"token":"ETC","address":"0x3d6545b08693dae087e957cb1180ee38b9e3c25e","decimals":"18"},
    {"token":"BTT","address":"0x8595f9da7b868b1822194faed312235e43007b49","decimals":"18"},
    {"token":"BCH","address":"0x8ff795a6f4d97e7887c79bea79aba5cc76444adf","decimals":"18"},
    {"token":"NEAR","address":"0x1fa4a73a3f0133f0025378af00236f3abdee5d63","decimals":"18"},
    {"token":"FLOW","address":"0xc943c5320b9c18c153d1e2d12cc3074bebfb31a2","decimals":"18"},
    {"token":"EGLD","address":"0xbf7c81fff98bbe61b40ed186e4afd6ddd01337fe","decimals":"18"},
    {"token":"EOS","address":"0x56b6fb708fc5732dec1afc8d8556423a2edccbd6","decimals":"18"},
    {"token":"TWT","address":"0x4b0f1812e5df2a09796481ff14017e6005508003","decimals":"18"},
    {"token":"XTZ","address":"0x16939ef78684453bfdfb47825f8a5f714f12623a","decimals":"18"},
    {"token":"PAX","address":"0xb7f8cd00c5a06c0537e2abff0b58033d02e5e094","decimals":"18"},
    {"token":"BTCB","address":"0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c","decimals":"18"},
    {"token":"XCN","address":"0x7324c7c0d95cebc73eea7e85cbaac0dbdf88a05b","decimals":"18"},
    {"token":"TUSD","address":"0x14016e85a25aeb13065688cafb43044c2ef86784","decimals":"18"},
    {"token":"AXS","address":"0x715d400f88c167884bbcc41c5fea407ed4d2f8a0","decimals":"18"},
    {"token":"USDP","address":"0xb3c11196a4f3b1da7c23d9fb0a3dde9c6340934f","decimals":"18"},
    {"token":"ZEC","address":"0x1ba42e5193dfa8b03d15dd1b86a3113bbbef8eeb","decimals":"18"},
    {"token":"USDD","address":"0xd17479997F34dd9156Deef8F95A52D81D265be9c","decimals":"18"},
    {"token":"SNX","address":"0x9ac983826058b8a9c7aa1c9171441191232e8404","decimals":"18"},
    {"token":"BTT","address":"0x352Cb5E19b12FC216548a2677bD0fce83BaE434B","decimals":"18"},
    {"token":"FTM","address":"0xad29abb318791d579433d831ed122afeaf29dcfe","decimals":"18"},
    {"token":"MKR","address":"0x5f0da599bb2cccfcf6fdfd7d81743b6020864350","decimals":"18"},
    {"token":"IOTA","address":"0xd944f1d1e9d5f9bb90b62f9d45e447d989580782","decimals":"6"},
    {"token":"XEC","address":"0x0ef2e7602add1733bfdb17ac3094d0421b502ca3","decimals":"18"},
    {"token":"FXS","address":"0xe48a3d7d0bc88d552f730b62c006bc925eadb9ee","decimals":"18"},
    {"token":"ZIL","address":"0xb86abcb37c3a4b64f74f59301aff131a1becc787","decimals":"12"},
    {"token":"BAT","address":"0x101d82428437127bf1608f699cd651e6abf9766e","decimals":"18"},
    {"token":"1INCH","address":"0x111111111117dc0aa78b770fa6a738034120c302","decimals":"18"},
    {"token":"COMP","address":"0x52ce071bd9b1c4b00a0b92d298c512478cad67e8","decimals":"18"},
    {"token":"GMT","address":"0x3019bf2a2ef8040c242c9a4c5c4bd4c81678b2a1","decimals":"8"},
    {"token":"IOTX","address":"0x9678e42cebeb63f23197d726b29b1cb20d0064e5","decimals":"18"},
    {"token":"USTC","address":"0x23396cf899ca06c4472205fc903bdb4de249d6fc","decimals":"18"},
    {"token":"YFI","address":"0x88f1a5ae2a3bf98aeaf342d26b30a79438c9142e","decimals":"18"},
    {"token":"ANKR","address":"0xf307910a4c7bbc79691fd374889b36d8531b08e3","decimals":"18"},
    {"token":"JST","address":"0xea998d307aca04d4f0a3b3036aba84ae2e409c0a","decimals":"18"},
    {"token":"GALA","address":"0x7ddee176f665cd201f93eede625770e2fd911990","decimals":"18"},
    {"token":"vBTC","address":"0x882c173bc7ff3b7786ca16dfed3dfffb9ee7847b","decimals":"8"},
    {"token":"ONT","address":"0xfd7b3a77848f1c2d67e05e54d78d174a0c850335","decimals":"18"},
    {"token":"SFM","address":"0x42981d0bfbAf196529376EE702F2a9Eb9092fcB5","decimals":"9"},
    {"token":"SXP","address":"0x47bead2563dcbf3bf2c9407fea4dc236faba485a","decimals":"18"},
    {"token":"KNC","address":"0xfe56d5892bdffc7bf58f2e84be1b2c32d21c308b","decimals":"18"},
    {"token":"SLP","address":"0x070a08beef8d36734dd67a491202ff35a6a16d97","decimals":"18"},
    {"token":"vUSDC","address":"0xeca88125a5adbe82614ffc12d0db554e2e2867c8","decimals":"8"},
    {"token":"SYN","address":"0xa4080f1778e69467e905b8d6f72f6e441f9e9484","decimals":"18"},
    {"token":"FLOKI","address":"0xfb5b838b6cfeedc2873ab27866079ac55363d37e","decimals":"9"},
    {"token":"PROM","address":"0xaf53d56ff99f1322515e54fdde93ff8b3b7dafd5","decimals":"18"},
    {"token":"MDX","address":"0x9c65ab58d8d978db963e63f2bfb7121627e3a739","decimals":"18"},
    {"token":"ANY","address":"0xf68c9df95a18b2a5a5fa1124d79eeeffbad0b6fa","decimals":"18"},
    {"token":"COTI","address":"0xadbaf88b39d37dc68775ed1541f1bf83a5a45feb","decimals":"18"},
    {"token":"ALICE","address":"0xac51066d7bec65dc4589368da368b212745d63e8","decimals":"6"},
    {"token":"BAND","address":"0xad6caeb32cd2c308980a548bd0bc5aa4306c6c18","decimals":"18"},
    {"token":"WRX","address":"0x8e17ed70334c87ece574c9d537bc153d8609e2a3","decimals":"8"},
    {"token":"ORBS","address":"0xebd49b26169e1b52c04cfd19fcf289405df55f80","decimals":"18"},
    {"token":"BSW","address":"0x965f527d9159dce6288a2219db51fc6eef120dd1","decimals":"18"},
    {"token":"CTSI","address":"0x8da443f84fea710266c8eb6bc34b71702d033ef2","decimals":"18"},
    {"token":"ALPHA","address":"0xa1faa113cbe53436df28ff0aee54275c13b40975","decimals":"18"},
    {"token":"CELR","address":"0x1f9f6a696c6fd109cd3956f45dc709d2b3902163","decimals":"18"},
    {"token":"PHA","address":"0x0112e557d400474717056c4e6d40edd846f38351","decimals":"18"},
    {"token":"REEF","address":"0xf21768ccbc73ea5b6fd3c687208a7c2def2d966e","decimals":"18"}]
}

module.exports = ERC20s_of_interest