const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: CLIENT_URL,
		methods: ['GET', 'POST'],
	},
});
const port = process.env.PORT || 5000;

const games = [];

// Create a socket connection
io.on('connection', (socket) => {
	// New player connects to socket
	console.log(`new connection: ${socket.id}`);

	// Emit all current games and data
	socket.emit('games', getSanitizedGames());

	// Player creates game
	socket.on('create-game', (gameName, gameId) => {
		socket.join(gameId);
		console.log(`user id: ${socket.id} joined game: ${gameId}`);
		socket.gameId = gameId;

		createGame({ player: socket, gameName, gameId });
		updateGame(io, socket);
		io.emit('games', getSanitizedGames());
	});

	// Player joins game from lobby
	socket.on('join-game', (gameId) => {
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

		io.emit('games', getSanitizedGames());
	});

	// Player moves piece
	socket.on('move-piece', (move) => {
		movePiece({ gameId: socket.gameId, move });
		updateGame(io, socket);
	});

	// Reset game
	socket.on('reset-game', () => {
		setResetGame(socket.gameId);
		updateGame(io, socket);
		setResetGame(socket.gameId);
	});

	// Play again
	socket.on('play-again', () => {
		setPlayAgain(socket.gameId);
		updateGame(io, socket);
	});

	// Cancel play again
	socket.on('cancel-play-again', () => {
		setPlayAgain(socket.gameId);
		updateGame(io, socket);
	});

	// Player leaves game
	socket.on('leave-game', () => {
		console.log(`user id: ${socket.id} leaving game: ${socket.gameId}`);
		endGame(socket);
		socket.leave(socket.gameId);
		socket.gameId = null;
		io.emit('games', getSanitizedGames());
	});

	// Connect to video chat
	socket.on('make-call', () => {
		socket.to(socket.gameId).broadcast.emit('making-call');
	});

	socket.on('call-user', (signalData) => {
		socket.to(socket.gameId).broadcast.emit('user-called', signalData);
	});

	socket.on('accept-call', (signalData) => {
		socket.to(socket.gameId).broadcast.emit('call-accepted', signalData);
	});

	socket.on('cancel-call', () => {
		socket.to(socket.gameId).broadcast.emit('call-cancelled');
	});

	socket.on('end-call', () => {
		socket.to(socket.gameId).broadcast.emit('call-ended');
	});

	// Send a chat message
	socket.on('send-message', (msg) => {
		updateChat(io, socket, msg);
	});

	// Player disconnects from the website
	socket.on('disconnect', () => {
		console.log(`Disconnected: ${socket.id}`);
		endGame(socket);
		io.emit('games', getSanitizedGames());
	});
});

// Creates initial game data
const createGame = ({ player, gameName, gameId }) => {
	const game = {
		gameName,
		turn: 'white',
		players: [
			{
				color: 'white',
				socket: player,
			},
		],
		chat: [{ player: 'admin', text: 'Welcome to the game!' }],
		id: gameId,
		playAgain: false,
		resetGame: false,
	};
	games.push(game);
	return game;
};

// Return all current games without socket info
const getSanitizedGames = () =>
	games.map(({ players, ...game }) => ({
		...game,
		numberOfPlayers: players.length,
	}));

// Return current game without socket info
const sanitizedGame = ({ players, ...game }) => {
	const sanitizedplayers = players.map(({ color, socket }) => ({
		color,
		id: socket.id,
	}));

	return { ...game, players: sanitizedplayers, numberOfPlayers: players.length };
};

const getGameById = (gameId) => games.find((game) => game.id === gameId);

const addPlayerToGame = ({ player, gameId }) => {
	const game = getGameById(gameId);

	game.players.push({
		color: 'black',
		socket: player,
	});
};

const updateGame = (io, socket) => {
	const game = sanitizedGame(getGameById(socket.gameId));
	io.sockets.in(socket.gameId).emit('game-updated', game);
};

const updateChat = (io, socket, msg) => {
	const game = sanitizedGame(getGameById(socket.gameId));
	const { color } = game.players.find((player) => player.id === socket.id);
	game.chat.push({ player: color, text: msg });
	io.sockets.in(socket.gameId).emit('chat-updated', game.chat);
};

const movePiece = ({ gameId, move }) => {
	const game = getGameById(gameId);
	game.move = move;
	game.turn = game.turn === 'white' ? 'black' : 'white';
};

const setPlayAgain = (gameId) => {
	const game = getGameById(gameId);
	game.playAgain = !game.playAgain;
	return game;
};

const setResetGame = (gameId) => {
	const game = getGameById(gameId);
	game.resetGame = !game.resetGame;
	game.turn = 'white';
	game.playAgain = false;
	return game;
};

const endGame = (player) => {
	const game = getGameById(player.gameId);
	if (!game) return;
	games.splice(games.indexOf(game), 1);
	game.players.forEach((currentPlayer) => {
		if (player !== currentPlayer.socket) currentPlayer.socket.emit('end-game');
	});
};

server.listen(port, () => console.log(`Server listening on port ${port}...`));
