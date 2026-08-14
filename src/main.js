import './styles.css';
import './polish.css';
import './progression.css';
import './ux-polish.css';
import { DeedzEngine } from './engine/DeedzEngine.js';
import { GooseGame } from './games/deedz-the-goose/GooseGame.js';

async function bootstrap() {
  const game = new GooseGame();
  const engine = new DeedzEngine(game.createConfig());
  window.__DEEDZ_ENGINE__ = engine;

  const persistBeforeExit = () => engine.save?.persist?.();
  window.addEventListener('beforeunload', persistBeforeExit);

  try {
    await engine.initialize(game);
    await engine.start();
  } catch (error) {
    console.error('[Deedz Engine] Fatal startup error', error);
    const root = document.querySelector('#ui-root');
    if (root) root.innerHTML = `
      <div class="deedz-screen">
        <section class="deedz-panel">
          <div class="deedz-kicker">STARTUP FAILURE</div>
          <h1 class="deedz-title">ENGINE<br>FAULT</h1>
          <p class="deedz-subtitle">Deedz Engine could not start.</p>
          <pre class="deedz-error">${escapeHtml(String(error?.stack ?? error))}</pre>
        </section>
      </div>`;
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(async () => {
      window.removeEventListener('beforeunload', persistBeforeExit);
      await engine.shutdown();
    });
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

bootstrap();
