/*** ============================================================
 *  오이(52)지마켓 — Google Apps Script 백엔드
 *  역할
 *   1) doGet  : 앱이 매물 목록을 JSON으로 읽어감 / ping으로 변경시각 확인
 *   2) doPost : 앱/관리자가 매물 등록·수정·삭제
 *   3) onSheetEdit_ : 시트 변경 시 타임스탬프 기록 (실시간 동기화)
 *   4) 관리자 메뉴/사이드바 : 시트 안에서 등록·편집·사진등록을 쉽게
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

/* =========================================================
 *  📷 Google Drive 이미지 업로드
 *  Firebase 없이 Apps Script → Drive → 공개 URL 반환
 *  ========================================================= */
function uploadToDrive_(base64, filename, mimeType) {
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/webp', filename || ('photo_' + Date.now() + '.webp'));

  // '오이지마켓-사진' 폴더 찾거나 생성
  let folder;
  const folders = DriveApp.getFoldersByName('오이지마켓-사진');
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder('오이지마켓-사진');
  }

  const file = folder.createFile(blob);
  // ANYONE: 로그인 없이도 <img> 태그에서 직접 로드 가능
  // ANYONE_WITH_LINK는 인증 쿠키가 없으면 Google 로그인 페이지로 리다이렉트됨
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

/* =========================================================
 *  🖼️ 시트 L열 이미지 하이퍼링크 + O열 미리보기 업데이트
 *  ========================================================= */
function setPhotoPreview_(sh, row, url) {
  if (!url || !String(url).startsWith('http')) return;
  // L열(photoURL)은 건드리지 않음 — appendRow/setValue 가 이미 올바른 URL을 기록했음
  // L열에 하이퍼링크를 쓰면 getValues()가 "이미지 보기" 텍스트를 반환해 URL이 사라지는 버그 방지
  sh.getRange(row, 15).setFormula('=IMAGE("' + url + '",4,80,80)');
  sh.setRowHeight(row, 90);
}

/* =========================================================
 *  🔑 Drive 권한 초기화 — Apps Script 에디터에서 실행하거나 메뉴에서 실행
 *  최초 1회 실행 시 Google Drive 접근 권한 팝업이 뜹니다.
 *  ========================================================= */
function initPermissions() {
  try {
    // DriveApp 호출 → 미승인 상태라면 여기서 권한 팝업 발생
    DriveApp.getRootFolder();
    SpreadsheetApp.getActiveSpreadsheet()
      .toast('Google Drive 권한이 정상 승인됐어요!', '🔑 권한 확인', 4);
  } catch (err) {
    SpreadsheetApp.getUi().alert('Drive 권한 오류: ' + err);
  }
}

/* =========================================================
 *  🛠️ 기존 "이미지 보기" photoURL 복구
 *  RichText 하이퍼링크에서 실제 URL을 추출해 L열에 plain text로 복원
 *  Apps Script 에디터에서 한 번만 실행하면 됨
 *  ========================================================= */
function repairPhotoURLs() {
  const sh = getSheet_();
  const photoColNum = HEADERS.indexOf('photoURL') + 1;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getActiveSpreadsheet().toast('데이터가 없어요.', '복구', 3);
    return;
  }

  const photoRange = sh.getRange(2, photoColNum, lastRow - 1, 1);
  const values = photoRange.getValues();
  const richTexts = photoRange.getRichTextValues();

  let fixed = 0;
  for (let i = 0; i < values.length; i++) {
    const cellVal = String(values[i][0] || '');
    if (cellVal.startsWith('http')) continue; // 이미 올바른 URL
    const rt = richTexts[i][0];
    if (!rt) continue;
    for (const run of rt.getRuns()) {
      const link = run.getLinkUrl();
      if (link && link.startsWith('http')) {
        photoRange.getCell(i + 1, 1).setValue(link);
        fixed++;
        break;
      }
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    fixed + '개 photoURL 복구 완료! (blob: URL은 재업로드 필요)', '🖼️ 복구', 5
  );
}

/* =========================================================
 *  🔄 기존 행 O열 미리보기 일괄 재생성
 *  유효한 http(s) URL이 있는 행에만 IMAGE 공식 적용
 *  ========================================================= */
function rebuildPhotoPreviews() {
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) {
    SpreadsheetApp.getActiveSpreadsheet().toast('데이터가 없어요.', '🖼️', 3);
    return;
  }

  const photoColIdx = HEADERS.indexOf('photoURL'); // 0-based = 11
  const data = sh.getRange(2, photoColIdx + 1, last - 1, 1).getValues();
  let count = 0;

  data.forEach((r, i) => {
    const url = String(r[0] || '');
    const row = i + 2;
    if (url.startsWith('http')) {
      setPhotoPreview_(sh, row, url);
      count++;
    } else {
      // blob: 또는 빈값 → O열 지우기
      sh.getRange(row, 15).clearContent();
    }
  });

  SpreadsheetApp.getActiveSpreadsheet()
    .toast(count + '개 행 미리보기를 업데이트했어요. (blob: URL은 재업로드 필요)', '🖼️ 완료', 5);
}

/* 시트 전체 구조·서식·데이터 유효성 초기화 (메뉴에서 실행) */
function setupSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }

  /* ── 헤더 행 ── */
  sh.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#0e1813')
    .setFontColor('#73d98a')
    .setFontSize(11);
  sh.setFrozenRows(1);

  /* ── 열 너비 ── */
  const colWidths = {
    id:1, createdAt:2, status:3, deal:4, category:5,
    title:6, price:7, desc:8, loc:9, nick:10, uid:11,
    photoURL:12, jjim:13, chats:14
  };
  sh.setColumnWidth(colWidths.id, 140);
  sh.setColumnWidth(colWidths.createdAt, 160);
  sh.setColumnWidth(colWidths.status, 90);
  sh.setColumnWidth(colWidths.deal, 70);
  sh.setColumnWidth(colWidths.category, 100);
  sh.setColumnWidth(colWidths.title, 200);
  sh.setColumnWidth(colWidths.price, 90);
  sh.setColumnWidth(colWidths.desc, 300);
  sh.setColumnWidth(colWidths.loc, 110);
  sh.setColumnWidth(colWidths.nick, 90);
  sh.setColumnWidth(colWidths.uid, 160);
  sh.setColumnWidth(colWidths.photoURL, 220);
  sh.setColumnWidth(colWidths.jjim, 60);
  sh.setColumnWidth(colWidths.chats, 60);

  // O열: 사진 미리보기 (앱 데이터 아님 — 시트 전용 시각화)
  sh.getRange(1, 15)
    .setValue('📷 미리보기')
    .setFontWeight('bold').setBackground('#0e1813').setFontColor('#73d98a').setFontSize(11);
  sh.setColumnWidth(15, 130);

  /* ── 데이터 유효성 (드롭다운) — 2행~1000행 ── */
  const maxRow = 1000;

  // status 드롭다운
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['판매중', '거래완료', '삭제'], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 3, maxRow, 1).setDataValidation(statusRule);

  // deal 드롭다운
  const dealRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['나눔', '판매'], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 4, maxRow, 1).setDataValidation(dealRule);

  // category 드롭다운
  const catRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['전산소모품', '사무용품', '가구·비품', '기타'], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 5, maxRow, 1).setDataValidation(catRule);

  // loc 드롭다운
  const locRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      '본사 1층','본사 2층','본사 3층','본사 4층','본사 5층',
      '별관 A동','별관 B동','분당 사무소','판교 사무소','기타'
    ], true)
    .setAllowInvalid(true) // 직접 입력도 허용
    .build();
  sh.getRange(2, 9, maxRow, 1).setDataValidation(locRule);

  /* ── 조건부 서식 (status 색상) ── */
  const rules = [];

  const soldRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('거래완료')
    .setBackground('#1a3a2a')
    .setFontColor('#52c06e')
    .setRanges([sh.getRange('A2:N1000')])
    .build();
  rules.push(soldRule);

  const delRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('삭제')
    .setBackground('#2a1a1a')
    .setFontColor('#666')
    .setRanges([sh.getRange('A2:N1000')])
    .build();
  rules.push(delRule);

  sh.setConditionalFormatRules(rules);

  /* ── 타임스탬프 초기화 ── */
  PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));

  SpreadsheetApp.getActiveSpreadsheet().toast(
    '매물 시트 구성 완료! (드롭다운·서식·조건부서식 적용됨)',
    '🥒 시트 설정', 5
  );
}

function rowsToObjects_() {
  const sh = getSheet_();
  const dataRange = sh.getDataRange();
  if (dataRange.getNumRows() < 2) return [];

  const values = dataRange.getValues();
  const head = values[0];
  const photoCol = head.indexOf('photoURL'); // 0-based

  // RichText 전체 가져오기 (photoURL 셀이 "이미지 보기" 하이퍼링크일 때 실제 URL 복원용)
  let richTexts = null;
  try { richTexts = dataRange.getRichTextValues(); } catch(_) {}

  return values.slice(1).map((r, i) => {
    const o = {};
    head.forEach((h, c) => { o[h] = r[c]; });
    o._row = i + 2;

    // photoURL 값이 "이미지 보기" 또는 빈값이면 RichText 링크에서 실제 URL 추출
    if (photoCol >= 0 && richTexts) {
      const cellVal = String(r[photoCol] || '');
      if (!cellVal.startsWith('http')) {
        try {
          const rt = richTexts[i + 1][photoCol];
          if (rt) {
            for (const run of rt.getRuns()) {
              const link = run.getLinkUrl();
              if (link && link.startsWith('http')) { o.photoURL = link; break; }
            }
          }
        } catch(_) {}
      }
    }
    return o;
  });
}

/* =========================================================
 *  실시간 동기화 — onEdit 인스톨 트리거
 *  ========================================================= */

/* 시트가 편집될 때마다 호출됨 (installable trigger) */
function onSheetEdit_(e) {
  PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));

  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row < 2) return;

  /* L열(photoURL) 직접 편집 시 → O열 미리보기 자동 갱신 */
  const photoCol = HEADERS.indexOf('photoURL') + 1;
  if (col === photoCol) {
    const url = String(e.range.getValue() || '');
    setPhotoPreview_(sh, row, url);
  }
}

/* 메뉴에서 한 번 실행: onEdit 트리거 등록 */
function initOnEditTrigger() {
  // 기존 동일 핸들러 트리거 제거 (중복 방지)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onSheetEdit_')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('onSheetEdit_')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    '실시간 동기화 트리거 등록 완료! 이제 시트 편집 시 앱이 자동으로 갱신돼요.',
    '🥒 트리거', 5
  );
}

/* =========================================================
 *  1) 읽기 — 앱이 GET 으로 호출
 *     ?action=ping  → lastModified 타임스탬프만 반환 (경량 폴링용)
 *  ========================================================= */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  /* ── ping: 변경 시각만 반환 ── */
  if (params.action === 'ping') {
    const ts = Number(getProp_('LAST_MODIFIED') || 0);
    return json_({ ok: true, lastModified: ts });
  }

  /* ── 채팅 메시지 조회 ── */
  if (params.action === 'chat') {
    return getChatMessages_(params.roomId);
  }

  /* ── 랭킹 ── */
  if (params.action === 'ranking') {
    return getRankingData_();
  }

  /* ── 이미지 프록시: Drive 파일 → base64 (CORS/CORP 완전 우회) ── */
  if (params.action === 'img' && params.id) {
    try {
      const file = DriveApp.getFileById(params.id);
      const blob = file.getBlob();
      return json_({ ok: true, b64: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType() });
    } catch(err) {
      return json_({ ok: false, error: String(err) });
    }
  }

  /* ── 매물 목록 전체 반환 ── */
  const items = rowsToObjects_()
    .filter(o => o.id && o.status !== '삭제')
    .map(o => ({
      id: String(o.id),
      uid: String(o.uid || ''),      // ← 프론트에서 본인 매물 판별에 필수
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

    /* ── 토큰 없이 허용 ── */
    if (body.action === 'sendOtp')    return sendOtp_(body.email);
    if (body.action === 'verifyOtp')  return verifyOtp_(body.email, body.code);
    if (body.action === 'sendChat')   return sendChatMessage_(body.roomId, body.message);
    if (body.action === 'uploadPhoto') {
      const url = uploadToDrive_(body.base64, body.filename, body.mimeType);
      return json_({ ok: true, url });
    }

    /* API_TOKEN 이 설정된 경우에만 검증 — 미설정 시 개방 */
    const savedToken = getProp_('API_TOKEN');
    if (savedToken && body.token !== savedToken) return json_({ ok: false, error: 'unauthorized' });

    let result;
    switch (body.action) {
      case 'create':
        result = json_({ ok: true, id: createItem_(body.item) });
        break;
      case 'update':
        updateItem_(body.id, body.patch || {});
        result = json_({ ok: true });
        break;
      case 'delete':
        deleteItem_(body.id);
        result = json_({ ok: true });
        break;
      case 'setNanumi':
        setProp_('MONTHLY_NANUMI', JSON.stringify({
          uid: body.uid,
          nick: body.nick,
          month: body.month,
          reason: body.reason || '',
          setAt: new Date().toISOString()
        }));
        result = json_({ ok: true });
        break;
      default:
        return json_({ ok: false, error: 'unknown action' });
    }

    /* POST 로 변경된 경우도 타임스탬프 갱신 */
    PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));
    return result;
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
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const cache = CacheService.getScriptCache();
  cache.put('otp_' + email.toLowerCase(), code, 300);

  GmailApp.sendEmail(email, '🥒 오이지마켓 로그인 인증번호', '', {
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

  // 사진 URL이 있으면 L열 하이퍼링크 + O열 미리보기 자동 설정
  const newRow = sh.getLastRow();
  if (item.photoURL && String(item.photoURL).startsWith('http')) {
    setPhotoPreview_(sh, newRow, item.photoURL);
  }
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
  // photoURL 변경 시 미리보기 자동 업데이트
  if (patch.photoURL && String(patch.photoURL).startsWith('http')) {
    setPhotoPreview_(sh, row, patch.photoURL);
  }
}

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
    .addSeparator()
    .addItem('📋 시트 구조 초기화 (서식·드롭다운 적용)', 'setupSheet_')
    .addItem('⚡ 실시간 동기화 트리거 등록', 'initOnEditTrigger')
    .addSeparator()
    .addItem('🔑 Google Drive 권한 초기화 (최초 1회)', 'initPermissions')
    .addItem('🛠️ photoURL 복구 (이미지 보기 → 실제 URL)', 'repairPhotoURLs')
    .addItem('🖼️ 전체 행 사진 미리보기 재생성', 'rebuildPhotoPreviews')
    .addToUi();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('🥒 매물 등록·편집');
  SpreadsheetApp.getUi().showSidebar(html);
}

// google.script.run 은 _ 로 끝나는 함수를 호출할 수 없으므로 public 래퍼 제공
function getSelectedRow() { return getSelectedRow_(); }

/* 사이드바 드롭다운용: 전체 매물 목록 반환 */
function getAllProductsForSidebar() {
  return rowsToObjects_()
    .filter(o => o.id)
    .map(o => ({
      id: String(o.id),
      title: String(o.title || '(제목 없음)'),
      status: String(o.status || '판매중'),
      deal: String(o.deal || '나눔'),
      category: String(o.category || '기타'),
      price: Number(o.price) || 0,
      desc: String(o.desc || ''),
      loc: String(o.loc || ''),
      nick: String(o.nick || ''),
      uid: String(o.uid || ''),
      photoURL: String(o.photoURL || ''),
    }));
}

function getSelectedRow_() {
  const sh = getSheet_();
  const row = sh.getActiveCell().getRow();
  if (row < 2) return null;
  const vals = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const o = { _row: row };
  HEADERS.forEach((h, i) => o[h] = vals[i]);
  return o;
}

function saveFromSidebar(item) {
  let result;
  if (item.id && findRow_(item.id) >= 0) {
    updateItem_(item.id, item);
    result = { ok: true, mode: '수정', id: item.id };
  } else {
    const id = createItem_(item);
    result = { ok: true, mode: '등록', id };
  }
  PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));
  return result;
}

function uploadPhotoFromSidebar(base64, filename, mimeType) {
  const url = uploadToDrive_(base64, filename, mimeType);
  return { ok: true, url };
}

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
  PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));
  SpreadsheetApp.getActiveSpreadsheet().toast('거래완료로 표시했어요', '🥒', 3);
}
function markSelectedDeleted() {
  const o = getSelectedRow_(); if (!o) return;
  deleteItem_(o.id);
  PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));
  SpreadsheetApp.getActiveSpreadsheet().toast('삭제 처리했어요', '🥒', 3);
}

/* =========================================================
 *  Firebase Storage 업로드 (서비스 계정 REST 방식)
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

/* =========================================================
 *  채팅 — 구글시트 '채팅' 시트에 메시지 저장
 *  roomId = {productId}__{sorted(uid1, uid2)}
 *  ========================================================= */
const CHAT_SHEET = '채팅';
const CHAT_HEADERS = ['roomId', 'msgId', 'senderUid', 'senderNick', 'text', 'createdAt'];

function getChatSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CHAT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CHAT_SHEET);
    sh.appendRow(CHAT_HEADERS);
    sh.getRange(1, 1, 1, CHAT_HEADERS.length)
      .setFontWeight('bold').setBackground('#0e1813').setFontColor('#73d98a');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 240); // roomId
    sh.setColumnWidth(2, 160); // msgId
    sh.setColumnWidth(3, 200); // senderUid
    sh.setColumnWidth(4, 100); // senderNick
    sh.setColumnWidth(5, 400); // text
    sh.setColumnWidth(6, 160); // createdAt
  }
  return sh;
}

function getChatMessages_(roomId) {
  if (!roomId) return json_({ ok: false, error: 'roomId required' });
  const sh = getChatSheet_();
  const data = sh.getDataRange().getValues();
  const head = data.shift();
  const ridIdx = head.indexOf('roomId');

  const messages = data
    .filter(r => String(r[ridIdx]) === String(roomId))
    .map(r => {
      const o = {};
      head.forEach((h, i) => o[h] = r[i]);
      return {
        id: String(o.msgId),
        senderUid: String(o.senderUid),
        senderNick: String(o.senderNick),
        text: String(o.text),
        createdAt: o.createdAt ? new Date(o.createdAt).getTime() : 0
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  return json_({ ok: true, messages });
}

function sendChatMessage_(roomId, msg) {
  if (!roomId || !msg || !msg.text || !msg.text.trim()) {
    return json_({ ok: false, error: 'invalid' });
  }
  const sh = getChatSheet_();
  const msgId = 'msg-' + Date.now();
  sh.appendRow([
    roomId,
    msgId,
    msg.senderUid || '',
    msg.senderNick || '익명',
    msg.text.trim(),
    new Date()
  ]);
  // 채팅도 lastModified 갱신
  PropertiesService.getScriptProperties().setProperty('LAST_MODIFIED', String(Date.now()));
  return json_({ ok: true, id: msgId });
}

/* ---------- 공통 ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function getProp_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}
function setProp_(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, v);
}

/* ─── 랭킹 집계 ─────────────────────────────────────────── */
function getRankingData_() {
  const all = rowsToObjects_();
  const active = all.filter(o => o.id && o.status !== '삭제');

  const map = {};
  active.forEach(o => {
    const uid = String(o.uid || '').trim();
    const nick = String(o.nick || '익명').trim();
    if (!uid) return;
    if (!map[uid]) map[uid] = { uid, nick, total: 0, nanum: 0, sale: 0 };
    map[uid].total++;
    if (o.deal === '나눔') map[uid].nanum++;
    if (o.deal === '판매') map[uid].sale++;
  });

  // 포인트: 나눔 1건 = 3점, 판매 1건 = 2점
  const ranking = Object.values(map)
    .map(s => ({ ...s, points: s.nanum * 3 + s.sale * 2 }))
    .sort((a, b) => b.points - a.points);

  const raw = getProp_('MONTHLY_NANUMI');
  const monthlyNanumi = raw ? JSON.parse(raw) : null;

  return json_({ ok: true, ranking, monthlyNanumi });
}
