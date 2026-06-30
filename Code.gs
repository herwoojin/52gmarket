/*** ============================================================
 *  오이(52)지마켓 — Google Apps Script 백엔드
 *  역할
 *   1) doGet  : 앱이 매물 목록을 JSON으로 읽어감
 *   2) doPost : 앱/관리자가 매물 등록·수정·삭제
 *   3) 관리자 메뉴/사이드바 : 시트 안에서 등록·편집·사진등록을 쉽게
 *  데이터 단일 출처(Source of Truth) = 이 스프레드시트의 '매물' 시트
 *  ============================================================
 *
 *  ⚙️  설정(스크립트 속성 → 프로젝트 설정 > 스크립트 속성)에 등록:
 *    API_TOKEN        : 앱과 공유하는 비밀 토큰 (아무 긴 문자열)
 *    FB_BUCKET        : Firebase Storage 버킷 (예: oiji-market.appspot.com)
 *    FB_CLIENT_EMAIL  : 서비스 계정 이메일 (사진을 시트 안에서 올릴 때만 필요)
 *    FB_PRIVATE_KEY   : 서비스 계정 private_key (\n 포함 통째로)
 *  ============================================================ */

const SHEET_NAME = '매물';
const HEADERS = ['id','createdAt','status','deal','category','title','price','desc','loc','nick','uid','photoURL','jjim','chats'];

/* ---------- 시트 준비 ---------- */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0e1813').setFontColor('#73d98a');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rowsToObjects_() {
  const sh = getSheet_();
  const data = sh.getDataRange().getValues();
  const head = data.shift();
  return data.map((r, i) => {
    const o = {};
    head.forEach((h, c) => o[h] = r[c]);
    o._row = i + 2;
    return o;
  });
}

/* =========================================================
 *  1) 읽기 — 앱이 GET 으로 호출
 *  ========================================================= */
function doGet() {
  const items = rowsToObjects_()
    .filter(o => o.id && o.status !== '삭제')
    .map(o => ({
      id: String(o.id),
      deal: o.deal || '나눔',
      category: o.category || '기타',
      title: o.title || '',
      price: Number(o.price) || 0,
      desc: o.desc || '',
      loc: o.loc || '',
      nick: o.nick || '익명',
      photoURL: o.photoURL || '',
      status: o.status || '판매중',
      jjim: Number(o.jjim) || 0,
      chats: Number(o.chats) || 0,
      createdAt: o.createdAt ? new Date(o.createdAt).getTime() : 0
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return json_({ ok: true, items });
}

/* =========================================================
 *  2) 쓰기 — 앱/관리자가 POST 으로 호출
 *     CORS preflight 를 피하려고 본문은 text/plain 으로 받음
 *  ========================================================= */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    /* ── OTP 관련 액션은 토큰 검증 없이 허용 ── */
    if (body.action === 'sendOtp')   return sendOtp_(body.email);
    if (body.action === 'verifyOtp') return verifyOtp_(body.email, body.code);

    if (body.token !== getProp_('API_TOKEN')) return json_({ ok: false, error: 'unauthorized' });

    switch (body.action) {
      case 'create': return json_({ ok: true, id: createItem_(body.item) });
      case 'update': updateItem_(body.id, body.patch || {}); return json_({ ok: true });
      case 'delete': deleteItem_(body.id); return json_({ ok: true });
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* =========================================================
 *  OTP 이메일 인증 — @gsretail.com 전용
 *  ========================================================= */
function sendOtp_(email) {
  if (!email || !/@gsretail\.com$/i.test(email)) {
    return json_({ ok: false, error: '@gsretail.com 이메일만 사용할 수 있어요' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6자리 난수
  const cache = CacheService.getScriptCache();
  cache.put('otp_' + email.toLowerCase(), code, 300); // 5분 유효

  GmailApp.sendEmail(email, '🥒 오이지마켓 로그인 인증번호', '',{
    htmlBody:
      '<div style="font-family:Pretendard,sans-serif;max-width:420px;margin:0 auto;padding:32px;' +
      'background:#0a120d;color:#e9f2e8;border-radius:18px">' +
      '<h2 style="margin:0 0 8px;color:#73d98a">🥒 오이(52)지마켓</h2>' +
      '<p style="margin:0 0 24px;color:#8ba596;font-size:14px">사내 나눔·재판매 마켓</p>' +
      '<p style="font-size:15px;line-height:1.6">안녕하세요! 로그인 인증번호입니다.</p>' +
      '<div style="margin:24px 0;padding:20px;background:#14241b;border-radius:14px;' +
      'text-align:center;border:1px solid #22382b">' +
      '<span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#52c06e">' + code + '</span>' +
      '</div>' +
      '<p style="font-size:13px;color:#8ba596">이 코드는 <b style="color:#e9f2e8">5분간</b> 유효합니다.<br>' +
      '본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>' +
      '</div>'
  });

  return json_({ ok: true, message: '인증번호를 발송했어요' });
}

function verifyOtp_(email, code) {
  if (!email || !code) return json_({ ok: false, error: '이메일과 인증번호를 입력해주세요' });
  const cache = CacheService.getScriptCache();
  const stored = cache.get('otp_' + email.toLowerCase());
  if (!stored) return json_({ ok: false, error: '인증번호가 만료되었어요. 다시 요청해주세요' });
  if (stored !== String(code).trim()) return json_({ ok: false, error: '인증번호가 일치하지 않아요' });

  cache.remove('otp_' + email.toLowerCase());
  return json_({ ok: true, email: email.toLowerCase() });
}

function createItem_(item) {
  const sh = getSheet_();
  const id = item.id || ('p' + Date.now());
  const row = HEADERS.map(h => {
    if (h === 'id') return id;
    if (h === 'createdAt') return new Date();
    if (h === 'status') return item.status || '판매중';
    if (h === 'jjim' || h === 'chats') return item[h] || 0;
    return item[h] !== undefined ? item[h] : '';
  });
  sh.appendRow(row);
  return id;
}

function findRow_(id) {
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function updateItem_(id, patch) {
  const sh = getSheet_();
  const row = findRow_(id);
  if (row < 0) throw 'not found: ' + id;
  Object.keys(patch).forEach(k => {
    const c = HEADERS.indexOf(k);
    if (c >= 0) sh.getRange(row, c + 1).setValue(patch[k]);
  });
}

/* 소프트 삭제: status 를 '삭제' 로 — 시트에서 행을 직접 지워도 됩니다 */
function deleteItem_(id) {
  const sh = getSheet_();
  const row = findRow_(id);
  if (row < 0) return;
  sh.getRange(row, HEADERS.indexOf('status') + 1).setValue('삭제');
}

/* =========================================================
 *  3) 관리자 메뉴 — 시트 안에서 등록/편집/사진을 쉽게
 *  ========================================================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥒 오이지마켓')
    .addItem('매물 등록·편집 패널 열기', 'openSidebar')
    .addItem('선택한 행에 사진 등록', 'openPhotoForSelected')
    .addSeparator()
    .addItem('거래완료로 표시', 'markSelectedSold')
    .addItem('선택한 행 삭제 처리', 'markSelectedDeleted')
    .addToUi();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('🥒 매물 등록·편집');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* 사이드바에서 호출: 현재 선택 행의 값을 읽어옴 */
function getSelectedRow_() {
  const sh = getSheet_();
  const row = sh.getActiveCell().getRow();
  if (row < 2) return null;
  const vals = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const o = { _row: row };
  HEADERS.forEach((h, i) => o[h] = vals[i]);
  return o;
}

/* 사이드바에서 등록/수정 제출 */
function saveFromSidebar(item) {
  if (item.id && findRow_(item.id) >= 0) {
    updateItem_(item.id, item);
    return { ok: true, mode: '수정', id: item.id };
  }
  const id = createItem_(item);
  return { ok: true, mode: '등록', id };
}

/* 사이드바에서 사진 업로드 → Firebase Storage → URL 반환 */
function uploadPhotoFromSidebar(base64, filename, mimeType) {
  const url = uploadToFirebase_(base64, filename, mimeType);
  return { ok: true, url };
}

/* 메뉴: 선택 행에 사진 등록(파일 선택 다이얼로그) */
function openPhotoForSelected() {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;padding:14px;font-size:13px">' +
    '왼쪽 사이드바의 <b>사진 올리기</b> 버튼을 사용하면 선택한 행에 바로 등록됩니다.' +
    '</div>').setWidth(280).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, '사진 등록 안내');
}

function markSelectedSold() {
  const o = getSelectedRow_(); if (!o) return;
  updateItem_(o.id, { status: '거래완료' });
  SpreadsheetApp.getActiveSpreadsheet().toast('거래완료로 표시했어요', '🥒', 3);
}
function markSelectedDeleted() {
  const o = getSelectedRow_(); if (!o) return;
  deleteItem_(o.id);
  SpreadsheetApp.getActiveSpreadsheet().toast('삭제 처리했어요', '🥒', 3);
}

/* =========================================================
 *  Firebase Storage 업로드 (서비스 계정 REST 방식)
 *  앱은 Firebase JS SDK 로 직접 올리고, '시트 안에서' 올릴 때만 이걸 사용
 *  ========================================================= */
function uploadToFirebase_(base64, filename, mimeType) {
  const bucket = getProp_('FB_BUCKET');
  const token = getFirebaseAccessToken_();
  const bytes = Utilities.base64Decode(base64);
  const objectName = 'listings/' + Date.now() + '_' + filename;
  const uploadUrl = 'https://firebasestorage.googleapis.com/v0/b/' + bucket +
    '/o?uploadType=media&name=' + encodeURIComponent(objectName);

  const res = UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    contentType: mimeType || 'image/webp',
    payload: bytes,
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const meta = JSON.parse(res.getContentText());
  if (!meta.downloadTokens) throw '업로드 실패: ' + res.getContentText();
  return 'https://firebasestorage.googleapis.com/v0/b/' + bucket +
    '/o/' + encodeURIComponent(objectName) + '?alt=media&token=' + meta.downloadTokens;
}

/* 서비스 계정으로 OAuth 액세스 토큰 발급 (JWT 서명) */
function getFirebaseAccessToken_() {
  const email = getProp_('FB_CLIENT_EMAIL');
  const key = getProp_('FB_PRIVATE_KEY').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  }));
  const signature = Utilities.computeRsaSha256Signature(header + '.' + claim, key);
  const jwt = header + '.' + claim + '.' + Utilities.base64EncodeWebSafe(signature);
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }
  });
  return JSON.parse(res.getContentText()).access_token;
}

/* ---------- 공통 ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function getProp_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}
