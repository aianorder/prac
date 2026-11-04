/* Browser UI. No network requests or external dependencies. */
(() => {
  'use strict';
  const E = window.PracEngine;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const STORAGE_KEY = 'prac.session.v1';
  const MAX_ROWS = 12;
  const money = new Intl.NumberFormat('ja-JP');
  const levelLabels = { basic: '基礎', applied: '応用', all: '基礎 + 応用' };
  let set;
  let settings;
  let grades = new Map();
  let storageAvailable = true;
  let printDetails = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function option(value, text) {
    const node = el('option', '', text);
    node.value = value;
    return node;
  }
  function button(text, className, handler) {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }
  function problemSignature(problem) { return JSON.stringify([problem.templateId, problem.prompt, problem.entries]); }
  function categoryName(id) { return E.CATEGORIES.find(c => c.id === id)?.label || 'すべての取引'; }
  function hasInput() {
    return $$('.entry-row').some(row => $('.entry-account', row).value || $('.entry-amount', row).value);
  }
  function readDraft(card) {
    return $$('.entry-row', card).map(row => ({
      side: $('.entry-side', row).value,
      account: $('.entry-account', row).value,
      amount: $('.entry-amount', row).value
    }));
  }
  function normalizeDraft(draft) {
    return draft.map(entry => ({
      ...entry,
      amount: /^\d+$/.test(String(entry.amount).trim()) ? Number(entry.amount) : NaN
    }));
  }
  function status(message) { $('#save-status').textContent = message; }
  function persist() {
    if (!set || !storageAvailable) return;
    try {
      const cards = $$('.question');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, settings, seed: set.seed,
        signatures: set.problems.map(problemSignature),
        drafts: cards.map(readDraft),
        graded: cards.map((_, i) => grades.has(i)),
        revealed: cards.map(card => $('.solution', card).open)
      }));
      status('学習内容はこのブラウザーに自動保存されます。');
    } catch {
      storageAvailable = false;
      status('この環境では自動保存できません。画面を閉じると入力内容は失われます。CSV で保存できるのは問題と模範解答のみです。');
    }
  }
  function clearGrade(index, card) {
    grades.delete(index);
    const feedback = $('.feedback', card);
    feedback.textContent = '';
    feedback.className = 'feedback';
    $('#session-feedback').textContent = '';
    updateProgress();
    persist();
  }
  function entryRow(card, index, draft = { side: 'debit', account: '', amount: '' }) {
    const row = el('div', 'entry-row');
    const side = el('select', 'entry-side');
    side.append(option('debit', '借方'), option('credit', '貸方'));
    side.value = draft.side === 'credit' ? 'credit' : 'debit';
    side.setAttribute('aria-label', `第 ${index + 1} 問の借方・貸方`);
    const account = el('select', 'entry-account');
    account.append(option('', '勘定科目を選択'));
    E.ACCOUNTS.forEach(a => account.append(option(a, a)));
    account.value = E.ACCOUNTS.includes(draft.account) ? draft.account : '';
    account.setAttribute('aria-label', `第 ${index + 1} 問の勘定科目`);
    const amount = el('input', 'entry-amount');
    amount.type = 'text'; amount.inputMode = 'numeric'; amount.autocomplete = 'off';
    amount.placeholder = '金額（円）'; amount.maxLength = 16;
    amount.value = typeof draft.amount === 'string' || typeof draft.amount === 'number' ? String(draft.amount).slice(0,16) : '';
    amount.setAttribute('aria-label', `第 ${index + 1} 問の金額（半角整数）`);
    const remove = button('×', 'remove-row', () => {
      if ($$('.entry-row', card).length <= 2) return;
      const nextFocus = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      syncRowButtons(card);
      clearGrade(index, card);
      nextFocus?.querySelector('select')?.focus();
    });
    remove.setAttribute('aria-label', `第 ${index + 1} 問のこの行を削除`);
    [side, account, amount].forEach(input => input.addEventListener('input', () => clearGrade(index, card)));
    row.append(side, account, amount, remove);
    return row;
  }
  function syncRowButtons(card) {
    const length = $$('.entry-row', card).length;
    $$('.remove-row', card).forEach(node => { node.disabled = length <= 2; });
    $$('.add-row', card).forEach(node => { node.disabled = length >= MAX_ROWS; });
  }
  function updateProgress() {
    const correct = [...grades.values()].filter(result => result.correct).length;
    $('#progress-text').textContent = `採点済み ${grades.size} / ${set.problems.length} · 正解 ${correct} 問`;
  }
  function grade(index, announce = true) {
    const card = $$('.question')[index];
    const result = E.gradeAnswer(set.problems[index], normalizeDraft(readDraft(card)));
    grades.set(index, result);
    const feedback = $('.feedback', card);
    feedback.className = `feedback ${result.correct ? 'correct' : 'incorrect'}`;
    feedback.textContent = result.correct ? `✓ ${result.message}` : result.message;
    if (announce) { updateProgress(); persist(); }
    return result;
  }
  function syncSolutionButton() {
    const allOpen = $$('.solution').length > 0 && $$('.solution').every(node => node.open);
    $('#toggle-solutions').setAttribute('aria-expanded', String(allOpen));
    $('#toggle-solutions').textContent = allOpen ? 'すべての解答を隠す' : 'すべての解答';
  }
  function renderQuestion(problem, index, draft, revealed = false) {
    const card = el('article', 'question');
    card.setAttribute('aria-labelledby', `question-${index}`);
    const top = el('div', 'question-top');
    const number = el('span', 'question-number', 'Q.');
    number.append(el('b', '', String(index + 1).padStart(2, '0')));
    const tags = el('div', 'question-tags');
    tags.append(el('span', 'tag', categoryName(problem.category)), el('span', `tag ${problem.difficulty}`, levelLabels[problem.difficulty]));
    top.append(number, tags);
    const title = el('h3', '', problem.title); title.id = `question-${index}`;
    const inputs = el('div', 'inputs');
    const header = el('div', 'entries-header'); header.setAttribute('aria-hidden', 'true');
    ['借方 / 貸方', '勘定科目', '金額（円）', ''].forEach(label => header.append(el('span', '', label)));
    const rows = el('div', 'entries');
    const savedRows = Array.isArray(draft) && draft.length >= 2 && draft.length <= MAX_ROWS ? draft : [{side:'debit'},{side:'credit'}];
    savedRows.forEach(entry => rows.append(entryRow(card, index, entry || {})));
    const actions = el('div', 'answer-actions');
    for (const [side, text] of [['debit','＋ 借方を追加'],['credit','＋ 貸方を追加']]) {
      actions.append(button(text, 'add-row', () => {
        if ($$('.entry-row', card).length >= MAX_ROWS) return;
        const row = entryRow(card, index, {side}); rows.append(row);
        syncRowButtons(card); clearGrade(index, card); $('.entry-account', row).focus();
      }));
    }
    actions.append(button('採点する', 'button secondary small grade-one', () => grade(index)));
    const feedback = el('div', 'feedback'); feedback.setAttribute('role', 'status');
    inputs.append(header, rows, actions, feedback);
    const solution = el('details', 'solution'); solution.open = revealed;
    solution.append(el('summary', '', '解答と考え方を見る'));
    const content = el('div', 'solution-content');
    const table = el('table', 'solution-table');
    const caption = el('caption', '', `第 ${index + 1} 問の模範解答`); caption.hidden = true;
    const thead = el('thead'); const headingRow = el('tr');
    ['区分', '勘定科目', '金額（円）'].forEach(text => { const th = el('th','',text); th.scope = 'col'; headingRow.append(th); });
    thead.append(headingRow);
    const tbody = el('tbody');
    problem.entries.forEach(entry => {
      const tr = el('tr');
      [entry.side === 'debit' ? '借方' : '貸方', entry.account, money.format(entry.amount)].forEach(text => tr.append(el('td','',text)));
      tbody.append(tr);
    });
    table.append(caption, thead, tbody);
    content.append(table, el('p','explanation',problem.explanation)); solution.append(content);
    solution.addEventListener('toggle', () => { syncSolutionButton(); if (!printDetails) persist(); });
    const printLines = el('div', 'print-lines');
    const printHeader = el('div','print-line header'); printHeader.append(el('span','','借方（勘定科目 / 金額）'),el('span','','貸方（勘定科目 / 金額）')); printLines.append(printHeader);
    for(let i=0; i<3; i++){const line = el('div','print-line'); line.append(el('span'),el('span'));printLines.append(line);}
    card.append(top, title, el('p','prompt',problem.prompt), inputs, printLines, solution);
    syncRowButtons(card);
    return card;
  }
  function render(saved = null) {
    grades = new Map();
    $('#problems').replaceChildren(...set.problems.map((p,i) => renderQuestion(p,i,saved?.drafts?.[i],Boolean(saved?.revealed?.[i]))));
    $('#problem-count').textContent = `${set.problems.length} 問`;
    $('#set-description').textContent = `${categoryName(settings.category)} / ${levelLabels[settings.difficulty]} · 勘定科目と金額を入力してください。複合仕訳は行を追加できます。`;
    $('#current-seed').textContent = set.seed;
    $('#session-feedback').textContent = '';
    if (saved?.graded) saved.graded.forEach((done,i) => { if(done && i < set.problems.length) grade(i,false); });
    syncSolutionButton(); updateProgress(); persist();
  }
  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !saved.settings || ![5,10,20,30].includes(saved.settings.count) || typeof saved.seed !== 'string' || saved.seed.length > 120) return false;
      const generated = E.generateSet({...saved.settings, seed:saved.seed});
      if (!Array.isArray(saved.drafts) || !Array.isArray(saved.graded) || !Array.isArray(saved.revealed)) return false;
      if (JSON.stringify(generated.problems.map(problemSignature)) !== JSON.stringify(saved.signatures)) return false;
      settings = saved.settings; set = generated;
      $('#difficulty').value = settings.difficulty; $('#category').value = settings.category; $('#count').value = String(settings.count);
      render(saved);
      $('#session-feedback').textContent = '前回の練習を復元しました。続きから取り組めます。';
      return true;
    } catch { return false; }
  }
  function generate(event) {
    event?.preventDefault();
    $('#form-error').textContent = '';
    if (hasInput() && !window.confirm('新しい問題を作ると、今の入力内容は置き換わります。続けますか？')) return;
    try {
      const nextSettings = {count:Number($('#count').value), difficulty:$('#difficulty').value, category:$('#category').value};
      const generated = E.generateSet({...nextSettings,seed:$('#seed').value.trim()});
      settings = nextSettings; set = generated; render();
      if (event) { $('#worksheet').focus({preventScroll:true}); $('#worksheet').scrollIntoView({behavior:'smooth',block:'start'}); }
    } catch(error) { $('#form-error').textContent = error.message || 'この条件の問題を生成できません。条件を変更してください。'; }
  }
  function exportCsv(includeAnswers) {
    try {
      const data = E.toCsv(set,{includeAnswers});
      const blob = new Blob([data],{type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob); const link = el('a');
      link.href = url; link.download = `prac-${includeAnswers?'answers':'questions'}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      $('.export-menu').open = false;
    } catch { $('#session-feedback').textContent = 'CSV を保存できませんでした。ブラウザーのダウンロード設定を確認してください。'; }
  }
  function restorePrint() {
    if (printDetails) {
      $$('.solution').forEach((node,i) => { node.open = printDetails[i]; });
      printDetails = null;
    }
    delete document.body.dataset.printAnswers;
    syncSolutionButton();
  }
  function printWorksheet(includeAnswers) {
    $('.export-menu').open = false;
    printDetails = $$('.solution').map(node => node.open);
    document.body.dataset.printAnswers = String(includeAnswers);
    if (includeAnswers) $$('.solution').forEach(node => {node.open = true;});
    try { window.print(); } catch {
      restorePrint();
      $('#session-feedback').textContent = '印刷画面を開けませんでした。ブラウザーの印刷メニューをご利用ください。';
    }
  }
  if (!E) { $('#form-error').textContent = '問題エンジンを読み込めませんでした。engine.js を index.html と同じフォルダーに配置してください。'; return; }
  E.CATEGORIES.forEach(category => $('#category').append(option(category.id, category.label)));
  $('#generator-form').addEventListener('submit', generate);
  $('#grade-all').addEventListener('click', () => {
    set.problems.forEach((_,i) => grade(i,false)); updateProgress(); persist();
    const correct = [...grades.values()].filter(result => result.correct).length;
    $('#session-feedback').textContent = `${set.problems.length} 問中 ${correct} 問正解です。${correct === set.problems.length ? 'すべて正解！ 次の問題にも挑戦してみましょう。' : '各問題の採点結果や「解答と考え方」を確認してみましょう。'}`;
  });
  $('#toggle-solutions').addEventListener('click', () => {
    const shouldOpen = !$$('.solution').every(node => node.open);
    $$('.solution').forEach(node => {node.open = shouldOpen;}); syncSolutionButton(); persist();
  });
  $('#reset-answers').addEventListener('click', () => {
    if (!hasInput() && !grades.size) return;
    if (!window.confirm('この問題セットの入力内容と採点結果をリセットしますか？')) return;
    render(); $('#session-feedback').textContent = '入力内容をリセットしました。同じ問題でもう一度練習できます。';
  });
  $('#export-problems').addEventListener('click',()=>exportCsv(false));
  $('#export-answers').addEventListener('click',()=>exportCsv(true));
  $('#print-problems').addEventListener('click',()=>printWorksheet(false));
  $('#print-answers').addEventListener('click',()=>printWorksheet(true));
  window.addEventListener('afterprint',restorePrint);
  document.addEventListener('click',event => { if(!event.target.closest('.export-menu')) $('.export-menu').open = false; });
  document.addEventListener('keydown',event => { if(event.key === 'Escape') $('.export-menu').open = false; });
  if (!loadSession()) generate();
})();
