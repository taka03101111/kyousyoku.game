'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const questions = require('../js/questions.js');
const { Game, QUESTION_MS } = require('../js/engine.js');
const root = path.resolve(__dirname, '..');
function setup() {
  let now = 0;
  const game = new Game(questions, () => now);
  return { game, advance: ms => { now += ms; } };
}
test('10 fixed questions, four distinct options, required answer key and levels', () => {
  assert.equal(questions.length, 10);
  assert.deepEqual(questions.map(q => q.id), [1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(questions.map(q => q.correctIndex), [0,2,1,3,0,2,1,3,2,0]);
  assert.deepEqual(questions.map(q => q.difficulty), ['basic','basic','basic','basic','normal','normal','normal','normal','hard','hard']);
  for (const q of questions) {
    assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
    assert.ok(q.topic && q.question && q.explanation);
  }
});
test('only the designated option scores for each question', () => {
  for (let i = 0; i < 10; i++) for (let choice = 0; choice < 4; choice++) {
    const game = new Game([questions[i]], () => 0); game.start();
    const answer = game.answer(choice);
    assert.equal(answer.correct, choice === questions[i].correctIndex);
    assert.equal(game.score, choice === questions[i].correctIndex ? 1 : 0);
  }
});
test('start, sequential progression, no next before answering, no double answer', () => {
  const { game } = setup(); assert.equal(game.phase, 'title');
  assert.equal(game.answer(0), null); game.start(); assert.equal(game.remaining, 20000);
  for (let i = 0; i < 10; i++) {
    assert.equal(game.index, i); assert.equal(game.phase, 'playing');
    assert.equal(game.next(), false);
    assert.equal(game.answer(questions[i].correctIndex).correct, true);
    assert.equal(game.answer(questions[i].correctIndex), null);
    assert.equal(game.score, i + 1); assert.equal(game.answers.length, i + 1);
    assert.equal(game.phase, 'feedback'); assert.equal(game.won, false);
    assert.ok(game.gauge <= 8); game.next();
  }
  assert.equal(game.phase, 'result'); assert.equal(game.score, 10); assert.equal(game.gauge, 8); assert.equal(game.won, true);
  assert.equal(game.next(), false); assert.equal(game.answer(0), null);
});
for (let score = 0; score <= 10; score++) test(`final score ${score}: ${score >= 8 ? 'victory' : 'defeat'} only after all ten`, () => {
  const { game } = setup(); game.start();
  questions.forEach((q, index) => {
    const choice = index < score ? q.correctIndex : (q.correctIndex + 1) % 4;
    game.answer(choice); assert.equal(game.won, false);
    if (index < 9) assert.equal(game.phase, 'feedback');
    game.next();
  });
  assert.equal(game.answers.length, 10); assert.equal(game.score, score);
  assert.equal(game.won, score >= 8); assert.equal(game.gauge, Math.min(score, 8));
});
test('20-second deadline, exact-boundary answer becomes timeout, late frames cannot add points', () => {
  const { game, advance } = setup(); game.start(); advance(19999);
  assert.equal(game.tick(), null); assert.equal(game.remaining, 1);
  advance(1); const answer = game.answer(0);
  assert.equal(answer.timedOut, true); assert.equal(answer.choice, null);
  assert.equal(game.score, 0); assert.equal(game.remaining, 0); assert.equal(game.phase, 'feedback');
  advance(50000); assert.equal(game.tick(), null); assert.equal(game.answers.length, 1);
});
test('delayed frame produces exactly one timeout', () => {
  const { game, advance } = setup(); game.start(); advance(22000);
  assert.equal(game.tick().timedOut, true); assert.equal(game.tick(), null);
  assert.equal(game.answer(0), null); assert.equal(game.answers.length, 1);
});
test('feedback freezes remaining time; next question starts a fresh 20 seconds', () => {
  const { game, advance } = setup(); game.start(); advance(6000); game.answer(0);
  assert.equal(game.remaining, 14000); advance(90000); game.tick(); assert.equal(game.remaining, 14000);
  game.next(); assert.equal(game.remaining, QUESTION_MS); advance(15000); game.tick(); assert.equal(game.remaining, 5000);
});
test('hidden tab freezes time, ignores input, preserves remaining time over repeated pauses', () => {
  const { game, advance } = setup(); game.start(); advance(4500); game.pause(); game.pause();
  assert.equal(game.remaining, 15500); assert.equal(game.paused, true); assert.equal(game.answer(0), null);
  advance(120000); assert.equal(game.tick(), null); assert.equal(game.remaining, 15500);
  game.resume(); game.resume(); advance(1000); game.pause(); assert.equal(game.remaining, 14500);
  advance(10000); game.resume(); advance(14499); assert.equal(game.tick(), null);
  advance(1); assert.equal(game.tick().timedOut, true);
});
test('hiding at the deadline still produces timeout', () => {
  const { game, advance } = setup(); game.start(); advance(20000);
  assert.equal(game.pause().timedOut, true); assert.equal(game.paused, false);
});
test('retry resets score, question, answers, paused state and timer after completed run', () => {
  const { game, advance } = setup(); game.start();
  questions.forEach(q => { game.answer(q.correctIndex); game.next(); });
  advance(90000); game.start(); assert.equal(game.phase, 'playing'); assert.equal(game.index, 0);
  assert.equal(game.score, 0); assert.equal(game.gauge, 0); assert.deepEqual(game.answers, []);
  assert.equal(game.remaining, 20000); assert.equal(game.paused, false); assert.equal(game.won, false);
});
test('invalid input never locks question or changes score', () => {
  const { game } = setup(); game.start();
  for (const value of [-1, 4, 0.5, '0', null, NaN]) assert.equal(game.answer(value), null);
  assert.equal(game.phase, 'playing'); assert.equal(game.score, 0);
});
test('HTML assets exist and use relative URLs for GitHub Pages and offline file launch', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const paths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
  assert.ok(paths.length > 5);
  for (const asset of paths) { assert.ok(asset.startsWith('./')); assert.ok(fs.existsSync(path.join(root, asset))); }
  assert.ok(!html.includes('type="module"'), 'Classic scripts also work with file://');
});
