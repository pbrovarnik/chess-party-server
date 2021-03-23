const games = [];

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

module.exports = {
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
};
