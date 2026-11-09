(function (root) {
  'use strict';
  const QUESTION_MS = 20000;
  const WIN_SCORE = 8;
  class Game {
    constructor(questions, now = () => performance.now()) {
      this.questions = questions;
      this.now = now;
      this.reset();
    }
    reset() {
      this.phase = 'title'; this.index = 0; this.score = 0;
      this.answers = []; this.remaining = QUESTION_MS;
      this.deadline = null; this.paused = false;
    }
    start() { this.reset(); this.openQuestion(); }
    openQuestion() {
      this.phase = 'playing'; this.remaining = QUESTION_MS;
      this.deadline = this.now() + QUESTION_MS; this.paused = false;
    }
    tick() {
      if (this.phase !== 'playing' || this.paused) return null;
      this.remaining = Math.max(0, this.deadline - this.now());
      return this.remaining === 0 ? this.finishAnswer(null) : null;
    }
    answer(choice) {
      if (this.phase !== 'playing' || this.paused || !Number.isInteger(choice) || choice < 0 || choice > 3) return null;
      const timeout = this.tick();
      if (timeout) return timeout;
      return this.finishAnswer(choice);
    }
    finishAnswer(choice) {
      if (this.phase !== 'playing') return null;
      const question = this.questions[this.index];
      const answer = { id: question.id, choice, correct: choice === question.correctIndex, timedOut: choice === null, remaining: this.remaining };
      this.answers.push(answer);
      if (answer.correct) this.score++;
      this.phase = 'feedback'; this.deadline = null; this.paused = false;
      return answer;
    }
    next() {
      if (this.phase !== 'feedback') return false;
      if (this.index === this.questions.length - 1) this.phase = 'result';
      else { this.index++; this.openQuestion(); }
      return true;
    }
    pause() {
      if (this.phase !== 'playing' || this.paused) return null;
      const answer = this.tick();
      if (!answer) { this.paused = true; this.deadline = null; }
      return answer;
    }
    resume() {
      if (this.phase === 'playing' && this.paused) {
        this.paused = false; this.deadline = this.now() + this.remaining;
      }
    }
    get gauge() { return Math.min(WIN_SCORE, this.score); }
    get won() { return this.phase === 'result' && this.score >= WIN_SCORE; }
  }
  const api = { Game, QUESTION_MS, WIN_SCORE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CryptoGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
