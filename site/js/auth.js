'use strict';
/* ============================================================
   起動時のパスワード（簡易の鍵）
   - 初回起動時（このブラウザで一度も入力していないとき）に、パスワードを聞く。合っていれば、このブラウザには覚えておく。
   - ソースに平文のパスワードは書かず、SHA-256 のハッシュを持つ。
   - ※ これは「うっかり開かれない」ための簡易な鍵で、本当の防御ではない。
       プログラムはすべて手元に届く（ソースを読める）ので、決意した人は回避できる。
       また、生徒のデータは暗号化されない（保存した JSON、ブラウザの一時保存とも）。
       データを守るのは、保存先の管理（校内の決められた場所・USB・共有しない）である。
   - パスワードを変えるとき：ブラウザの開発者ツールのコンソールで Auth.make('新しいパスワード') を実行し、
     出てきた文字列を下の PASS_HASH に貼り付ける（既に覚えている人も、次回から入力が必要になる）。
   ============================================================ */

const Auth = {
  SALT: 'shushoku-senko:v1:',
  PASS_HASH: 'b94f4a0c3bb90f408c75d467b3b3522bce35ce276c18794e0c8ddbeb7b6ccd1d',
  KEY: 'shushoku-senko:auth',

  /** SHA-256（外部部品なし。file:// でも動くよう、自前の実装を使う） */
  sha256(msg) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = Array.from(new TextEncoder().encode(msg));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  },

  /** 新しいパスワードのハッシュを作る（コンソールで使う） */
  make(pw) { return this.sha256(this.SALT + pw); },
  check(pw) { return this.make(String(pw ?? '').trim()) === this.PASS_HASH; },

  /** このブラウザは、すでにパスワードを入力済みか */
  remembered() { try { return localStorage.getItem(this.KEY) === this.PASS_HASH && !this.encOn(); } catch (e) { return false; } },

  /** 起動のパスワードを入れたときの文字列（メモリだけ。保存しない）。暗号化のパスワードとして最初に試す */
  pw: null,
  ENC_KEY: 'shushoku-senko:encOn',
  /** データの暗号化を使っているか（使っているあいだは、起動のたびにパスワードを聞き、それで暗号化も開く） */
  encOn() { try { return localStorage.getItem(this.ENC_KEY) === '1'; } catch (e) { return false; } },
  encFlag(on) { try { if (on) localStorage.setItem(this.ENC_KEY, '1'); else localStorage.removeItem(this.ENC_KEY); } catch (e) { /* 何もしない */ } },
  /** 起動のパスワードで暗号化を開けるか試す。開けたら Crypt.open の結果、だめなら null */
  async tryOpen(enc) {
    for (const p of [this.pw, this.pw == null ? null : this.pw.trim()]) {
      if (!p) continue;
      try { return await Crypt.open(enc, p); } catch (e) { /* 次を試す */ }
    }
    return null;
  },
  remember() { try { localStorage.setItem(this.KEY, this.PASS_HASH); } catch (e) { /* 保存できなくても、この回は使える */ } },
  /** 覚えを消す（次に開くとき、またパスワードを聞く） */
  lock() { try { localStorage.removeItem(this.KEY); } catch (e) { /* 何もしない */ } },

  /** パスワード画面。合っていれば start() を呼ぶ */
  gate(start) {
    if (this.remembered()) { start(); return; }
    const el = document.createElement('div');
    el.id = 'authGate';
    el.innerHTML = `
      <form class="auth-box" autocomplete="off">
        <div class="auth-mark">就</div>
        <h1>就職選考 統合管理</h1>
        <p class="auth-lead">はじめに、パスワードを入力してください。</p>
        <input type="password" id="authPw" aria-label="パスワード" autocomplete="off" autofocus>
        <button type="submit" class="btn btn-primary">開く</button>
        <p class="auth-err" id="authErr" role="alert"></p>
        <p class="auth-note">このパスワードは、このブラウザでは最初の1回だけ入力します。<br>生徒のデータは、保存先（校内の決められた場所・USB）の管理で守ってください。</p>
      </form>`;
    document.body.appendChild(el);
    const pw = el.querySelector('#authPw'), err = el.querySelector('#authErr');
    let fails = 0;
    el.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      if (this.check(pw.value)) {
        this.pw = pw.value;
        this.remember();
        el.remove();
        start();
        return;
      }
      fails++;
      err.textContent = 'パスワードが違います。';
      pw.value = '';
      pw.focus();
      if (fails >= 3) {   // 続けて間違えたら、少し待たせる
        const btn = el.querySelector('button'); btn.disabled = true;
        let s = 5; err.textContent = `パスワードが違います。${s}秒お待ちください。`;
        const t = setInterval(() => { s--; if (s <= 0) { clearInterval(t); btn.disabled = false; err.textContent = 'パスワードが違います。'; } else err.textContent = `パスワードが違います。${s}秒お待ちください。`; }, 1000);
      }
    });
    setTimeout(() => pw.focus(), 0);
  },
};
