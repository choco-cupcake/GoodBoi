const express = require('express')
const mysql = require('../utils/WebUIMysqlGateway')
const app = express()
const port = 3000

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
  console.log(user)
  if(!user){
    res.send({error: "invalid_session"})
    return
  }

  let ad = await mysql.getAvailableDetectors(conn, user, req.params.revState)
  res.header("Access-Control-Allow-Origin", "*");
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
  res.header("Access-Control-Allow-Origin", "*");
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
  res.header("Access-Control-Allow-Origin", "*");
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
  res.header("Access-Control-Allow-Origin", "*");
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
  res.header("Access-Control-Allow-Origin", "*");
  res.send(hits)
})

app.post('/api/login', async (req, res) => {
  let conn = await mysql.getDBConnection()
  if(!req.body.username || !req.body.password)
    return
  let resp = await mysql.login(conn, req.body.username, req.body.password)
  if(resp.error){
    res.send({error: "invalid_session"})
    return
  }
  res.header("Access-Control-Allow-Origin", "*");
  res.send(resp)
})


app.listen(port, () => {
  console.log(`WebUI_API app listening on port ${port}`)
})


