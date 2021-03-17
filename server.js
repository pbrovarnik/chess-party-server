const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

require('dotenv').config({ path: __dirname + '/.env' });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: process.env.CLIENT_URL,
		methods: ['GET', 'POST'],
	},
});
const port = process.env.PORT || 5000;

const games = [];
let nextGameId = 0;

// Create a socket connection
io.on('connection', (socket) => {
	// New player connects to socket
	console.log(`new connection: ${socket.id}`);

	// Emit all current games and data
	socket.emit('games', getGames());

	// Player creates game
	socket.on('create-game', (gameName) => {
		const game = createGame({ player: socket, gameName });
		io.emit('games', getGames());
		socket.emit('your-game-created', game.id);
		socket.emit('color', 'white');
	});

	// Player joins game from lobby
	socket.on('join-game', (gameId) => {
		const game = getGameById(gameId);
		if (game.numberOfPlayers < 2) {
			const color = addPlayerToGame({
				player: socket,
				gameId,
			});
			io.emit('games', getGames());
			socket.emit('color', color);
		}
		// TODO: try socket.broadcast.emit instead of io.emit
		io.emit('games', getGames());
	});

	// Player moves piece
	socket.on('move-piece', (move) => {
		movePiece({ player: socket, move });
		io.emit('games', getGames());
	});

	// Reset game
	socket.on('reset-game', (gameId) => {
		setResetGame(gameId);
		io.emit('games', getGames());
		setResetGame(gameId);
	});

	// Play again
	socket.on('play-again', (gameId) => {
		setPlayAgain(gameId);
		io.emit('games', getGames());
	});

	// Cancel play again
	socket.on('cancel-play-again', (gameId) => {
		setPlayAgain(gameId);
		io.emit('games', getGames());
	});

	// Player leaves game
	socket.on('leave-game', () => {
		endGame(socket);
		io.emit('games', getGames());
	});

	// Player disconnects from the website
	socket.on('disconnect', () => {
		console.log(`Disconnected: ${socket.id}`);
		endGame(socket);
		io.emit('games', getGames());
	});
});

function createGame({ player, gameName }) {
	const game = {
		gameName,
		turn: 'white',
		players: [
			{
				socket: player,
				color: 'white',
			},
		],
		chat: [],
		id: nextGameId++,
		playAgain: false,
		resetGame: false,
	};
	games.push(game);
	return game;
}

function getGames() {
	return games.map((g) => {
		const { players, ...game } = g;
		return {
			...game,
			numberOfPlayers: players.length,
		};
	});
}

function getGameById(gameId) {
	return getGames().find((g) => g.id === gameId);
}

function addPlayerToGame({ player, gameId }) {
	const game = games.find((g) => g.id === gameId);

	game.players.push({
		color: 'black',
		socket: player,
	});

	return 'black';
}

const getGameForPlayer = (player) =>
	games.find((g) => g.players.find((p) => p.socket === player));

const movePiece = ({ player, move }) => {
	const game = getGameForPlayer(player);
	game.move = move;
	game.turn = game.turn === 'white' ? 'black' : 'white';
};

const setPlayAgain = (gameId) => {
	const game = games.find((g) => g.id === gameId);
	game.playAgain = !game.playAgain;
	return game;
};

const setResetGame = (gameId) => {
	const game = games.find((g) => g.id === gameId);
	game.resetGame = !game.resetGame;
	game.turn = 'white';
	game.playAgain = false;
	return game;
};

const endGame = (player) => {
	const game = getGameForPlayer(player);
	if (!game) return;
	games.splice(games.indexOf(game), 1);
	game.players.forEach((currentPlayer) => {
		if (player !== currentPlayer.socket) currentPlayer.socket.emit('end-game');
	});
};

server.listen(port, () => console.log(`Server listening on port ${port}...`));
