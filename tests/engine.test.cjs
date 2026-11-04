'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../engine.js');
const { generateSet, gradeAnswer, toCsv, TEMPLATES, CATEGORIES, ACCOUNTS } = engine;
const clone = x => JSON.parse(JSON.stringify(x));

test('same seed and options reproduce the full set, including Japanese seeds', () => {
  for (const seed of ['demo', '簿記の練習', '0', '=1+1', '  ']) {
    const options = { count: 50, seed };
    assert.deepEqual(generateSet(options), generateSet(options));
  }
  assert.notDeepEqual(generateSet({ seed: 'a' }), generateSet({ seed: 'b' }));
  const fresh = generateSet();
  assert.ok(fresh.seed.length);
  assert.deepEqual(fresh, generateSet({ seed: fresh.seed }));
});

test('script works without CommonJS or dependencies and matches Node output', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../engine.js'), 'utf8'), context);
  assert.equal(typeof context.PracEngine.generateSet, 'function');
  assert.equal(JSON.stringify(context.PracEngine.generateSet({ seed: 'cross-runtime' })), JSON.stringify(generateSet({ seed: 'cross-runtime' })));
});

test('28 unique templates and immutable public metadata', () => {
  assert.ok(TEMPLATES.length >= 18);
  assert.equal(new Set(TEMPLATES.map(x => x.id)).size, TEMPLATES.length);
  assert.ok(Object.isFrozen(TEMPLATES));
  assert.ok(Object.isFrozen(ACCOUNTS));
  for (const template of TEMPLATES) {
    assert.ok(Object.isFrozen(template));
    assert.deepEqual(Object.keys(template).sort(), ['category', 'difficulty', 'id', 'title']);
  }
});

test('5000 generated problems have integer yen, known accounts, and balanced correct answers', () => {
  for (let i = 0; i < 100; i++) {
    const set = generateSet({ count: 50, seed: String(i) });
    assert.equal(new Set(set.problems.map(x => x.id)).size, 50);
    for (const problem of set.problems) {
      assert.ok(problem.prompt.length > 10);
      assert.match(problem.explanation, /三分法/);
      assert.match(problem.explanation, /考慮しない/);
      for (const row of problem.entries) {
        assert.ok(Number.isSafeInteger(row.amount) && row.amount > 0);
        assert.ok(ACCOUNTS.includes(row.account));
        assert.ok(['debit', 'credit'].includes(row.side));
      }
      assert.equal(gradeAnswer(problem, problem.entries).correct, true);
      assert.equal(gradeAnswer(problem, problem.entries).balanced, true);
    }
  }
});

test('every category/difficulty combination has eligible templates and respects filters', () => {
  for (const category of ['all', ...CATEGORIES.map(x => x.id)]) {
    for (const difficulty of ['all', 'basic', 'applied']) {
      const set = generateSet({ count: 50, category, difficulty, seed: 'filters' });
      assert.equal(set.problems.length, 50);
      for (const p of set.problems) {
        assert.ok(category === 'all' || p.category === category);
        assert.ok(difficulty === 'all' || p.difficulty === difficulty);
      }
    }
  }
});

test('shuffled rounds never repeat a template before the round is exhausted', () => {
  for (const category of ['all', ...CATEGORIES.map(x => x.id)]) {
    for (const difficulty of ['all', 'basic', 'applied']) {
      const eligible = TEMPLATES.filter(t => (category === 'all' || t.category === category) && (difficulty === 'all' || t.difficulty === difficulty));
      const ids = generateSet({ count: 50, category, difficulty, seed: 'rounds' }).problems.map(p => p.templateId);
      for (let i = 0; i < ids.length; i += eligible.length) {
        const round = ids.slice(i, i + eligible.length);
        assert.equal(new Set(round).size, round.length);
      }
    }
  }
});

test('count and filter validation rejects malformed values', () => {
  for (const count of [0, -1, 51, 1.5, NaN, Infinity, '10', null, true]) assert.throws(() => generateSet({ count }));
  assert.equal(generateSet({ count: 1 }).problems.length, 1);
  assert.equal(generateSet({ count: 50 }).problems.length, 50);
  assert.throws(() => generateSet({ difficulty: 'hard' }));
  assert.throws(() => generateSet({ category: 'missing' }));
  assert.throws(() => generateSet({ seed: 12 }));
  assert.throws(() => generateSet(null));
  assert.throws(() => generateSet([]));
});

test('grading accepts row reordering and repeated-account aggregation without mutation', () => {
  const p = generateSet({ count: 1, seed: 'grade', difficulty: 'basic' }).problems[0];
  const before = clone(p);
  const answer = p.entries.slice().reverse().flatMap(e => [{ ...e, amount: 1 }, { ...e, amount: e.amount - 1 }]);
  const answerBefore = clone(answer);
  assert.equal(gradeAnswer(p, answer).correct, true);
  assert.deepEqual(p, before);
  assert.deepEqual(answer, answerBefore);
});

test('balanced wrong accounts, reversed sides, and scaled amounts are wrong', () => {
  const p = { entries: [{ side: 'debit', account: '現金', amount: 1000 }, { side: 'credit', account: '売上', amount: 1000 }] };
  for (const rows of [
    [{ side: 'debit', account: '普通預金', amount: 1000 }, p.entries[1]],
    p.entries.map(e => ({ ...e, side: e.side === 'debit' ? 'credit' : 'debit' })),
    p.entries.map(e => ({ ...e, amount: e.amount * 2 }))
  ]) {
    const result = gradeAnswer(p, rows);
    assert.equal(result.correct, false);
    assert.equal(result.balanced, true);
  }
  assert.equal(gradeAnswer(p, [p.entries[0]]).balanced, false);
});

test('grading rejects blank, zero, negative, noninteger, unsafe, malformed, and unknown rows', () => {
  const p = generateSet({ count: 1, seed: 'invalid', difficulty: 'basic' }).problems[0];
  for (const amount of ['', '1000', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, true]) {
    assert.equal(gradeAnswer(p, [{ ...p.entries[0], amount }, p.entries[1]]).correct, false);
  }
  for (const rows of [[], null, {}, [null], [undefined], [{ ...p.entries[0], account: '' }], [{ ...p.entries[0], account: '勝手な科目' }], [{ ...p.entries[0], side: 'left' }]]) {
    assert.equal(gradeAnswer(p, rows).correct, false);
  }
  const overflow = Array.from({ length: 2 }, () => ({ side: 'debit', account: '現金', amount: Number.MAX_SAFE_INTEGER }));
  assert.equal(gradeAnswer(p, overflow).correct, false);
  assert.throws(() => gradeAnswer({ entries: [] }, p.entries));
});

test('inventory adjustments preserve both sides and reject netting', () => {
  const p = generateSet({ count: 50, category: 'closing', seed: 'inventory' }).problems.find(p => p.templateId === 'inventory-closing');
  assert.equal(p.entries.length, 4);
  assert.equal(gradeAnswer(p, p.entries.slice().reverse()).correct, true);
  const net = p.entries[0].amount - p.entries[2].amount;
  const rows = net >= 0 ? [{ side: 'debit', account: '仕入', amount: net }, { side: 'credit', account: '繰越商品', amount: net }] : [{ side: 'debit', account: '繰越商品', amount: -net }, { side: 'credit', account: '仕入', amount: -net }];
  assert.equal(gradeAnswer(p, rows).correct, false);
});

test('CSV includes Japanese headers, BOM and opt-in answers without modifying source', () => {
  const set = generateSet({ count: 2, seed: 'csv' }), before = clone(set);
  const csv = toCsv(set);
  assert.ok(csv.startsWith('\uFEFF"シード"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(!csv.includes('解答（借方）'));
  assert.ok(!csv.includes(set.problems[0].explanation));
  assert.match(toCsv(set, { includeAnswers: true }), /解答（借方）/);
  assert.deepEqual(set, before);
});

test('CSV quotes commas, newlines, quotes, and neutralizes spreadsheet formulas in every text field', () => {
  const set = generateSet({ count: 1, seed: '=HYPERLINK("evil")' });
  set.problems[0].title = 'a,"quoted"\nsecond line';
  set.problems[0].prompt = '   +SUM(1,2)';
  set.problems[0].explanation = '\t@danger';
  set.problems[0].entries[0].account = '-formula';
  const csv = toCsv(set, { includeAnswers: true });
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"a,""quoted""\nsecond line"'));
  assert.ok(csv.includes('"\'   +SUM(1,2)"'));
  assert.ok(csv.includes('"\'\t@danger"'));
  assert.ok(csv.includes('"\'-formula'));
  for (const seed of ['@SUM(1)', '-1+1', '+1+1', '\r=1', '\n=1', '\tplain', '\uFEFF=1']) {
    set.seed = seed;
    assert.ok(toCsv(set).includes('"\'' + seed + '"'));
  }
});
