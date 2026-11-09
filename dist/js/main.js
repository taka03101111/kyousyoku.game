(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const game = new CryptoGame.Game(CRYPTO_QUESTIONS);
  const letters = ['A', 'B', 'C', 'D'];
  const levels = { basic: 'BASIC / 基礎', normal: 'STANDARD / 標準', hard: 'EXPERT / 難問' };
  let frame = null, starting = false, sound = false, lastSecond = 20;
  function stopLoop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
  function showScreen(name) {
    ['title', 'battle', 'result'].forEach(screen => { $(`${screen}-screen`).hidden = screen !== name; });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function renderTime() {
    const seconds = Math.ceil(game.remaining / 1000), ratio = game.remaining / CryptoGame.QUESTION_MS;
    $('timer-value').textContent = String(seconds).padStart(2, '0');
    $('timer').setAttribute('aria-label', `残り${seconds}秒`);
    $('timer').classList.toggle('urgent', seconds <= 5);
    $('time-bar').style.transform = `scaleX(${ratio})`;
    $('time-bar').classList.toggle('urgent', seconds <= 5);
    $('timer-ring').style.strokeDashoffset = String(176 * (1 - ratio));
    if (seconds <= 5 && seconds > 0 && seconds !== lastSecond) Effects.tone('tick');
    lastSecond = seconds;
  }
  function loop() {
    frame = null;
    const answer = game.tick(); renderTime();
    if (answer) { showFeedback(answer); return; }
    if (game.phase === 'playing' && !game.paused) frame = requestAnimationFrame(loop);
  }
  function startLoop() { stopLoop(); frame = requestAnimationFrame(loop); }
  function renderProgress() {
    $('score').textContent = game.score; $('gauge-score').textContent = game.gauge;
    $('defeat-gauge').setAttribute('aria-valuenow', game.gauge);
    [...$('defeat-gauge').children].forEach((node, i) => node.classList.toggle('filled', i < game.gauge));
    $('gauge-hint').textContent = game.gauge === 8 ? '討伐圏内！ 最後まで挑戦しよう' : `あと${8 - game.gauge}正解で討伐圏内`;
    $('enemy-state').textContent = game.gauge >= 8 ? 'CRITICAL' : game.gauge >= 6 ? 'WEAKENED' : 'ACTIVE';
    $('oni').classList.toggle('weakened', game.gauge >= 6);
    const dots = CRYPTO_QUESTIONS.map((q, i) => {
      const dot = document.createElement('span'), a = game.answers[i];
      dot.textContent = String(i + 1).padStart(2, '0');
      dot.className = a ? (a.correct ? 'correct' : 'wrong') : i === game.index ? 'current' : '';
      dot.setAttribute('aria-label', `第${i + 1}問：${a ? a.correct ? '正解' : a.timedOut ? '時間切れ' : '不正解' : i === game.index ? '回答中' : '未回答'}`);
      return dot;
    });
    $('question-dots').replaceChildren(...dots);
  }
  function renderQuestion() {
    stopLoop();
    const q = CRYPTO_QUESTIONS[game.index];
    $('round-number').textContent = String(q.id).padStart(2, '0');
    $('question-label').textContent = `${q.id === 10 ? 'FINAL ' : ''}QUESTION ${String(q.id).padStart(2, '0')}`;
    $('difficulty').textContent = levels[q.difficulty]; $('difficulty').dataset.level = q.difficulty;
    $('topic').textContent = q.topic; $('question-heading').textContent = q.question;
    $('question-heading').classList.toggle('long-question', q.question.length > 100);
    $('feedback').hidden = true; $('answer-hint').hidden = false; $('pause-overlay').hidden = true;
    $('battle-screen').classList.toggle('final-round', q.id === 10);
    $('oni').dataset.state = 'asking';
    $('enemy-quote').textContent = q.id === 10 ? '「最後の問いだ。その鍵、本物かな？」' : q.difficulty === 'hard' ? '「ここからは、知識を使いこなせるかだ。」' : game.score >= 6 ? '「くっ……なかなかやるではないか。」' : '「さあ、君の知識を見せてもらおう。」';
    const buttons = q.options.map((option, i) => {
      const button = document.createElement('button'); button.className = 'answer-button';
      button.style.setProperty('--order', i); button.dataset.choice = i;
      const letter = document.createElement('span'); letter.className = 'answer-letter'; letter.textContent = letters[i];
      const text = document.createElement('span'); text.className = 'answer-copy'; text.textContent = option;
      const status = document.createElement('span'); status.className = 'answer-status';
      button.append(letter, text, status); button.addEventListener('click', () => answerQuestion(i));
      return button;
    });
    $('options').replaceChildren(...buttons);
    lastSecond = 20; renderProgress(); renderTime();
    $('question-heading').focus({ preventScroll: true });
    if (document.hidden) { game.pause(); $('pause-overlay').hidden = false; } else startLoop();
  }
  function begin() {
    if (starting) return;
    starting = true; stopLoop(); Effects.clear(); game.reset();
    $('rules-dialog').close(); $('review-list').hidden = true; $('review-button').setAttribute('aria-expanded', 'false');
    $('result-oni').className = ''; $('oni').className = 'oni'; $('oni').dataset.state = 'idle';
    $('start-button').disabled = true; $('retry-button').disabled = true;
    Effects.announce('BATTLE START', 750); Effects.tone('correct');
    Effects.delay(() => {
      starting = false; $('start-button').disabled = false; $('retry-button').disabled = false;
      game.start(); showScreen('battle'); renderQuestion();
    }, Effects.reduced.matches ? 350 : 800);
  }
  function answerQuestion(choice) {
    if (starting || document.hidden) return;
    const answer = game.answer(choice);
    if (answer) showFeedback(answer);
  }
  function showFeedback(answer) {
    stopLoop(); renderTime(); renderProgress();
    const q = CRYPTO_QUESTIONS[game.index];
    [...$('options').children].forEach((button, i) => {
      button.disabled = true;
      if (i === q.correctIndex) { button.classList.add('correct'); button.querySelector('.answer-status').textContent = '✓ 正解'; }
      else if (i === answer.choice) { button.classList.add('wrong'); button.querySelector('.answer-status').textContent = '× 選択'; }
      else button.classList.add('muted');
    });
    $('answer-hint').hidden = true; $('feedback').hidden = false;
    $('feedback').className = `feedback ${answer.correct ? 'is-correct' : 'is-wrong'}`;
    $('feedback-title').textContent = answer.correct ? '✓ 正解！' : answer.timedOut ? '◷ 時間切れ！' : '× 不正解！';
    $('feedback-english').textContent = answer.correct ? 'CORRECT / DAMAGE +1' : answer.timedOut ? 'TIME UP' : 'WRONG / ATTACK MISSED';
    $('explanation').textContent = q.explanation;
    $('next-button').textContent = game.index === 9 ? '結果を見る →' : '次の問題へ →';
    $('oni').dataset.state = answer.correct ? game.score === 8 ? 'stagger' : 'damage' : 'dodge';
    $('enemy-quote').textContent = answer.correct ? game.score === 8 ? '「暗号障壁が……！ だが、まだ終わりではない。」' : '「ぐっ……見事な解読だ。」' : answer.timedOut ? '「時間もまた、攻略すべき壁なのだ。」' : '「ふふっ。解説を読み、次に備えるがいい。」';
    Effects.tone(answer.correct ? 'correct' : 'wrong');
    $('next-button').focus({ preventScroll: true });
  }
  function showResult() {
    stopLoop(); Effects.clear(); showScreen('result');
    const won = game.won;
    $('result-screen').classList.toggle('victory', won); $('result-screen').classList.toggle('defeat', !won);
    $('result-eyebrow').textContent = won ? 'MISSION COMPLETE / 暗号領域、解放。' : 'MISSION FAILED / 再挑戦の、その先へ。';
    $('result-english').textContent = won ? 'VICTORY' : 'DEFEAT';
    $('result-title').textContent = won ? '討伐成功！' : '討伐失敗！';
    $('final-score').textContent = game.score;
    $('result-message').textContent = won ? game.score === 10 ? '完全解読。君の知識が、すべての暗号を打ち破った。' : '君の知識がサイファの暗号障壁を打ち破った。' : `あと${8 - game.score}問の正解で討伐成功。解説を味方に、もう一度挑もう。`;
    $('result-oni').className = won ? 'fallen' : 'triumphant';
    $('result-badges').replaceChildren(...game.answers.map((answer, i) => {
      const badge = document.createElement('span'); badge.className = answer.correct ? 'correct' : 'wrong';
      badge.textContent = `${String(i + 1).padStart(2, '0')} ${answer.correct ? '✓' : '×'}`;
      badge.setAttribute('aria-label', `第${i + 1}問 ${answer.correct ? '正解' : answer.timedOut ? '時間切れ' : '不正解'}`); return badge;
    }));
    renderReview(); $('result-title').focus({ preventScroll: true });
    if (won) { Effects.tone('win'); Effects.particles(); } else Effects.tone('wrong');
  }
  function renderReview() {
    $('review-list').replaceChildren();
    const heading = document.createElement('h2'); heading.textContent = '解読ログ / 全10問の振り返り'; $('review-list').append(heading);
    CRYPTO_QUESTIONS.forEach((q, i) => {
      const answer = game.answers[i], detail = document.createElement('details'), summary = document.createElement('summary');
      const label = document.createElement('span'); label.className = answer.correct ? 'review-correct' : 'review-wrong'; label.textContent = `${answer.correct ? '✓' : '×'} Q${String(q.id).padStart(2, '0')}`;
      const title = document.createElement('span'); title.textContent = `${q.topic} / ${answer.timedOut ? '時間切れ' : answer.correct ? '正解' : '不正解'}`;
      summary.append(label, title); const question = document.createElement('h3'); question.textContent = q.question;
      const choice = document.createElement('p'); choice.textContent = `あなたの回答：${answer.choice === null ? '時間切れ（未回答）' : letters[answer.choice] + '. ' + q.options[answer.choice]}`;
      const correct = document.createElement('p'); correct.className = 'review-correct'; correct.textContent = `正解：${letters[q.correctIndex]}. ${q.options[q.correctIndex]}`;
      const explanation = document.createElement('p'); explanation.textContent = q.explanation;
      detail.append(summary, question, choice, correct, explanation); $('review-list').append(detail);
    });
  }
  $('start-button').addEventListener('click', begin); $('retry-button').addEventListener('click', begin); $('rules-start').addEventListener('click', begin);
  $('rules-button').addEventListener('click', () => $('rules-dialog').showModal());
  $('rules-close').addEventListener('click', () => $('rules-dialog').close());
  $('rules-dialog').addEventListener('click', e => { if (e.target === $('rules-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
  $('next-button').addEventListener('click', () => { if (game.next()) { Effects.clear(); if (game.phase === 'result') showResult(); else renderQuestion(); } });
  $('review-button').addEventListener('click', () => { const visible = $('review-list').hidden; $('review-list').hidden = !visible; $('review-button').setAttribute('aria-expanded', String(visible)); if (visible) $('review-list').scrollIntoView({ behavior: Effects.reduced.matches ? 'instant' : 'smooth', block: 'start' }); });
  $('home-button').addEventListener('click', () => { stopLoop(); Effects.clear(); game.reset(); showScreen('title'); $('start-button').focus({ preventScroll: true }); });
  $('sound-toggle').addEventListener('click', () => { sound = !sound; Effects.setSound(sound); $('sound-toggle').setAttribute('aria-pressed', String(sound)); $('sound-toggle').setAttribute('aria-label', `効果音を${sound ? 'オフ' : 'オン'}にする`); $('sound-toggle').querySelector('span').textContent = `音声 ${sound ? 'ON' : 'OFF'}`; });
  $('fullscreen-toggle').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else Effects.announce('このブラウザは全画面表示に対応していません', 2400); }
    catch { Effects.announce('全画面に切り替えられませんでした', 2400); }
  });
  document.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || game.phase !== 'playing' || starting || $('rules-dialog').open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const key = e.key.toUpperCase(); const choice = /^[1-4]$/.test(key) ? Number(key) - 1 : letters.indexOf(key);
    if (choice >= 0) { e.preventDefault(); answerQuestion(choice); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopLoop(); const answer = game.pause(); if (answer) showFeedback(answer); $('pause-overlay').hidden = !game.paused; }
    else { game.resume(); $('pause-overlay').hidden = true; if (game.phase === 'playing') startLoop(); }
  });
  window.addEventListener('pagehide', stopLoop);
  window.addEventListener('pageshow', () => { if (game.phase === 'playing' && !document.hidden) { game.resume(); startLoop(); } });
})();
