// 페이지 안 미니 테스트 러너. 결과는 #results[data-summary]에 남겨 run-browser.mjs가 읽는다.
(function () {
  const cases = [];
  window.test = (name, fn) => cases.push({ name, fn });
  window.assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  window.eq = (actual, expected, msg) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg || 'not equal'}: got ${a}, want ${e}`);
  };
  window.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.runTests = async function () {
    await window.Exploragram.ready;
    const out = document.getElementById('results');
    const failed = [];
    if (!cases.length) failed.push('✗ 등록된 테스트가 없어요');
    for (const c of cases) {
      try { await c.fn(); } catch (err) { failed.push(`✗ ${c.name}: ${err.message}`); }
    }
    const summary = failed.length ? `FAIL ${failed.length}/${Math.max(cases.length, 1)}` : `PASS ${cases.length}`;
    out.textContent = [summary, ...failed].join('\n');
    out.dataset.summary = summary;
  };
  window.addEventListener('DOMContentLoaded', () => setTimeout(window.runTests, 0));
})();
