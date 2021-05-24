
const express = require('express')

var io = require('socket.io')
({
  path: '/io/webrtc'
})

const app = express()
const port = 8081

const rooms = {}
const messages = {}

// app.get('/', (req, res) => res.send('Hello World!!!!!'))

//https://expressjs.com/en/guide/writing-middleware.html
app.use(express.static(__dirname + '/build'))
app.get('/', (req, res, next) => { //default room
    res.sendFile(__dirname + '/build/index.html')
})

app.get('/:room', (req, res, next) => {
  res.sendFile(__dirname + '/build/index.html')
  // res.status(200).json({data: 'test'})
})

app.post('/:room', (req, res, next) => {
  // res.sendFile(__dirname + '/build/index.html')
  console.log(req.body)
  res.status(200).json({data: req.body})
})


const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

io.listen(server)

// default namespace
io.on('connection', socket => {
  console.log('connected')
})

const peers = io.of('/webrtcPeer')

// keep a reference of all socket connections
// let connectedPeers = new Map()

peers.on('connection', socket => {

  const room = socket.handshake.query.room

  rooms[room] = rooms[room] && rooms[room].set(socket.id, socket) || (new Map()).set(socket.id, socket)
  messages[room] = messages[room] || []

  // connectedPeers.set(socket.id, socket)

  console.log(socket.id, room)
  socket.emit('connection-success', {
    success: socket.id,
    peerCount: rooms[room].size,
    messages: messages[room],
  })

  const broadcast = () => {
    const _connectedPeers = rooms[room]

    for (const [socketID, _socket] of _connectedPeers.entries()) {
      // if (socketID !== socket.id) {
        _socket.emit('joined-peers', {
          peerCount: rooms[room].size, //connectedPeers.size,
        })
      // }
    }
  }
  broadcast()

  const disconnectedPeer = (socketID) => {
    const _connectedPeers = rooms[room]
    for (const [_socketID, _socket] of _connectedPeers.entries()) {
        _socket.emit('peer-disconnected', {
          peerCount: rooms[room].size,
          socketID
        })
    }
  }

  socket.on('new-message', (data) => {
    console.log('new-message', JSON.parse(data.payload))

    messages[room] = [...messages[room], JSON.parse(data.payload)]
  })

  socket.on('disconnect', () => {
    console.log('disconnected')
    // connectedPeers.delete(socket.id)
    rooms[room].delete(socket.id)
    messages[room] = rooms[room].size === 0 ? null : messages[room]
    disconnectedPeer(socket.id)
  })

  socket.on('socket-to-disconnect', (socketIDToDisconnect) => {
    console.log('disconnected')
    // connectedPeers.delete(socket.id)
    rooms[room].delete(socketIDToDisconnect)
    messages[room] = rooms[room].size === 0 ? null : messages[room]
    disconnectedPeer(socketIDToDisconnect)
  })

  socket.on('onlinePeers', (data) => {
    const _connectedPeers = rooms[room]
    for (const [socketID, _socket] of _connectedPeers.entries()) {
      // don't send to self
      if (socketID !== data.socketID.local) {
        console.log('online-peer', data.socketID, socketID)
        socket.emit('online-peer', socketID)
      }
    }
  })

  socket.on('offer', data => {
    console.log(data)
    const _connectedPeers = rooms[room]
    for (const [socketID, socket] of _connectedPeers.entries()) {
      // don't send to self
      if (socketID === data.socketID.remote) {
        // console.log('Offer', socketID, data.socketID, data.payload.type)
        socket.emit('offer', {
            sdp: data.payload,
            socketID: data.socketID.local
          }
        )
      }
    }
  })

  socket.on('answer', (data) => {
    console.log(data)
    const _connectedPeers = rooms[room]
    for (const [socketID, socket] of _connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        console.log('Answer', socketID, data.socketID, data.payload.type)
        socket.emit('answer', {
            sdp: data.payload,
            socketID: data.socketID.local
          }
        )
      }
    }
  })


  socket.on('candidate', (data) => {
    console.log(data)
    const _connectedPeers = rooms[room]
    // send candidate to the other peer(s) if any
    for (const [socketID, socket] of _connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        socket.emit('candidate', {
          candidate: data.payload,
          socketID: data.socketID.local
        })
      }
    }
  })

})