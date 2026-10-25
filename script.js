const menuToggle = document.querySelector('#menuToggle');
const mainNav = document.querySelector('#mainNav');

menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

const filterButtons = document.querySelectorAll('.filter');
const gameCards = document.querySelectorAll('.game-card');
const emptyState = document.querySelector('#emptyState');
filterButtons.forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  filterButtons.forEach(item => item.classList.toggle('active', item === button));
  let count = 0;
  gameCards.forEach(card => {
    const visible = filter === 'all' || card.dataset.category === filter;
    card.hidden = !visible;
    if (visible) count++;
  });
  emptyState.hidden = count > 0;
}));

const gameDialog = document.querySelector('#gameDialog');
document.querySelectorAll('.details-button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#dialogTitle').textContent = button.dataset.title;
  document.querySelector('#dialogDescription').textContent = button.dataset.description;
  gameDialog.showModal();
}));
const closeDialog = () => gameDialog.close();
document.querySelector('#dialogClose').addEventListener('click', closeDialog);
document.querySelector('#dialogOkay').addEventListener('click', closeDialog);
gameDialog.addEventListener('click', event => { if (event.target === gameDialog) closeDialog(); });
document.querySelector('#year').textContent = new Date().getFullYear();

// Online leaderboard uses Supabase. Set the URL and public anon/publishable key in config.js.
const scoreKey = 'pixelquest-global-demo-v1';
const currentScore = document.querySelector('#currentScore');
const challengeMessage = document.querySelector('#challengeMessage');
const playChallenge = document.querySelector('#playChallenge');
const scoreForm = document.querySelector('#scoreForm');
const playerName = document.querySelector('#playerName');
const leaderboardList = document.querySelector('#leaderboardList');
const emptyLeaderboard = document.querySelector('#emptyLeaderboard');
const clearScores = document.querySelector('#clearScores');
let score = 0;
let challengeActive = false;
let taps = 0;
let remaining = 10;
let challengeTimer = null;
let client = null;

function setupClient() {
  const url = window.PIXELQUEST_SUPABASE_URL;
  const key = window.PIXELQUEST_SUPABASE_ANON_KEY;
  if (!window.supabase || !url || !key ||
      url.includes('PASTE_YOUR_') || key.includes('PASTE_YOUR_')) {
    return null;
  }
  try { return window.supabase.createClient(url, key); }
  catch (error) { console.error(error); return null; }
}

async function renderLeaderboard() {
  leaderboardList.replaceChildren();
  if (!client) {
    emptyLeaderboard.hidden = false;
    emptyLeaderboard.textContent = 'Online leaderboard not connected yet. Add your Supabase URL and public key in config.js.';
    return;
  }
  emptyLeaderboard.hidden = false;
  emptyLeaderboard.textContent = 'Loading worldwide scores…';
  try {
    const { data, error } = await client
      .from('leaderboard')
      .select('player_name, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);
    if (error) throw error;
    emptyLeaderboard.hidden = data.length > 0;
    emptyLeaderboard.textContent = 'No scores yet. Play and add your score!';
    data.forEach((entry, index) => {
      const item = document.createElement('li');
      const player = document.createElement('div');
      player.className = 'rank-player';
      const rank = document.createElement('span');
      rank.className = 'rank-number';
      rank.textContent = String(index + 1);
      const name = document.createElement('span');
      name.className = 'rank-name';
      name.textContent = entry.player_name;
      const points = document.createElement('span');
      points.className = 'rank-score';
      points.textContent = `${entry.score} pts`;
      player.append(rank, name);
      item.append(player, points);
      leaderboardList.append(item);
    });
  } catch (error) {
    console.error(error);
    emptyLeaderboard.hidden = false;
    emptyLeaderboard.textContent = 'Could not load scores. Check your Supabase table and policies.';
  }
}

playChallenge.addEventListener('click', () => {
  if (challengeActive) {
    taps += 1;
    score = taps * 10;
    currentScore.textContent = String(score);
    return;
  }
  challengeActive = true;
  score = 0;
  taps = 0;
  remaining = 10;
  currentScore.textContent = '0';
  challengeMessage.textContent = 'Tap this button as many times as you can before the 10-second timer ends!';
  playChallenge.textContent = `Tap to score! (${remaining}s)`;
  challengeTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(challengeTimer);
      challengeActive = false;
      playChallenge.textContent = 'Play again ⚡';
      challengeMessage.textContent = `Time's up! You scored ${score} points. Enter your name to submit it to the global leaderboard.`;
    } else {
      playChallenge.textContent = `Tap to score! (${remaining}s)`;
    }
  }, 1000);
});

scoreForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = playerName.value.trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!name) { playerName.focus(); return; }
  if (score <= 0 || challengeActive) {
    challengeMessage.textContent = 'Finish a score challenge first, then submit your score.';
    return;
  }
  if (!client) {
    challengeMessage.textContent = 'Leaderboard is not connected yet. Follow SETUP.md to connect Supabase, then try again.';
    return;
  }
  const submitButton = scoreForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  challengeMessage.textContent = 'Submitting your score…';
  try {
    const { error } = await client.from('leaderboard').insert({
      player_name: name,
      score: score
    });
    if (error) throw error;
    challengeMessage.textContent = `Score submitted for ${name}!`;
    playerName.value = '';
    await renderLeaderboard();
  } catch (error) {
    console.error(error);
    challengeMessage.textContent = 'Score could not be submitted. Check your database setup and try again.';
  } finally {
    submitButton.disabled = false;
  }
});

// No public reset button: visitors should not be able to erase the shared leaderboard.
clearScores.hidden = true;
client = setupClient();
renderLeaderboard();
