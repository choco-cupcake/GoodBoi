exports.handler = async (event) => {
  let body = await launchParsing()
  const response = {
    statusCode: 200,
    body: body,
  };
  return response;
};

const launchParsing = () => {
  return new Promise((resolve, reject) => {
    const { MongoClient, ServerApiVersion } = require('mongodb');
    const chain = "ETH_MAINNET"
    const dbName = process.env.mongo_db_name
    let browser, page
    let timeout_XP = 5000
    let mongoClient

    crawlEtherscan()

    async function crawlEtherscan(){
	
      let lastAddress = await setupMongoDB(chain) // get the newest address we crawled this way - we'll stop when we find that addr
      if(!lastAddress) 
        resolve("")

      await puppeteerBoot();
      
      if(!await expandElements()) // set 100 elements per page for efficiency
        console.log("ERROR - failed expandElements()")
      
      let firstAddress // this is the last chronological contract
      while(true){
        
        let ret = await parsePage(lastAddress)
        console.log("Got " + ret.addresses.length + " new verified contract addresses")
    
        if(!ret.addresses.length)
          break 
        
        if(!firstAddress)
          firstAddress = ret.addresses[0] // we will store this value on the db only if this crawling process doesn't fail
        
        let insertRet = await mongoInsert({"addresses" : ret.addresses})// push addresses to db
        console.log("INSERT")
        console.log(insertRet)

        console.log(JSON.stringify(ret.addresses))
        console.log(ret.addresses)
        if(!ret.next || ret.addresses.length < 100) // last page or we only had to crawl a few in the first page
          break
    
        await sleep(1000) // safety wait for new page loading (actually for the old page to unload, so that we don't reparse the old elements)
                                // we can go generous with the time margin as this task is fast and must only run once in a while
      }
    
      if(firstAddress)
        updateLastParsed(firstAddress) // update last crawled address
    
      await sleep(100)
      console.log("EtherScraper leaving")
      browser.close()
      resolve("all good")
    }
    
    async function parsePage(lastAddress){
      let addressesXP = '//table//tr/td[1]/a/text()'
      let nextPageXP = '//form[@id="ctl00"]//ul/li[4]'
      let lastPageDisabledXP = '//form[@id="ctl00"]//ul/li[last()][contains(@class,"disabled")]'
      
      await page.waitForXPath(addressesXP, {timeout: timeout_XP}); // wait elem load
      let addressesElem = await page.$x(addressesXP); // get addresses
      let addresses = []
      for(let ae of addressesElem){
        addresses.push(await page.evaluate(e => e.textContent, ae))
      }
      let indexLast = addresses.indexOf(lastAddress)
      if(indexLast >= 0){ 
        addresses = addresses.slice(0, indexLast) // remove already parsed addresses
      }
      
      await page.waitForXPath(nextPageXP, {timeout: timeout_XP}); // check if this is the last page
      let nextPDis = await page.$x(lastPageDisabledXP);
      if(nextPDis.length) 
        return {addresses: addresses, next: false}
      
      let nextP = await page.$x(nextPageXP); // click next page
      await nextP[0].click()
      return {addresses: addresses, next: true}
    }
    
    async function expandElements(){
      let selectXP = '//select[@id="ContentPlaceHolder1_ddlRecordsPerPage"]'
      let optXP = '/option[@value="100"]'
      await page.waitForXPath(selectXP, {timeout: timeout_XP});
      const [sel] = await page.$x(selectXP);
      if (sel) {
        await sel.click()
      }
      else return false
      const [opt] = await page.$x(selectXP + optXP);
      page.keyboard.press('1');
      page.keyboard.press('Enter');
      await sleep(1500)
      return true
    }
    
    async function puppeteerBoot() {
      let chromium = require('chrome-aws-lambda');
      let { addExtra } = require('puppeteer-extra');
      let pluginStealth = require('puppeteer-extra-plugin-stealth');
			let proxyChain = require('proxy-chain');
      let puppeteerExtra = addExtra(chromium.puppeteer);
      puppeteerExtra.use(pluginStealth());
			let proxyUrl = "http://" + process.env.smartproxy_id + ":" + process.env.smartproxy_pwd + "@gate.smartproxy.com:7000"
			let newProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
			let newargs = chromium.args.slice();
			newargs.push('--proxy-server=' + newProxyUrl);
      browser = await puppeteerExtra
        .launch({
          args: newargs,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath,
          headless: chromium.headless
        });
      page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB'
      });
      await page.goto("https://etherscan.io/contractsVerified")
      console.log("Puppeteer boot done")
    }

    async function setupMongoDB(chain){
      console.log("Starting DB setup");
      let mongoUrl = 'mongodb+srv://' + process.env.mongouser + ':' + process.env.mongopassword + '@cluster0.jvgcc.mongodb.net'
      console.log(mongoUrl)
      mongoClient = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
      await mongoClient.connect();
      // get last parsed
      let status = (await mongoClient.db(dbName).collection("status").find({"chain" : chain}).toArray());
      if(!status.length || !status[0].last_parsed){
        console.log("Error getting last_parsed from mongo. Aborting")
        return null
      }
      let lastParsed = status[0].last_parsed;
      console.log("Crawled last parsed: " + lastParsed)
      return lastParsed
    }

    async function mongoInsert(obj){
      return await mongoClient.db(dbName).collection(chain + "_address_pool").insertOne(obj);
    }

    async function updateLastParsed(addr){
      var ret = await mongoClient.db(dbName).collection("status").updateOne(
        { chain : chain },
        {
        $set: {last_parsed : addr}
        }
        );
    }
    

  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
