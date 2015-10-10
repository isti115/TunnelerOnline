var WebSocketServer = require('ws').Server;

module.exports.init = function(server) {
  var webSocketServer = new WebSocketServer({server:server});
  
  webSocketServer.addListener('connection', connect);
  
  setInterval(update, 1000/60);
};

var clients = [];
var rooms = {};
var players = {};

function connect(webSocketConnection) {
  webSocketConnection.addListener('message', receive(webSocketConnection));
  webSocketConnection.addListener('close', disconnect(webSocketConnection));
  
  clients.push(webSocketConnection);
  
  console.log('client connected with ip: ' + webSocketConnection._socket.remoteAddress);
  console.log('client count: ' + clients.length);
}

function receive(webSocketConnection) {
  return function(message) {
    var parsedMessage = JSON.parse(message);
    console.log(parsedMessage);
    
    if (parsedMessage.type == 'lobbyJoin') {
      console.log("joined");
      
      var currentPlayer = {};
      
      currentPlayer.connection = webSocketConnection;
      
      var id = '';
      while(id == '' || id in players) {
        id = getRandomId(10);
      }
      
      webSocketConnection.id = id;
      currentPlayer.connection.send(JSON.stringify({type: 'id', data: {id: id}}));
      
      currentPlayer.roomName = parsedMessage.data.roomName;
      currentPlayer.state = 'lobby';
      
      if (!(currentPlayer.roomName in rooms)) {
        var currentRoom = {};
        
        currentRoom.state = 'lobby';
        currentRoom.owner = id;
        currentRoom.players = [];
        
        rooms[currentPlayer.roomName] = currentRoom;
      }
      
      rooms[currentPlayer.roomName].players.push(id);
      
      players[id] = currentPlayer;
    }
    
    if (parsedMessage.type == 'gameStart') {
      console.log("started");
      
      var currentRoom = rooms[players[parsedMessage.sender].roomName];
      
      if (currentRoom.owner == parsedMessage.sender) {
        currentRoom.state = 'game';
        
        for (var i = 0; i < currentRoom.players.length; i++) {
          players[currentRoom.players[i]].state = 'connecting';
          players[currentRoom.players[i]].connection.send(JSON.stringify({type: 'gameStart'}));
        }
      }
    }
    
    if (parsedMessage.type == 'gameJoin') {
      console.log("gameJoined");
      
      players[parsedMessage.sender].connection = webSocketConnection;
      
      players[parsedMessage.sender].state = 'game';
    }
  }
}

function getRandomId(length) {
  // return Math.floor(1000000000 + Math.random() * 9000000000);
  
  var characters = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var id = '';
  
  for (var i = 0; i < length; i++) {
    id += characters[Math.floor(Math.random() * characters.length)];
  }
  
  return id;
}

function disconnect(webSocketConnection) {
  return function() {
    if (webSocketConnection.id in players && players[webSocketConnection.id].state != 'connecting') {
      rooms[players[webSocketConnection.id].roomName].players.splice(rooms[players[webSocketConnection.id].roomName].players.indexOf(webSocketConnection.id), 1);
      if (rooms[players[webSocketConnection.id].roomName].players.length == 0) {
        delete rooms[players[webSocketConnection.id].roomName];
      }
      
      delete players[webSocketConnection.id];
    }
    
    clients.splice(clients.indexOf(webSocketConnection), 1);
    console.log('client disconnected. remaining: ' + clients.length);
  }
}

function update() {
  console.log(rooms);
  for (room in rooms) {
    if (rooms[room].state == 'lobby') {
      var lobbyData = {};
      
      lobbyData.players = rooms[room].players;
      
      for (var i = 0; i < rooms[room].players.length; i++) {
        players[rooms[room].players[i]].connection.send(JSON.stringify({type: 'lobbyUpdate', data: lobbyData}));
      }
    }
  }
}

// module.exports.broadcast = function(data) {
//   for (var i = 0; i < clients.length; i++) {
//     clients[i].send(JSON.stringify(data));
//   }
// }
