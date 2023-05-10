# GoodBoi
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/doggo.png?raw=true" alt="Doggo" width="150px"/>
</p>

Scraper of EVM compatible Smart Contracts' verified sources and runner of Slither custom detectors on the SC Database

### Use Cases
- GoodBoi can be used to identify vulnerable patterns in smart contracts, drawing inspiration from audited contracts and hacks happened in the wild — low precision and manual filtering. 

- During an audit in can be useful to find similar implementations of specific functionalities under exam

- GoodBoi can also be used to search for specific sets of contracts based on research requirements. While Slither is currently the primary focus due to its high expressivity and fast performance, other analysis tools may be implemented in the future.

### Usage
##### Server
````
npm run startall
````
Note: Major chains bootstrapping might lead to a ton of calls in the first days. It is thus suggested to avoid starting all the modules together with a new database, if the number of calls is a concern.


##### Analysis machine
````
node services/slitherRunner.js
````

### Configuration
````
.env.example
````

## Architecture
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/Architecture_2.png?raw=true" alt="Architecture Design" width="700px"/>
</p>
<p align="center">
  Main Database tables and modules
</p>

## Modules description
### Block Parser
The Block Parser module is responsible for parsing 'to' addresses from recent blocks. To minimize RPC calls, an aggregator smart contract has been deployed on each chain. This contract contains a function that takes an array of addresses as input and provides a boolean mask as output, indicating if each address is a smart contract. EOAs (Externally Owned Accounts) are discarded accordingly.
### Source Getter
The Source Getter module  downloads the source codes from etherscan, bscscan, polygonscan through their APIs.

The files downloaded are hashed to avoid duplicates.

If the recheck feature is enabled, unverified contracts are rechecked once every BLOCK_PARSER_VERIFIED_RECHECK_DAYS days if they appear in new blocks. This ensures that contracts that are verified after deployment are not missed. Although it may be wise to stop rechecking after a while, the system is currently capable of handling the volume of calls.

The source code is analyzed to extract the public state variables of type address, address[], mapping(unitXXX => address) from the contract and save them in a JSON format in the database. This information is used to check for the PoolFlag, as described in the Notes.AnalysisFlags section.

The process of variable extracting is done through Regex and text analysis, under the assumption that the state variables are properly placed before constructor/functions/modifiers/etc . Ideally a custom Slither detector would be used, but that does not scale that well.
### Balance Getter
The Balance Getter module retrieves the native ether balance and the balance of the top ~80 ERC20 tokens for each contract. The balances are then converted to USD and stored in the database. Contracts with an overall USD value greater than or equal to FLAGGER_MIN_BALANCE have the BalanceFlag activated. The BalanceFlag is used to determine which contracts will be analyzed, as explained in the Notes.AnalysisFlags section.
To reduces the RPC calls, a balances aggregator smart contract is utilized.

The contract pruning feature allows contracts to be pruned based on the rule (0 balance AND lastTx older than X days AND not flagged AND is not the implementation of a non-pruned contract). Pruning occurs during balance checks.
### State Variables Reader
The State Variables Reader module retrieves the address values of public address variables in each contract from the blockchain. The GetValueAggregator contract is used to minimize RPC calls. This module also launches the PoolFlagger, used to check for the PoolFlag, as detailed in the Notes.AnalysisFlags section.
### Proxy Implementation Reader
The Proxy Implementation Reader module checks the eip1967 implementation storage slot for contracts with "proxy" in their name or flagged as proxy by etherscan. Proxy and implementation contracts are linked in the database. This module is used to properly perform Pool/BalanceFlagging and contract pruning when the proxy pattern is utilized.
### Pool Flagger
This module activates the PoolFlag if a contract: 
- is an ERC20 with a pool (against WETH)
- contains in a storage variable (or array or uint=>address map) an address which is:
  - an ERC20 with a pool
  - a pool
  
Note: Variables names are blacklisted to ignore irrelevant ones, and mappings names are whitelisted as they are mostly useless.


AMM checked for pools:
- Eth: UniV3, UniV2, PancakeSwapV2, BalancerV2
- BSC: PancakeSwapV2
- Polygon: UniV3, Quickswap, BalancerV2
- Arbitrum: UniV3

Where it is straightforward (UniV2 and UniV2-like), pools are filtered by WETH liquidity to be at least FLAGGER_CONTRACT_MIN_POOL_USD. In the future it would be nice to extend this feature to the other protocols.

Note: A proxy contract will be pool analyzed according to its implementation source code and variables.

### Flags Reflector
Reflects Flags, see section Notes.AnalysisFlags

### Slither Runner
The Slither Runner module is designed to run Slither instances in parallel and save the results to the database. It takes a set of detectors as input and uses only the detectors that have not been used on a contract before, in order to analyze the contract. 

Analyses are minimized by aggregating contracts by their sourcefiles signatures: clone contracts are analyzed only once.

Currently, the analysis module is run on demand, but in the future, when there are multiple custom detectors available, it will be designed to run continuously, actively searching for hits on newly parsed contracts on a daily basis.

Since custom detectors development is incremental to filter out false positives while conducting manual inspection on hits, this module allows for the argument flag "--refilter DETECTOR_NAME", to only re-analyze hits previously detected by the provided custom detector.

### Analysis Results UI
Not yet pretty but good UX, allows to assign to each finding a score from 1:FP to 4:Exploitable 

Repo: https://github.com/giovannifranchi/goodboi-frontend

## Slither Detectors Development
The development process follows an incremental approach, wherein subsequent phases are iteratively executed after the main development phase. 
- Detector development
- Run detector 
- Inspect hits using the frontend
- Refine detector code to account for newly discovered false positive patterns 
	- When some false positives are recurring (forked code) and hard to filter, one can rely on function and contract names to apply filters
- Refilter previous hits by running 'node services/slitherRunner --refilter "detector-name"'
- If the previous run resulted in errors, retry the failed analysis by runing 'node services/slitherRunner --retryErrors' (this flow to be improved as it currently retry any error regardless of the type)

When writing custom detectors for Slither, it is important to account for every edge case. A failure of a single detector will cause the analysis to fail for other detectors as well.

Source codes of currently running custom detectors can be found in the folder /custom_detectors. They'll eventually end up in another repo.

## Main Notes
### Analysis Flags - How to choose which contracts to analyze
The whole point of this project is to skip the boring part. And manual filtering of results even if simple, is boring.
It is thus important to have a process to flag exploitable contracts, to reduce analysis and manual inspection time.

In this flagging process we want to be more loose than strict, as we will discard all the other contracts from the analysis.

There are currently two main flags implemented:
- PoolFlag: activated if a contract: 
	- is an ERC20 with a pool (against WETH)
	- contains in a storage variable (or array or (uintXXX=>address) map) an address which is:
	  - an ERC20 with a pool
	  - a pool
	
	Note: A proxy contract will be pool analyzed according to its implementation source code and variables.
- BalanceFlag: activated if a contract has an overall USD value (native + top ERC20) >= FLAGGER_MIN_BALANCE
- Reflected Flags: flag contracts that contain the address of a flagged contract in a storage variable, array, or mapping. PoolFlag reflects to ReflPoolFlag, and BalanceFlag reflects to ReflBalanceFlag.
Reflection flags are used to flag all components of a multi-contract protocol when a single component is flagged with PoolFlag or BalanceFlag.

GoodBoi is continuously being improved, and suggestions for additional flags are highly appreciated.

### Scalability 
##### Database Size
With the pruner active, the number of contracts on ETH, BSC, POLY, and ARB is slightly over 1 million, which is manageable even on small machines.

##### Slither analysis time
Slither is quite fast and analysis can be scaled on multiple machines. Currently, the number of flagged contracts is below 100k, which can be analyzed on a regular laptop in under 24 hours (around 100 analyses per minute) while working on it.

##### RPC calls rate
Blockchain read calls are kept low by using aggregator contracts. This allows the project to operate using the free tier of multiple RPC providers. 

However, during the initial bootstrapping of major chains, there may be a high volume of calls, so it is suggested to avoid starting all the modules together with a new database if the number of calls is a concern.

L2s can be a bit of a pain since the tx-scanners (e.g. arbiscan) currently do not provide the tx batches by API, and blocks retrivial consumes quite a few RPC calls.

##### Source code gathering & verified rechecks
GoodBoi uses the free tier of etherscan/bscscan/polygonscan/arbiscan to gather source code and verify contracts. These free tiers provide 100k calls per day, which is sufficient to obtain new contracts and re-check old contracts for verification status. The database keeps track of unverified smart contracts and rechecks them only once every BLOCK_PARSER_VERIFIED_RECHECK_DAYS days, if they appear again in new blocks.

### Save compiled AST instead of source code
Slither compiles the contracts before their analysis, and compilation time can easily be longer than the analysis time. Saving the compiled AST on the database and feeding it to Slither instead of the source code, would speed up subsequent analysis a lot.

Unluckily Slither deprecated the AST input feature years ago.

## Side Considerations

#### Unverified contracts
Verified percentage is around 50% (even higher on Arbitrum) - unique contracts (no same code clones) vs unverified (maybe clones) seen in the same timeframe.
Higher than I originally expected.

#### Diamond Proxy
Not currently supported.

#### Fail rate
The overall analysis failure rate is around 5%, with detector failures (edge cases hell) occurring more frequently than compilation failures (the same solc version used to verify the source code on etherscan is fed to Slither to use for compilation)

#### PM2
GoodBoi's architecture is modular and PM2 is used to manage the instances of the modules. The modules run independently, but may rely on results from other modules.

"startall" script runs all the modules with a hygienic restart every few hours/days depending on the module. 
