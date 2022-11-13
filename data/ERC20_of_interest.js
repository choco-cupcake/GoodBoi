const ERC20s_of_interest = [
  {
      "token": "ETH",
      "address": "0x0"
  },
  {
      "token": "USDT",
      "address": "0xdac17f958d2ee523a2206206994597c13d831ec7"
  },
  {
      "token": "BNB",
      "address": "0xB8c77482e45F1F44dE1745F52C74426C631bDD52"
  },
  {
      "token": "USDC",
      "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  },
  {
      "token": "BUSD",
      "address": "0x4fabb145d64652a948d72533023f6e7a623c7c53"
  },
  {
      "token": "MATIC",
      "address": "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0"
  },
  {
      "token": "stETH",
      "address": "0xae7ab96520de3a18e5e111b5eaab095312d7fe84"
  },
  {
      "token": "HEX",
      "address": "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39"
  },
  {
      "token": "SHIB",
      "address": "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE"
  },
  {
      "token": "DAI",
      "address": "0x6b175474e89094c44da98b954eedeac495271d0f"
  },
  {
      "token": "THETA",
      "address": "0x3883f5e181fccaf8410fa61e12b59bad963fb645"
  },
  {
      "token": "OKB",
      "address": "0x75231f58b43240c9718dd58b4967c5114342a86c"
  },
  {
      "token": "UNI",
      "address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
  },
  {
      "token": "WBTC",
      "address": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
  },
  {
      "token": "LEO",
      "address": "0x2af5d2ad76741191d15dfe7bf6ac92d4bd912ca3"
  },
  {
      "token": "LINK",
      "address": "0x514910771af9ca656af840dff83e8264ecf986ca"
  },
  {
      "token": "CRO",
      "address": "0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b"
  },
  {
      "token": "NEAR",
      "address": "0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4"
  },
  {
      "token": "QNT",
      "address": "0x4a220e6096b25eadb88358cb44068a3248254675"
  },
  {
      "token": "VEN",
      "address": "0xd850942ef8811f2a866692a623011bde52a462c1"
  },
  {
      "token": "FRAX",
      "address": "0x853d955acef822db058eb8505911ed77f175b99e"
  },
  {
      "token": "CHZ",
      "address": "0x3506424f91fd33084466f402d5d97f05f8e3b4af"
  },
  {
      "token": "XCN",
      "address": "0xa2cd3d43c775978a96bdbf12d733d5a1ed94fb18"
  },
  {
      "token": "SAND",
      "address": "0x3845badAde8e6dFF049820680d1F14bD3903a5d0"
  },
  {
      "token": "APE",
      "address": "0x4d224452801aced8b2f0aebe155379bb5d594381"
  },
  {
      "token": "TUSD",
      "address": "0x0000000000085d4780B73119b644AE5ecd22b376"
  },
  {
      "token": "USDP",
      "address": "0x8e870d67f660d95d5be530380d0ec0bd388289e1"
  },
  {
      "token": "wMANA",
      "address": "0xfd09cf7cfffa9932e33668311c4777cb9db3c9be"
  },
  {
      "token": "LDO",
      "address": "0x5a98fcbea516cf06857215779fd812ca3bef1b32"
  },
  {
      "token": "GUSD",
      "address": "0x056fd409e1d7a124bd7017459dfea2f387b6d5cd"
  },
  {
      "token": "USDD",
      "address": "0x0C10bF8FcB7Bf5412187A595ab97a3609160b5c6"
  },
  {
      "token": "KCS",
      "address": "0xf34960d9d60be18cc1d5afc1a6f012a723a28811"
  },
  {
      "token": "BTT",
      "address": "0xc669928185dbce49d2230cc9b0979be6dc797957"
  },
  {
      "token": "HT",
      "address": "0x6f259637dcd74c767781e37bc6133cd6a68aa161"
  },
  {
      "token": "MKR",
      "address": "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"
  },
  {
      "token": "PAXG",
      "address": "0x45804880De22913dAFE09f4980848ECE6EcbAf78"
  },
  {
      "token": "FTM",
      "address": "0x4e15361fd6b4bb609fa63c81a2be19d873717870"
  },
  {
      "token": "GRT",
      "address": "0xc944e90c64b2c07662a292be6244bdf05cda44a7"
  },
  {
      "token": "XAUt",
      "address": "0x68749665ff8d2d112fa859aa293f07a622782f38"
  },
  {
      "token": "NEXO",
      "address": "0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206"
  },
  {
      "token": "SNX",
      "address": "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f"
  },
  {
      "token": "BAT",
      "address": "0x0d8775f648430679a709e98d2b0cb6250d2887ef"
  },
  {
      "token": "XDCE",
      "address": "0x41ab1b6fcbb2fa9dced81acbdec13ea6315f2bf2"
  },
  {
      "token": "BIT",
      "address": "0x1a4b46696b2bb4794eb3d4c26f1c55f9170fa4c5"
  },
  {
      "token": "ENJ",
      "address": "0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c"
  },
  {
      "token": "1INCH",
      "address": "0x111111111117dc0aa78b770fa6a738034120c302"
  },
  {
      "token": "LRC",
      "address": "0xbbbbca6a901c926f240b89eacb641d8aec7aeafd"
  },
  {
      "token": "DFI",
      "address": "0x8fc8f8269ebca376d046ce292dc7eac40c8d358a"
  },
  {
      "token": "FXS",
      "address": "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0"
  },
  {
      "token": "RPL",
      "address": "0xd33526068d116ce69f19a9ee46f0bd304f21a51f"
  },
  {
      "token": "ZIL",
      "address": "0x05f4a42e251f2d52b8ed15e9fedaacfcef1fad27"
  },
  {
      "token": "AMP",
      "address": "0xff20817765cb7f73d4bde2e66e067e58d11095c2"
  },
  {
      "token": "HOT",
      "address": "0x6c6ee5e31d828de241282b9606c8e98ea48526e2"
  },
  {
      "token": "NXM",
      "address": "0xd7c49cee7e9188cca6ad8ff264c1da2e69d4cf3b"
  },
  {
      "token": "pSAFEMOON",
      "address": "0x16631e53c20fd2670027c6d53efe2642929b285c"
  },
  {
      "token": "OHM",
      "address": "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5"
  },
  {
      "token": "COMP",
      "address": "0xc00e94cb662c3520282e6f5717214004a7f26888"
  },
  {
      "token": "DYDX",
      "address": "0x92d6c1e31e14520e676a687f0a93788b716beff5"
  },
  {
      "token": "CEL",
      "address": "0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d"
  },
  {
      "token": "ENS",
      "address": "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
  },
  {
      "token": "MCO",
      "address": "0xb63b606ac810a52cca15e44bb630fd42d8d1d83d"
  },
  {
      "token": "GNO",
      "address": "0x6810e776880c02933d47db1b9fc05908e5386b96"
  },
  {
      "token": "IOTX",
      "address": "0x6fb3e0a217407efff7ca062d46c26e5d60a14d69"
  },
  {
      "token": "GMT",
      "address": "0xe3c408BD53c31C085a1746AF401A4042954ff740"
  },
  {
      "token": "SUSHI",
      "address": "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2"
  },
  {
      "token": "CHSB",
      "address": "0xba9d4199fab4f26efe3551d490e3821486f135ba"
  },
  {
      "token": "GALA",
      "address": "0x15D4c048F83bd7e37d49eA4C83a07267Ec4203dA"
  },
  {
      "token": "MASK",
      "address": "0x69af81e73a73b40adf4f3d4223cd9b1ece623074"
  },
  {
      "token": "WQTUM",
      "address": "0x3103df8f05c4d8af16fd22ae63e406b97fec6938"
  },
  {
      "token": "HBTC",
      "address": "0x0316EB71485b0Ab14103307bf65a021042c6d380"
  },
  {
      "token": "wCELO",
      "address": "0xe452e6ea2ddeb012e20db73bf5d3863a3ac8d77a"
  },
  {
      "token": "EURT",
      "address": "0xC581b735A1688071A1746c968e0798D642EDE491"
  },
  {
      "token": "GLM",
      "address": "0x7DD9c5Cba05E151C895FDe1CF355C9A1D5DA6429"
  },
  {
      "token": "rETH",
      "address": "0xae78736cd615f374d3085123a210448e74fc6393"
  },
  {
      "token": "BAL",
      "address": "0xba100000625a3754423978a60c9317c58a424e3d"
  },
  {
      "token": "POLY",
      "address": "0x9992ec3cf6a55b00978cddf2b27bc6882d88d1ec"
  },
  {
      "token": "ONE",
      "address": "0x799a4202c12ca952cb311598a024c80ed371a41e"
  },
  {
      "token": "YFI",
      "address": "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e"
  },
  {
      "token": "LPT",
      "address": "0x58b6a8a3302369daec383334672404ee733ab239"
  },
  {
      "token": "ELON",
      "address": "0x761d38e5ddf6ccf6cf7c55759d5210750b5d60f3"
  },
  {
      "token": "RSR",
      "address": "0x320623b8e4ff03373931769a31fc52a4e78b5d70"
  },
  {
      "token": "OMG",
      "address": "0xd26114cd6EE289AccF82350c8d8487fedB8A0C07"
  },
  {
      "token": "IOST",
      "address": "0xfa1a856cfa3409cfa145fa4e20eb270df3eb21ab"
  },
  {
      "token": "ZRX",
      "address": "0xe41d2489571d322189246dafa5ebde1f4699f498"
  },
  {
      "token": "RNDR",
      "address": "0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24"
  },
  {
      "token": "NFT",
      "address": "0x198d14f2ad9ce69e76ea330b374de4957c3f850a"
  },
  {
      "token": "WOO",
      "address": "0x4691937a7508860f876c9c0a2a617e7d9e945d4b"
  },
  {
      "token": "CET",
      "address": "0x081f67afa0ccf8c7b17540767bbe95df2ba8d97f"
  },
  {
      "token": "KUB",
      "address": "0x0649cef6d11ed6f88535462e147304d3fe5ae14d"
  },
  {
      "token": "INJ",
      "address": "0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30"
  },
  {
      "token": "VVS",
      "address": "0x839e71613f9aa06e5701cf6de63e303616b0dde3"
  },
  {
      "token": "WAX",
      "address": "0x39bb259f66e1c59d5abef88375979b4d20d98022"
  },
  {
      "token": "EURS",
      "address": "0xdb25f211ab05b1c97d595516f45794528a807ad8"
  },
  {
      "token": "VERI",
      "address": "0x8f3470A7388c05eE4e7AF3d01D8C722b0FF52374"
  },
  {
      "token": "UMA",
      "address": "0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828"
  },
  {
      "token": "SRM",
      "address": "0x476c5E26a75bd202a9683ffD34359C0CC15be0fF"
  },
  {
      "token": "SYN",
      "address": "0x0f2d719407fdbeff09d87557abb7232601fd9f29"
  },
  {
      "token": "TEL",
      "address": "0x467Bccd9d29f223BcE8043b84E8C8B282827790F"
  },
  {
      "token": "RBN",
      "address": "0x6123b0049f904d730db3c36a31167d9d4121fa6b"
  },
  {
      "token": "SXP",
      "address": "0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9"
  },
  {
      "token": "SKL",
      "address": "0x00c83aecc790e8a4453e5dd3b0b4b3680501a7a7"
  }
]

module.exports = ERC20s_of_interest