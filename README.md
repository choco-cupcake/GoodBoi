# GoodBoi
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/doggo.png?raw=true" alt="Doggo" width="150px"/>
</p>

Scraper of EVM compatible Smart Contracts' verified sources + runner of Slither custom detectors on the SC Database

### Use Cases
Look for vulnerable patterns made up taking inspirations from smart contracts being audited, or from hacks happened in the wild - low precision + manual filtering. 

Look for any specific set of contract due to any research. Different analysis tools other than Slither might be implemented in the future, I'm focusing on Slither first because it enables high expressivity and it's blazing fast.

### Usage
TODO pm2 scripts

## Architecture
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/Architecture_1.png?raw=true" alt="Architecture Design" width="700px"/>
</p>

## Modules description
##### Block Parser
Parse 'to' addresses from recent blocks using RPC endpoints. To reduce the RPC calls, a smart contract hs been deployed on each chain. This contract contains a function that gets an array of addresses as input and provides a bool mask as output that tells if each address is a smart contract - EOAs are then discarded.
##### Source Getter
Download the source codes from etherscan, bscscan, polygonscan through their APIs
##### Balance Getter
For each contract, gets the native ether balance plus the balance of the top 80 ERC20 tokens, then convert everything to USD and saves the informations on the database. To reduces the RPC calls this smart contract is used: 0xb1f8e55c7f64d203c1400b9d8555d050f94adf39
##### Slither Runner
Runs slithers instances in parallel and collects results

### Configuration
.env

## Open Issues

#### L2s
Blocks too fast to scrape with the current framework, need a sort of aggregator

## Not really issues

#### Compilation fail rate
Around 5%, not really an issue 

#### Unverified contracts
Verified percentage is around 50% - unique contracts (no same code clones) vs unverified (maybe clones) seen in the same timeframe. 
Higher than I originally expected.

#### Scalability
This one eventually will probably turn problematic on the database size, but a well designed mysql database can handle millions of records no problem, so we should be good for a while. 
A contract pruner is in todo list, a rule like "0 balance and unactive for X months" will be applied

Slither is quite fast and analysis can be scaled on multiple machines. 

Blockchain read calls (balances and scraping) are kept low thanks to the use of aggregator contracts, and spinning up nodes might turn not necessary. 

