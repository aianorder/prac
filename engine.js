/* Japanese bookkeeping practice. No dependencies; usable from file:// and Node. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PracEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ACCOUNTS = Object.freeze(['現金', '普通預金', '売掛金', '買掛金', '仕入', '売上', '消耗品費', '通信費', '水道光熱費', '支払家賃', '給料', '備品', '未払金', '借入金', '支払利息', '貸付金', '受取利息', '前払金', '前受金', '旅費交通費', '仮払金', '減価償却費', '備品減価償却累計額', '貸倒引当金繰入', '貸倒引当金', '前払費用', '未払費用', '繰越商品']);
  const CATEGORIES = Object.freeze([
    { id: 'daily', label: '日常の取引' }, { id: 'trade', label: '商品売買' },
    { id: 'finance', label: '資金の取引' }, { id: 'closing', label: '決算整理' }
  ].map(Object.freeze));
  const yen = n => n.toLocaleString('ja-JP') + '円';
  const d = (account, amount) => ({ side: 'debit', account, amount });
  const c = (account, amount) => ({ side: 'credit', account, amount });
  const assumptions = '金額はすべて円。消費税・法人税等は考慮しない。商品売買は三分法で処理する。';
  const templates = [];
  function add(id, category, difficulty, title, make) { templates.push({ id, category, difficulty, title, make }); }
  function basic(id, category, title, prompt, debit, credit, explanation) {
    add(id, category, 'basic', title, r => { const a = r.money(); return { prompt: prompt(yen(a)), entries: [d(debit, a), c(credit, a)], explanation }; });
  }
  basic('supplies-cash', 'daily', '消耗品の購入', a => `事務用の消耗品${a}を購入し、現金で支払った。購入時に全額を費用処理する。`, '消耗品費', '現金', '消耗品費の発生を借方、現金の減少を貸方に記入する。');
  basic('phone-bank', 'daily', '通信料の支払い', a => `当月分の通信料${a}が普通預金から引き落とされた。事前の未払計上はない。`, '通信費', '普通預金', '当月の通信費を借方、普通預金の減少を貸方に記入する。');
  basic('utilities-bank', 'daily', '水道光熱費の支払い', a => `当月分の水道光熱費${a}を普通預金から支払った。事前の未払計上はない。`, '水道光熱費', '普通預金', '費用の発生は借方、預金の減少は貸方になる。');
  basic('rent-bank', 'daily', '家賃の支払い', a => `当月分の店舗家賃${a}を普通預金から支払った。前払い・未払いの計上はない。`, '支払家賃', '普通預金', '当月に対応する家賃を支払家賃として費用計上する。');
  basic('salary-bank', 'daily', '給料の支払い', a => `当月分の給料${a}を普通預金から支払った。源泉徴収・社会保険料などの控除はなく、未払計上もない。`, '給料', '普通預金', '給料の発生を借方、普通預金の減少を貸方に記入する。');
  basic('equipment-unpaid', 'daily', '備品の後払い購入', a => `業務用の備品${a}を購入した。代金は翌月払いとする。`, '備品', '未払金', '備品は資産。商品以外の購入代金の後払いは買掛金ではなく未払金で処理する。');
  basic('purchase-cash', 'trade', '商品の現金仕入れ', a => `商品${a}を仕入れ、現金で支払った。`, '仕入', '現金', '三分法では商品の購入を仕入勘定で処理する。');
  basic('purchase-credit', 'trade', '商品の掛仕入れ', a => `商品${a}を仕入れ、代金は掛けとした。`, '仕入', '買掛金', '商品の仕入れを借方の仕入、掛代金の債務を貸方の買掛金に記入する。');
  basic('sale-cash', 'trade', '商品の現金売上げ', a => `商品を${a}で販売し、代金は現金で受け取った。`, '現金', '売上', '現金の増加を借方、売上の発生を貸方に記入する。三分法なので販売時の売上原価の仕訳は行わない。');
  basic('sale-credit', 'trade', '商品の掛売上げ', a => `商品を${a}で販売し、代金は掛けとした。`, '売掛金', '売上', '掛代金の債権を売掛金として借方、売上を貸方に記入する。');
  basic('collect-receivable', 'trade', '売掛金の回収', a => `売掛金${a}が普通預金口座に振り込まれた。振込手数料はない。`, '普通預金', '売掛金', '預金が増加し、売掛金が減少する。回収時に売上を再計上しない。');
  basic('pay-payable', 'trade', '買掛金の支払い', a => `買掛金${a}を普通預金から支払った。振込手数料はない。`, '買掛金', '普通預金', '債務である買掛金の減少は借方、預金の減少は貸方に記入する。');
  basic('purchase-return', 'trade', '仕入返品', a => `掛けで仕入れた商品の一部${a}を返品し、買掛金から差し引くこととした。`, '買掛金', '仕入', '仕入れ時と逆に、買掛金を減らし仕入を取り消す。');
  basic('sale-return', 'trade', '売上返品', a => `掛けで販売した商品の一部${a}が返品され、売掛金から差し引くこととした。`, '売上', '売掛金', '売上げ時と逆に、売上を取り消し売掛金を減らす。三分法なので原価の仕訳は行わない。');
  basic('bank-deposit', 'finance', '現金の預け入れ', a => `手元の現金${a}を普通預金に預け入れた。`, '普通預金', '現金', '資産同士の移動。普通預金が増加し、現金が減少する。');
  basic('borrow-bank', 'finance', '借入れ', a => `銀行から${a}を借り入れ、同額が普通預金口座に入金された。手数料・利息の差引きはない。`, '普通預金', '借入金', '預金という資産の増加を借方、借入金という負債の増加を貸方に記入する。');
  basic('lend-bank', 'finance', '貸付け', a => `取引先に${a}を貸し付け、普通預金から送金した。手数料はない。`, '貸付金', '普通預金', '貸付金という債権を借方、預金の減少を貸方に記入する。');
  add('purchase-split', 'trade', 'applied', '現金と掛けによる仕入れ', r => {
    const cash = r.money(), credit = r.money();
    return { prompt: `商品${yen(cash + credit)}を仕入れ、${yen(cash)}を現金で支払い、残額を掛けとした。`, entries: [d('仕入', cash + credit), c('現金', cash), c('買掛金', credit)], explanation: '仕入総額を借方に記入し、貸方を現金支払額と買掛金に分ける。' };
  });
  add('sale-advance', 'trade', 'applied', '前受金を充当する売上げ', r => {
    const advance = r.money(), rest = r.money();
    return { prompt: `商品を${yen(advance + rest)}で販売した。以前受け取って前受金に計上した${yen(advance)}を充当し、残額は掛けとした。`, entries: [d('前受金', advance), d('売掛金', rest), c('売上', advance + rest)], explanation: '前受金の負債を借方で取り消し、残りを売掛金とする。売上は販売総額で計上する。' };
  });
  add('purchase-advance', 'trade', 'applied', '前払金を充当する仕入れ', r => {
    const advance = r.money(), rest = r.money();
    return { prompt: `商品${yen(advance + rest)}を仕入れた。以前支払って前払金に計上した${yen(advance)}を充当し、残額は掛けとした。`, entries: [d('仕入', advance + rest), c('前払金', advance), c('買掛金', rest)], explanation: '仕入総額を計上し、前払金という資産を減らして残りを買掛金に計上する。' };
  });
  add('repay-interest', 'finance', 'applied', '利息とともに借入金を返済', r => {
    const principal = r.money(), interest = r.int(1, 20) * 100;
    return { prompt: `借入金${yen(principal)}を返済し、利息${yen(interest)}と合わせて普通預金から支払った。利息の未払計上はない。`, entries: [d('借入金', principal), d('支払利息', interest), c('普通預金', principal + interest)], explanation: '元本返済は借入金の減少、利息は支払利息という費用として分けて計上する。' };
  });
  add('collect-loan-interest', 'finance', 'applied', '貸付金と利息の回収', r => {
    const principal = r.money(), interest = r.int(1, 20) * 100;
    return { prompt: `貸付金${yen(principal)}を回収し、利息${yen(interest)}と合わせて普通預金口座に入金された。利息の未収計上はない。`, entries: [d('普通預金', principal + interest), c('貸付金', principal), c('受取利息', interest)], explanation: '受取総額を普通預金に計上し、貸付元本の減少と受取利息の収益に分ける。' };
  });
  add('travel-settlement', 'daily', 'applied', '出張旅費の精算', r => {
    const cost = r.money(), returned = r.int(1, 20) * 100;
    return { prompt: `出張のため仮払金として渡していた${yen(cost + returned)}を精算した。実際の旅費は${yen(cost)}で、残額は現金で返してもらった。`, entries: [d('旅費交通費', cost), d('現金', returned), c('仮払金', cost + returned)], explanation: '仮払金の全額を貸方で取り消し、実際の旅費と返却された現金を借方に記入する。' };
  });
  add('depreciation', 'closing', 'basic', '備品の減価償却', r => {
    const years = r.int(3, 8), annual = r.money(), cost = annual * years;
    return { prompt: `決算にあたり、備品（取得原価${yen(cost)}、残存価額0円、耐用年数${years}年）を定額法・間接法で減価償却する。使用開始から当期末まで満1年で、当期の償却は未計上である。`, entries: [d('減価償却費', annual), c('備品減価償却累計額', annual)], explanation: `年間減価償却費＝（取得原価${yen(cost)}－残存価額0円）÷${years}年＝${yen(annual)}。間接法では備品減価償却累計額を貸方に使う。` };
  });
  add('allowance-adjustment', 'closing', 'applied', '貸倒引当金の差額補充', r => {
    const base = r.int(10, 90) * 10000, percent = r.int(1, 4), needed = base * percent / 100;
    const existing = Math.floor(needed / 200) * 100;
    return { prompt: `決算時の売掛金残高${yen(base)}に対し、${percent}％の貸倒引当金を差額補充法で設定する。貸倒引当金の決算整理前の貸方残高は${yen(existing)}である。`, entries: [d('貸倒引当金繰入', needed - existing), c('貸倒引当金', needed - existing)], explanation: `必要残高${yen(needed)}から既存残高${yen(existing)}を差し引いた${yen(needed - existing)}を追加計上する。` };
  });
  add('prepaid-rent', 'closing', 'basic', '前払家賃の整理', r => {
    const monthly = r.money(), months = r.int(1, 6), amount = monthly * months;
    return { prompt: `決算にあたり、支払家賃に計上済みの金額に翌期分の家賃${months}か月分（月額${yen(monthly)}）が含まれていることが分かった。翌期分を前払費用に振り替える。`, entries: [d('前払費用', amount), c('支払家賃', amount)], explanation: `翌期分${yen(amount)}は当期の費用から除き、前払費用という資産に振り替える。` };
  });
  basic('accrued-interest', 'closing', '未払利息の整理', a => `決算にあたり、借入金に対する当期分の利息${a}が未払い・未計上であることが分かった。未払費用を使って整理する。`, '支払利息', '未払費用', '当期に発生した利息は未払いでも費用計上し、未払費用という負債を計上する。');
  add('inventory-closing', 'closing', 'applied', '期首・期末商品の整理', r => {
    const opening = r.money(), closing = r.money();
    return { prompt: `三分法を採用し、売上原価を仕入勘定で計算する。期首商品棚卸高は${yen(opening)}、期末商品棚卸高は${yen(closing)}である。決算整理の2つの仕訳をまとめて記入すること（同じ勘定の借方・貸方を相殺しない）。`, entries: [d('仕入', opening), c('繰越商品', opening), d('繰越商品', closing), c('仕入', closing)], explanation: '期首商品を「仕入／繰越商品」で仕入に加算し、期末商品を「繰越商品／仕入」で仕入から控除する。2つの仕訳を相殺せず記入する。' };
  });
  const TEMPLATES = Object.freeze(templates.map(({ id, category, difficulty, title }) => Object.freeze({ id, category, difficulty, title })));
  function random(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ h >>> 15, 1 | h); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function freshSeed() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
      return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function generateSet(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('出題条件を指定してください。');
    const { count = 10, difficulty = 'all', category = 'all', seed = '' } = options;
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new RangeError('問題数は1〜50の整数で指定してください。');
    if (!['basic', 'applied', 'all'].includes(difficulty)) throw new RangeError('難易度が不正です。');
    if (category !== 'all' && !CATEGORIES.some(x => x.id === category)) throw new RangeError('分野が不正です。');
    if (typeof seed !== 'string') throw new TypeError('シードは文字列で指定してください。');
    const actualSeed = seed === '' ? freshSeed() : seed;
    const rand = random(actualSeed), r = { int: (min, max) => min + Math.floor(rand() * (max - min + 1)) };
    r.money = () => r.int(5, 100) * 1000;
    const eligible = templates.filter(t => (difficulty === 'all' || t.difficulty === difficulty) && (category === 'all' || t.category === category));
    const problems = [];
    while (problems.length < count) {
      const round = eligible.slice();
      for (let i = round.length - 1; i > 0; i--) { const j = r.int(0, i); [round[i], round[j]] = [round[j], round[i]]; }
      for (const template of round) {
        if (problems.length === count) break;
        const content = template.make(r);
        problems.push({ id: 'q' + (problems.length + 1), templateId: template.id, category: template.category, difficulty: template.difficulty, title: template.title, prompt: content.prompt, entries: content.entries, explanation: content.explanation + '\n' + assumptions });
      }
    }
    return { seed: actualSeed, problems };
  }
  function summarize(entries) {
    const totals = { debit: 0, credit: 0 }, map = new Map();
    if (!Array.isArray(entries) || entries.length === 0) return null;
    for (const row of entries) {
      if (!row || !['debit', 'credit'].includes(row.side) || typeof row.account !== 'string' || !ACCOUNTS.includes(row.account) || !Number.isSafeInteger(row.amount) || row.amount <= 0) return null;
      totals[row.side] += row.amount;
      const key = row.side + ':' + row.account;
      map.set(key, (map.get(key) || 0) + row.amount);
      if (!Number.isSafeInteger(totals[row.side])) return null;
    }
    return { totals, map };
  }
  function gradeAnswer(problem, entries) {
    const expected = summarize(problem && problem.entries);
    if (!expected || expected.totals.debit !== expected.totals.credit) throw new TypeError('正解データが不正です。');
    const actual = summarize(entries);
    if (!actual) return { correct: false, balanced: false, debitTotal: 0, creditTotal: 0, message: '勘定科目・貸借区分・金額を確認してください。金額は正の整数で入力してください。' };
    const balanced = actual.totals.debit === actual.totals.credit;
    const correct = balanced && actual.map.size === expected.map.size && [...expected.map].every(([key, amount]) => actual.map.get(key) === amount);
    return { correct, balanced, debitTotal: actual.totals.debit, creditTotal: actual.totals.credit, message: correct ? '正解です！' : balanced ? '貸借は一致していますが、勘定科目・貸借区分・金額を見直してください。' : '借方と貸方の合計が一致していません。' };
  }
  function csvCell(value) {
    let s = String(value == null ? '' : value);
    // Quoting alone does not prevent spreadsheet formula execution.
    if (/^[\s\uFEFF]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCsv(set, options = {}) {
    if (!set || !Array.isArray(set.problems)) throw new TypeError('問題セットが不正です。');
    const includeAnswers = options.includeAnswers === true;
    const rows = [['シード', '問題番号', '分野', '難易度', 'タイトル', '問題文']];
    if (includeAnswers) rows[0].push('解答（借方）', '解答（貸方）', '解説');
    set.problems.forEach((p, index) => {
      const cat = CATEGORIES.find(x => x.id === p.category);
      const row = [set.seed, index + 1, cat ? cat.label : p.category, p.difficulty === 'basic' ? '基本' : p.difficulty === 'applied' ? '応用' : p.difficulty, p.title, p.prompt];
      if (includeAnswers) row.push(...['debit', 'credit'].map(side => p.entries.filter(e => e.side === side).map(e => `${e.account} ${e.amount}円`).join(' / ')), p.explanation);
      rows.push(row);
    });
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  return Object.freeze({ ACCOUNTS, CATEGORIES, TEMPLATES, generateSet, gradeAnswer, toCsv });
});
