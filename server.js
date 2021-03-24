const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const {
	sendUpdateGamesList,
	onCreateGame,
	onJoinGame,
	onMovePiece,
	onResetGame,
	onPlayAgain,
	onCancelPlayAgain,
	onLeaveGame,
	onMakeCall,
	onCallUser,
	onAcceptCall,
	onCancelCall,
	onEndCall,
	onSendMessage,
	onDisconnect,
} = require('./handlers');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	transports: ['websocket'],
});

const port = process.env.PORT || 5000;

// Create a socket connection
io.on('connection', (socket) => {
	// New player connects to socket
	console.log(`new connection: ${socket.id}`);

	// Emit all current games and data
	sendUpdateGamesList(io);

	// Player creates game
	socket.on('create-game', onCreateGame(io, socket));

	// Player joins game from lobby
	socket.on('join-game', onJoinGame(io, socket));

	// Player moves piece
	socket.on('move-piece', onMovePiece(io, socket));

	// Reset game
	socket.on('reset-game', onResetGame(io, socket));

	// Play again
	socket.on('play-again', onPlayAgain(io, socket));

	// Cancel play again
	socket.on('cancel-play-again', onCancelPlayAgain(io, socket));

	// Player leaves game
	socket.on('leave-game', onLeaveGame(io, socket));

	// Connect to video chat
	socket.on('make-call', onMakeCall(socket));

	socket.on('call-user', onCallUser(socket));

	socket.on('accept-call', onAcceptCall(socket));

	socket.on('cancel-call', onCancelCall(socket));

	socket.on('end-call', onEndCall(socket));

	// Send a chat message
	socket.on('send-message', onSendMessage(io, socket));

	// Player disconnects from the website
	socket.on('disconnect', onDisconnect(io, socket));
});

server.listen(port, () => console.log(`Server listening on port ${port}...`));
