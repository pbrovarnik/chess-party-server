const {
	createGame,
	getSanitizedGames,
	getGameById,
	addPlayerToGame,
	updateGame,
	updateChat,
	movePiece,
	setPlayAgain,
	setResetGame,
	endGame,
} = require('./game');

// Emit all current games and data
const sendUpdateGamesList = (io) => {
	io.emit('games', getSanitizedGames());
};

// Broadcast event to room
const broadcastMessageToRoom = ({ socket, emitterEvent, signalData = {} }) =>
	socket.to(socket.gameId).broadcast.emit(emitterEvent, signalData);

// Player creates game
const onCreateGame = (io, socket) => (gameName, gameId) => {
	socket.join(gameId);
	console.log(`user id: ${socket.id} joined game: ${gameId}`);
	socket.gameId = gameId;

	createGame({ player: socket, gameName, gameId });
	updateGame(io, socket);
	sendUpdateGamesList(io);
};

// Player joins game from lobby
const onJoinGame = (io, socket) => (gameId) => {
	socket.join(gameId);
	console.log(`user id: ${socket.id} joined game: ${gameId}`);
	socket.gameId = gameId;

	const game = getGameById(gameId);
	if (game.players.length >= 2) return;

	addPlayerToGame({
		player: socket,
		gameId,
	});

	updateGame(io, socket);
	io.sockets.in(socket.gameId).emit('chat-updated', game.chat);

	sendUpdateGamesList(io);
};

// Player moves piece
const onMovePiece = (io, socket) => (move) => {
	movePiece({ gameId: socket.gameId, move });
	updateGame(io, socket);
};

// Reset game
const onResetGame = (io, socket) => () => {
	setResetGame(socket.gameId);
	updateGame(io, socket);
	setResetGame(socket.gameId);
};

// Play again
const onPlayAgain = (io, socket) => () => {
	setPlayAgain(socket.gameId);
	updateGame(io, socket);
};

// Cancel play again
const onCancelPlayAgain = (io, socket) => () => {
	setPlayAgain(socket.gameId);
	updateGame(io, socket);
};

// Player leaves game
const onLeaveGame = (io, socket) => () => {
	console.log(`user id: ${socket.id} leaving game: ${socket.gameId}`);
	endGame(socket);
	socket.leave(socket.gameId);
	socket.gameId = null;
	sendUpdateGamesList(io);
};

// Connect to video chat
const onMakeCall = (socket) => () => {
	broadcastMessageToRoom({ socket, emitterEvent: 'making-call' });
};

// Call opponent
const onCallUser = (socket) => (signalData) => {
	broadcastMessageToRoom({ socket, emitterEvent: 'user-called', signalData });
};

// Answer call
const onAcceptCall = (socket) => (signalData) => {
	broadcastMessageToRoom({ socket, emitterEvent: 'call-accepted', signalData });
};

// Cancel call thats being made
const onCancelCall = (socket) => () => {
	broadcastMessageToRoom({ socket, emitterEvent: 'call-cancelled' });
};

// End call
const onEndCall = (socket) => () => {
	broadcastMessageToRoom({ socket, emitterEvent: 'call-ended' });
};

// Send a chat message
const onSendMessage = (io, socket) => (msg) => {
	updateChat(io, socket, msg);
};

// Player disconnects from the website
const onDisconnect = (io, socket) => () => {
	console.log(`Disconnected: ${socket.id}`);
	endGame(socket);
	sendUpdateGamesList(io);
};

module.exports = {
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
};
