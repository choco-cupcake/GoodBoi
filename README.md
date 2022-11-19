# GoodBoi
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/doggo.png?raw=true" alt="Doggo" width="150px"/>
</p>
TLDR: Scraper of EVM compatible Smart Contracts' verified sources + runner of Slither custom detectors on the SC Database

### Description
The main purpose of this tool is to look for vulnerable patterns made up taking inspirations from smart contracts being audited, or from hacks happened in the wild.

The idea is to encode patterns with very low match rate and low-ish precision (5-10% is totally fine) into Slither custom detectors, to then scan hundreds of thousands (hopefully millions soon) of SC and manually inspect the SC found. Filtering the false-positives by hand should be fast given the supposedly low amount of results. One should refine the detector if false-positives are too many.

### Disclaimer
This stuff is absolutely WIP and rushed during my spare time, the code is a bit messy and there is no documentation. Have fun :rainbow:

While things get more stable you can start thinkering on detectors - the actual fun part btw.

### Research directions
* Generic research of the space while having fun going fishing for vulnerabilities
* Let the database grow as it can be by itself the base of future projects
* Multiple analysis modules can be implemented in the future. I'm focusing on Slither first because it enables high expressivity and it's blazing fast.

### Usage
```
node main.js
```
```
Available commands:

emptybuffer    --chain

getsource    --chain

analyze    --chain   --detectors   --minval

getbalances   --chain   --daysold
```

**chain**: Target chain [ETH_MAINNET | BSC_MAINNET]

**detectors**: Comma separated detectors: 'detector1,detector2' . Custom detectors should be installed on Slither first - [check Slither doc](https://github.com/crytic/slither/wiki/Adding-a-new-detector)

**minval**: Only analyze contract whose USD balance (native ethers and ERC20s combined) is >= minval USD

**daysold**: Only update balances for contracts whose balance record on the db is older than daysold

## Architecture
<p align="center">
  <img src="https://github.com/choco-cupcake/GoodBoi/raw/main/media/Architecture.png?raw=true" alt="Architecture Design" width="700px"/>
</p>

## Modules description
##### Cloud Address Pool
Etherscan offers a page listing the last 500 verified contracts. Since the main Database is kept on a local PC, in order not to keep it running 24/7 I set up this cloud buffer together with the AWS Lambda crawler.
##### Etherscan scraper
Puppeteer scraper using residential proxies (pay per traffic is kinda free), hosted on a AWS Lambda function called every two hours by an EventBridge cron job.
##### Buffer Downloader
Downloads the cloud buffer into the main database
##### Source Getter
Download the source code of each address in the local address pool. It uses Etherscan's API, the free tier maxes out at 100k reqs per day.
##### Value Reader
For each contract, gets the native ether balance plus the balance of the top 80 ERC20 tokens, then convert everything to USD and saves the informations on the database. 

To get the tokens live prices I used Moralis API as the requests needed are just 80 every few days. 

To get the ERC20 balances without making 80 calls per address, I used this amazing Smart Contract: 0xb1f8e55c7f64d203c1400b9d8555d050f94adf39 . I will definetly adopt this approach for other kinds of requests throughout this project.
##### Slither Manager
Central dispatcher of Slither analysis to the worker threads. Collects analysis results and upload them to database.

## What's gonna change soon
* The scraper for contracts called in recent blocks is on top of the todo list
* Both the scrapers (new verified + current blocks inspection) will be implemented for BSC
* At some point I'll have to move the mySql database from a gaming PC to a more performant remote server

## Open Issues

#### High compilation fail rate
This chapter deserves his own research, at the moment I've been analyzing only recently verified contracts and I'm stuck at around 11.5% compilation error. I only postprocessed pragma lines gaining a 5%, but something more should be done inspecting better the compiling issues. 

The compilation error rate can easily jump above 20% once we start scraping contracts from recent blocks transactions, as we will be analyzing contracts compiled with earlier solc versions that will probably be more problematic. 

## Not really issues

#### What about unverified contracts
Only a small portion of contracts is open source but it's not 2018 anymore, users and money tend to stay where the contracts are verified. 

Plus this only affects our database size, we just need to scrape more. We are fishing.

#### Scalability
This one eventually will probably turn problematic on the database size, but a well designed mysql database can handle millions of records no problem, so we should be good for a while.

About the analysis run time, running GoodBoi locally on a 800$ laptop while using other softwares (mysql server included) i get a throughput of around 3 analysis per second, it's 260k analysis in 24h. Running it on an EC2 instance will make it even faster, and the number of analysis to be performed can be vastly reduced by enforcing a minimum USD balance.

Blockchain read calls (balances and scraping) are kept low thanks to the use of aggregator contracts, and spinning up nodes might turn not necessary.

#### Slither analysis limits
More analysis modules can be implemented in the future, even slower ones since the analysis will be performed on EC2 instances
