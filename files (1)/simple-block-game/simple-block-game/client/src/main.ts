import { Game } from './game/Game';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const nameInput = $('name') as HTMLInputElement;
const menu = $('menu');
const error = $('error');

const game = new Game($('game') as HTMLCanvasElement, {
  name: $('hud-name'),
  status: $('hud-status'),
  pause: $('pause'),
});

async function play() {
  const name = nameInput.value.trim() || 'Player';
  error.textContent = '';
  menu.style.display = 'none';
  game.lockPointer(); // must happen inside the click handler
  try {
    await game.join(name);
  } catch (e) {
    menu.style.display = 'flex';
    error.textContent = e instanceof Error ? e.message : 'Could not join';
  }
}

$('play').addEventListener('click', play);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') play();
});
nameInput.focus();
