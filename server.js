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

		const game = createGame({ player: socket, gameName, gameId });

		io.sockets.in(socket.gameId).emit('your-game-created', game.id);
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

		io.sockets.in(socket.gameId).emit('game-joined');
		io.emit('games', getSanitizedGames());
	});

	// Player moves piece
	socket.on('move-piece', (move) => {
		movePiece({ gameId: socket.gameId, move });
		io.emit('games', getSanitizedGames());
	});

	// Reset game
	socket.on('reset-game', () => {
		setResetGame(socket.gameId);
		io.emit('games', getSanitizedGames());
		setResetGame(socket.gameId);
	});

	// Play again
	socket.on('play-again', () => {
		setPlayAgain(socket.gameId);
		io.emit('games', getSanitizedGames());
	});

	// Cancel play again
	socket.on('cancel-play-again', () => {
		setPlayAgain(socket.gameId);
		io.emit('games', getSanitizedGames());
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
		chat: [],
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

const getGameById = (gameId) => games.find((game) => game.id === gameId);

const addPlayerToGame = ({ player, gameId }) => {
	const game = getGameById(gameId);

	game.players.push({
		color: 'black',
		socket: player,
	});
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
