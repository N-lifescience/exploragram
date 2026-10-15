// 키-값 저장소. IndexedDB가 안 되면 localStorage, 그것도 안 되면 메모리(창을 닫으면 사라짐).
const Store = {
  backend: 'memory',
  db: null,
  mem: new Map(),

  async init() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('exploragram', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error('indexedDB timeout')), 3000);
      });
      this.backend = 'idb';
      return;
    } catch (err) { /* localStorage로 */ }
    try {
      localStorage.setItem('exploragram:probe', '1');
      localStorage.removeItem('exploragram:probe');
      this.backend = 'local';
    } catch (err) {
      this.backend = 'memory';
      console.warn('[exploragram] 브라우저 저장소를 쓸 수 없어 판서가 창을 닫으면 사라집니다.');
    }
  },

  tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(req.result);
      // 용량 초과 같은 커밋 실패는 요청 오류 없이 abort만 온다
      t.onerror = t.onabort = () => reject(t.error || req.error || new Error('indexedDB transaction failed'));
    });
  },

  // 수업 중에 멈추거나 예외를 던지지 않도록, 실패하면 경고만 남기고 fallback을 돌려준다.
  async guard(what, key, fallback, fn) {
    try { return await fn(); } catch (err) {
      console.warn(`[exploragram] 저장소 ${what} 실패:`, key, err);
      return fallback;
    }
  },

  get(key) {
    return this.guard('읽기', key, undefined, () => {
      if (this.backend === 'idb') return this.tx('readonly', (s) => s.get(key));
      if (this.backend === 'local') {
        const v = localStorage.getItem(`exploragram:${key}`);
        return v == null ? undefined : JSON.parse(v);
      }
      return this.mem.get(key);
    });
  },

  set(key, value) {
    return this.guard('쓰기', key, false, async () => {
      if (this.backend === 'idb') await this.tx('readwrite', (s) => s.put(value, key));
      else if (this.backend === 'local') localStorage.setItem(`exploragram:${key}`, JSON.stringify(value));
      else this.mem.set(key, value);
      return true;
    });
  },

  del(key) {
    return this.guard('지우기', key, false, async () => {
      if (this.backend === 'idb') await this.tx('readwrite', (s) => s.delete(key));
      else if (this.backend === 'local') localStorage.removeItem(`exploragram:${key}`);
      else this.mem.delete(key);
      return true;
    });
  },
};
