const express = require('express')
var cors = require('cors');
const mysql = require('../utils/WebUIMysqlGateway')
const app = express()
const port = 3000

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/detectors/:revState', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  if(!token){
    res.send({error: "invalid_session"})
    return
  }
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let ad = await mysql.getAvailableDetectors(conn, user, req.params.revState)
  res.send(ad)
})

app.get('/api/detectorslist', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  if(!token){
    res.send({error: "invalid_session"})
    return
  }
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let ad = {detectors: await mysql.getUserDetectors(conn, user)}
  res.send(ad)
})

app.get('/api/hitscount/:detector/:revState', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  if(!token){
    res.send({error: "invalid_session"})
    return
  }
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }
  let allowedDetectors = await mysql.getUserDetectors(conn, user)
  if(!allowedDetectors.includes(req.params.detector)){
    res.send({error: "not_allowed"})
    return
  }
  let ad = {count: await mysql.getDetectorHitsCount(conn, req.params.detector, req.params.revState)}
  res.send(ad)
})

app.get('/api/contracts', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let cpc = await mysql.getContractsPerChain(conn)
  res.send(cpc)
})

app.get('/api/contractsFlagged', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let cpc = await mysql.getContractsPerChain(conn, true)
  res.send(cpc)
})

app.get('/api/contracts24h', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let l24 = await mysql.getContractsLast24h(conn)
  res.send(l24)
})

app.get('/api/compilationErrors', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let ce = await mysql.getCompilationErrors(conn)
  res.send(ce)
})

app.get('/api/hits/:detector/:revState/:offset', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let hits = await mysql.getDetectorHits(conn, user, req.params.detector, req.params.revState, req.params.offset)
  res.send(hits)
})

app.get('/api/analysisCount/:detector', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let count = await mysql.getAnalysisCount(conn, req.params.detector)
  res.send(count)
})

app.post('/api/login', async (req, res) => {
  let conn = await mysql.getDBConnection()
  if(!req.body.username || !req.body.password)
    return
  let resp = await mysql.login(conn, req.body.username, req.body.password)
  if(resp.error){
    res.send({error: "invalid_credentials"})
    return
  }
  res.send(resp)
})

app.put('/api/manualRevision/:id/:detector/:revState', async (req, res) => {
  let conn = await mysql.getDBConnection()
  let token = req.headers.authtoken
  let user = await mysql.getTokenUser(conn, token)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let resp = await mysql.updateRevState(conn, user, req.params.id, req.params.detector, req.params.revState)
  res.send(resp)
})


app.listen(port, () => {
  console.log(`WebUI_API app listening on port ${port}`)
})


