// ═══ Firebase ═══
const firebaseConfig = {
  apiKey: "AIzaSyC3ssZkQtJZU7dTXwwud8oZa1sep_KK4wM",
  authDomain: "taeju-repair-log.firebaseapp.com",
  projectId: "taeju-repair-log",
  storageBucket: "taeju-repair-log.firebasestorage.app",
  messagingSenderId: "127515248442",
  appId: "1:127515248442:web:f4be7d9fbdb0024af9b203"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ═══ State ═══
const APP = '태주전자 수리 일지';
let currentUser = null, records = [], favTags = [], aTags = [], aBlks = [];
let view = 'home', activeTag = null, sidebarModel = null;
let sortMode = 'newest', sbSort = 'alpha';
let editingId = null, unsubRecords = null, unsubComments = null;
let notifEnabled = false, isRegistering = false;

// ═══ Utils ═══
function ld(on, msg=''){const el=document.getElementById('ld');el.className='ld'+(on?' on':'');if(msg)document.getElementById('ldMsg').textContent=msg;}
function toast(msg,type=''){const el=document.getElementById('toast');el.textContent=msg;el.className='toast show '+(type||'');setTimeout(()=>el.className='toast',2600);}
function esc(s){return String(s).replace(/'/g,"\\'")}
function fd(d){if(!d)return'';return new Date(d).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});}
function fdFull(d){if(!d)return'';return new Date(d).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});}
function timeAgo(d){if(!d)return'';const diff=(Date.now()-new Date(d))/1000;if(diff<60)return '방금';if(diff<3600)return Math.floor(diff/60)+'분 전';if(diff<86400)return Math.floor(diff/3600)+'시간 전';return Math.floor(diff/86400)+'일 전';}
function hl(text,q){if(!q||!text)return text||'';const idx=text.toLowerCase().indexOf(q.toLowerCase());if(idx<0)return text;return text.slice(0,idx)+'<span class="hl">'+text.slice(idx,idx+q.length)+'</span>'+text.slice(idx+q.length);}
const TICO={액정:'ti-device-mobile',배터리:'ti-battery-charging',충전:'ti-plug',카메라:'ti-camera',스피커:'ti-volume',마이크:'ti-microphone',수분:'ti-droplet',기판:'ti-cpu',삼성:'ti-device-mobile',애플:'ti-brand-apple',아이폰:'ti-brand-apple',갤럭시:'ti-device-mobile',픽셀:'ti-brand-google',후면:'ti-square-rounded',버튼:'ti-square'};
function ticon(t){const k=Object.keys(TICO).find(k=>t.includes(k));return k?TICO[k]:'ti-hash';}

// ═══ Auth State ═══
auth.onAuthStateChanged(async(fu)=>{
  if(isRegistering)return;
  if(fu){
    ld(true,'사용자 확인 중...');
    try{
      const doc=await db.collection('users').doc(fu.uid).get();
      if(doc.exists){
        const ud=doc.data();
        if(ud.status==='pending'){await auth.signOut();showAuthScreen();showLogin('⏳ 마스터 승인 후 로그인 가능합니다.');ld(false);return;}
        currentUser={uid:fu.uid,...ud};
        await enterApp();
      }else{await auth.signOut();}
    }catch(e){console.error(e);ld(false);showAuthScreen();}
  }else{
    ld(true,'초기화 중...');
    currentUser=null;
    if(unsubRecords){unsubRecords();unsubRecords=null;}
    try{
      const snap=await db.collection('users').limit(1).get();
      showAuthScreen();
      if(snap.empty)showRegister(true);else showLogin();
    }catch(e){showAuthScreen();showLogin();}
    ld(false);
  }
});

function showAuthScreen(){document.getElementById('appScr').style.display='none';document.getElementById('authScr').style.display='flex';}

function showLogin(msg){
  document.getElementById('authCard').innerHTML=`
    <div class="auth-logo"><img src="" alt="태주전자">
    <div class="auth-title">${APP}</div>
    <div class="auth-sub">아이디와 비밀번호로 로그인하세요.</div></div>
    ${msg?`<div class="auth-ok" style="display:block">${msg}</div>`:''}
    <div id="ae" class="auth-err"></div>
    <div class="af"><label>아이디</label><input type="text" id="lid" placeholder="아이디" onkeydown="if(event.key==='Enter')document.getElementById('lpw').focus()"></div>
    <div class="af"><label>비밀번호</label><input type="password" id="lpw" placeholder="비밀번호" onkeydown="if(event.key==='Enter')doLogin()"></div>
    <button class="btn-main" id="loginBtn" onclick="doLogin()">로그인</button>
    <div class="auth-sw">계정이 없으신가요? <a onclick="showRegister(false)">회원가입</a></div>`;
  setTimeout(()=>{const e=document.getElementById('lid');if(e)e.focus();},100);
}

function showRegister(isFirst){
document.getElementById('authCard').innerHTML=`
    <div class="auth-logo"><img src="" alt="태주전자">
    <div class="auth-title">${APP}</div>
    <div class="auth-sub">${isFirst?'처음 가입하는 계정은 <strong>마스터</strong>가 됩니다.':'새 계정을 만들어주세요.'}</div></div>
    <div id="ae" class="auth-err"></div>
    <div class="af"><label>아이디</label><input type="text" id="rid" placeholder="아이디"></div>
    <div class="af"><label>비밀번호</label><input type="password" id="rpw" placeholder="비밀번호 (6자 이상)"></div>
    <div class="af"><label>비밀번호 확인</label><input type="password" id="rpw2" placeholder="재입력" onkeydown="if(event.key==='Enter')doRegister(${isFirst})"></div>
    <button class="btn-main" id="regBtn" onclick="doRegister(${isFirst})">${isFirst?'마스터 계정 만들기':'계정 만들기'}</button>
    ${!isFirst?`<div class="auth-sw">이미 계정이 있으신가요? <a onclick="showLogin()">로그인</a></div>`:''}`;
  setTimeout(()=>{const e=document.getElementById('rid');if(e)e.focus();},100);
}

async function doLogin(){
  const username=document.getElementById('lid').value.trim(),pw=document.getElementById('lpw').value,e=document.getElementById('ae');
  e.style.display='none';
  if(!username||!pw){e.textContent='아이디와 비밀번호를 입력해주세요';e.style.display='block';return;}
  const btn=document.getElementById('loginBtn');btn.disabled=true;btn.textContent='로그인 중...';
  try{
    const q=await db.collection('users').where('username','==',username).limit(1).get();
    if(q.empty)throw new Error('not-found');
    const ud=q.docs[0].data();
    if(ud.status==='pending'){e.textContent='⏳ 마스터 승인 후 로그인 가능합니다.';e.style.display='block';btn.disabled=false;btn.textContent='로그인';return;}
    await auth.signInWithEmailAndPassword(ud.email,pw);
  }catch(err){e.textContent='아이디 또는 비밀번호가 올바르지 않아요';e.style.display='block';btn.disabled=false;btn.textContent='로그인';if(document.getElementById('lpw'))document.getElementById('lpw').value='';}
}

async function doRegister(isFirst){
  const username=document.getElementById('rid').value.trim(),pw=document.getElementById('rpw').value,pw2=document.getElementById('rpw2').value,e=document.getElementById('ae');
  e.style.display='none';
  if(!username){e.textContent='아이디를 입력해주세요';e.style.display='block';return;}
  if(pw.length<6){e.textContent='비밀번호는 6자 이상이어야 해요';e.style.display='block';return;}
  if(pw!==pw2){e.textContent='비밀번호가 일치하지 않아요';e.style.display='block';return;}
  const btn=document.getElementById('regBtn');btn.disabled=true;btn.textContent='처리 중...';
  isRegistering=true;
  try{
    const q=await db.collection('users').where('username','==',username).limit(1).get();
    if(!q.empty){e.textContent='이미 사용 중인 아이디예요';e.style.display='block';btn.disabled=false;btn.textContent='계정 만들기';isRegistering=false;return;}
    const snap=await db.collection('users').limit(1).get();
    const willBeMaster=snap.empty;
    const fakeEmail=`u${Date.now()}${Math.random().toString(36).slice(2,6)}@taeju.repair`;
    const cred=await auth.createUserWithEmailAndPassword(fakeEmail,pw);
    const userData={username,email:fakeEmail,isMaster:willBeMaster,canDelete:willBeMaster,status:willBeMaster?'approved':'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()};
    await db.collection('users').doc(cred.user.uid).set(userData);
    isRegistering=false;
    if(willBeMaster){currentUser={uid:cred.user.uid,...userData};await enterApp();}
    else{await auth.signOut();showAuthScreen();showLogin('✅ 가입 신청 완료! 마스터 승인 후 로그인하세요.');}
  }catch(err){console.error(err);e.textContent='계정 생성에 실패했어요.';e.style.display='block';btn.disabled=false;btn.textContent='계정 만들기';isRegistering=false;}
}

// ═══ App Entry ═══
async function enterApp(){
  document.getElementById('authScr').style.display='none';
  document.getElementById('appScr').style.display='flex';
  const chip=document.getElementById('userChip');
  chip.innerHTML=`<i class="ti ${currentUser.isMaster?'ti-shield-check':'ti-user'}" style="font-size:13px"></i>${currentUser.username}`;
  chip.className='user-chip'+(currentUser.isMaster?' master':'');
  const fab=document.getElementById('fab');
  if(fab)fab.style.display='flex';
  const sbAvatar=document.getElementById('sbUserAvatar');
  const sbName=document.getElementById('sbUserName');
  const sbBadge=document.querySelector('.sb-user-badge');
  if(sbAvatar)sbAvatar.textContent=(currentUser.username||'?').charAt(0).toUpperCase();
  if(sbName){
    sbName.textContent=currentUser.username||'사용자';
    if(currentUser.isMaster){
      sbName.insertAdjacentHTML('afterend','<span class="sb-user-badge">마스터</span>');
    }
  }
  try{
    const fd=await db.collection('users').doc(currentUser.uid).collection('prefs').doc('favTags').get();
    favTags=fd.exists?(fd.data().tags||[]):[];
    const nd=await db.collection('users').doc(currentUser.uid).collection('prefs').doc('notif').get();
    notifEnabled=nd.exists?(nd.data().enabled||false):false;
  }catch(e){favTags=[];}
  subscribeRecords();
  ld(false);
}

function subscribeRecords(){
  if(unsubRecords)unsubRecords();
  const prev=records.length;
  unsubRecords=db.collection(currentBoardCollection).orderBy('date','desc').onSnapshot(snap=>{
    const newRecs=snap.docs.map(d=>({id:d.id,...d.data()}));
    
    if(prev>0&&notifEnabled&&newRecs.length>records.length){
      const added=newRecs.find(r=>!records.find(x=>x.id===r.id));
      if(added&&added.createdBy!==currentUser.uid) triggerNotif(added);
    }
    records=newRecs;

    const isOverlayOpen = document.getElementById('overlay').classList.contains('on');
    if (!isOverlayOpen) {
      render();
    }
    
    renderSidebar();
  },err=>console.error(err));
}

// ═══ Notifications ═══
async function toggleNotif(val){
  notifEnabled=val;
  if(val&&Notification.permission==='default'){
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){notifEnabled=false;toast('알림 권한이 거부됐어요','err');renderSettingsSheet();return;}
  }
  await db.collection('users').doc(currentUser.uid).collection('prefs').doc('notif').set({enabled:notifEnabled});
  toast(notifEnabled?'알림이 켜졌어요 🔔':'알림이 꺼졌어요');
}

function triggerNotif(rec){
  if(!notifEnabled||Notification.permission!=='granted')return;
  try{new Notification('태주전자 수리 일지',{body:`${rec.assignee||'누군가'}가 ${rec.model||'수리 기록'}을 추가했어요`,icon:''});}catch(e){}
}

// ═══ Sidebar ═══
function openSidebar(){
  location.hash = 'sidebar';
  document.getElementById('sidebar').classList.add('on');
  document.getElementById('sbOverlay').classList.add('on');
  renderSidebar();
}

function closeSidebar(){
  if(location.hash === '#sidebar') history.back();
  document.getElementById('sidebar').classList.remove('on');
  document.getElementById('sbOverlay').classList.remove('on');
}

function setSbSort(s){
  sbSort=s;
  ['alpha','ralpha','count','recent'].forEach(k=>{document.getElementById('sbs-'+k)?.classList.toggle('on',k===s);});
  renderSidebar();
}

function renderSidebar(){
  const cnt={};
  const latest={};
  records.forEach(r=>{
    const m=r.model||'미입력';
    cnt[m]=(cnt[m]||0)+1;
    if(!latest[m]||r.date>latest[m])latest[m]=r.date;
  });
  let models=Object.keys(cnt);
  if(sbSort==='alpha')models.sort((a,b)=>a.localeCompare(b,'ko'));
  else if(sbSort==='ralpha')models.sort((a,b)=>b.localeCompare(a,'ko'));
  else if(sbSort==='count')models.sort((a,b)=>cnt[b]-cnt[a]);
  else if(sbSort==='recent')models.sort((a,b)=>(latest[b]||'').localeCompare(latest[a]||''));

  const active=sidebarModel;
  const el=document.getElementById('sbList');
  const allActive=!active;
  el.innerHTML=`
    <div class="sb-all${allActive?' active':''}" onclick="sbSelectModel(null)">
      <div class="sb-all-ico"><i class="ti ti-layout-grid"></i></div>
      <span class="sb-all-name">전체 보기</span>
      <span class="sb-all-cnt">${records.length}</span>
    </div>
    ${models.map(m=>`
      <div class="sb-item${active===m?' active':''}" onclick="sbSelectModel('${esc(m)}')">
        <div class="sb-ico"><i class="ti ${ticon(m)}"></i></div>
        <span class="sb-name">${m}</span>
        <span class="sb-cnt">${cnt[m]}</span>
      </div>`).join('')}`;
}

function sbSelectModel(m){
  sidebarModel=m;
  activeTag=null;
  view=m?'records':'home';
  closeSidebar();
  render();
}

// ═══ Search / Filter / Sort ═══
function getQ(){return(document.getElementById('searchInput')?.value||'').trim().toLowerCase().replace(/^#/,'');}
function filteredTags(q){
  const cnt={};records.forEach(r=>(r.tags||[]).forEach(t=>{cnt[t]=(cnt[t]||0)+1;}));
  const all=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
  return q?all.filter(([t])=>t.toLowerCase().includes(q)):all;
}
function applySort(arr){
  const a=[...arr];
  if(sortMode==='newest')return a.sort((x,y)=>(y.date||'').localeCompare(x.date||''));
  if(sortMode==='oldest')return a.sort((x,y)=>(x.date||'').localeCompare(y.date||''));
  if(sortMode==='model')return a.sort((x,y)=>(x.model||'').localeCompare(y.model||'','ko'));
  if(sortMode==='assignee')return a.sort((x,y)=>(x.assignee||'').localeCompare(y.assignee||'','ko'));
  return a;
}
function filteredRecords(q,tagFilter,modelFilter){
  let base=records;
  if(modelFilter)base=base.filter(r=>(r.model||'미입력')===modelFilter);
  if(tagFilter)base=base.filter(r=>(r.tags||[]).includes(tagFilter));
  if(q)base=base.filter(r=>(r.model||'').toLowerCase().includes(q)||(r.tags||[]).join(' ').toLowerCase().includes(q)||(r.firstText||'').toLowerCase().includes(q)||(r.assignee||'').toLowerCase().includes(q));
  return applySort(base);
}
function setSort(s){sortMode=s;render();}
function onSearch(){render();}

// ═══ Render ═══
function render() {
  if (!currentUser) return;
  const m = document.getElementById('main');
  const bb = document.getElementById('backBtn');
  const ht = document.getElementById('hdrTitle');

  if (records.length === 0 && !getQ() && !activeTag && !sidebarModel) {
    if (m.innerHTML.includes('rcard') || m.innerHTML.includes('tag-tile')) return;
    m.innerHTML = `<div class="empty"><div class="spin" style="margin:0 auto 14px"></div><p>기록을 불러오는 중입니다...</p></div>`;
    return;
  }

  if (view === 'home' && !sidebarModel) {
    bb.classList.remove('on');
    ht.textContent = '수리 일지';
    renderHome(m);
  } else {
    bb.classList.add('on');
    ht.textContent = sidebarModel ? sidebarModel : (activeTag ? '#' + activeTag : '전체 기록');
    renderRecs(m);
  }
}

function sortUI(){
  const labels={newest:'최신순',oldest:'오래된순',model:'모델명순',assignee:'담당자순'};
  return`<div class="sort-row">${Object.entries(labels).map(([k,v])=>`<button class="sort-btn${sortMode===k?' on':''}" onclick="setSort('${k}')">${v}</button>`).join('')}</div>`;
}

function renderHome(el){
  const q=getQ(),tags=filteredTags(q),searchRecs=q?filteredRecords(q,null,null):[],recent=!q?applySort(records).slice(0,4):[];
  if(!tags.length&&!searchRecs.length&&!recent.length){el.innerHTML=`<div class="empty"><i class="ti ti-device-mobile"></i><p>아직 수리 기록이 없어요.<br>추가 버튼으로 시작해보세요.</p></div>`;return;}
  let html='';
  if(tags.length)html+=`<div class="sec-label">태그 아카이브</div><div class="tag-grid">${tags.map(([t,c])=>`<div class="tag-tile" onclick="openTag('${esc(t)}')"><div class="tt-ico"><i class="ti ${ticon(t)}"></i></div><span class="tt-name">${q?hl('#'+t,'#'+q):'#'+t}</span><span class="tt-cnt">${c}</span></div>`).join('')}</div>`;
  if(q&&searchRecs.length)html+=`<div class="search-div"><span>검색 결과 ${searchRecs.length}건</span></div>${sortUI()}<div class="rlist">${searchRecs.map(r=>rcHTML(r,q)).join('')}</div>`;
  else if(q&&!searchRecs.length&&!tags.length)html+=`<div class="no-result"><i class="ti ti-search-off" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>"${q}"에 해당하는 결과가 없어요</div>`;
  if(!q&&recent.length)html+=`<div style="margin-top:${tags.length?22:0}px"><div class="sec-label" style="display:flex;align-items:center;justify-content:space-between">최근 기록 ${records.length>4?`<button onclick="openAll()" style="font-family:var(--font);font-size:12px;font-weight:600;color:var(--accent);background:none;border:none;cursor:pointer;text-decoration:underline">전체보기</button>`:''}</div>${sortUI()}<div class="rlist">${recent.map(r=>rcHTML(r,'')).join('')}</div></div>`;
  el.innerHTML=html;
}

function renderRecs(el){
  const q=getQ(),items=filteredRecords(q,activeTag,sidebarModel);
  if(!items.length){el.innerHTML=`<div class="empty"><i class="ti ti-file-off"></i><p>기록이 없습니다.</p></div>`;return;}
  el.innerHTML=`<div class="sec-label">${items.length}건</div>${sortUI()}<div class="rlist">${items.map(r=>rcHTML(r,q)).join('')}</div>`;
}

function rcHTML(r,q){
  const model=q?hl(r.model||'모델 미입력',q):r.model||'모델 미입력';
  const exc=r.firstText?(q?hl(r.firstText,q):r.firstText):'';
  const cmtCnt=r.commentCount||0;
  return`<div class="rcard" onclick="openDetail('${r.id}')">
    ${r.thumbUrl?`<img class="rc-img" src="${r.thumbUrl}" alt="">` :''}
    <div class="rc-body">
      <div class="rc-top"><div class="rc-model">${model}</div>${r.assignee?`<span class="rc-assignee">${r.assignee}</span>`:''}</div>
      ${exc?`<div class="rc-exc">${exc}</div>`:''}
      <div class="rc-foot">
        <div class="rc-tags">${(r.tags||[]).map(t=>`<span class="pill">${q?hl('#'+t,'#'+q):'#'+t}</span>`).join('')}</div>
        <span class="rc-date">${fd(r.date)}</span>
      </div>
      ${cmtCnt?`<div class="rc-meta-row"><span class="rc-comment-cnt"><i class="ti ti-message-2"></i>${cmtCnt}개의 댓글</span></div>`:''}
    </div>
  </div>`;
}

function openTag(t){activeTag=t;sidebarModel=null;view='records';render();}
function openAll(){activeTag=null;sidebarModel=null;view='records';render();}
function goHome(){activeTag=null;sidebarModel=null;view='home';render();}

// ═══ Favs ═══
async function saveFavs(){if(!currentUser)return;try{await db.collection('users').doc(currentUser.uid).collection('prefs').doc('favTags').set({tags:favTags});}catch(e){}}
function getQuickTags(){
  const cnt={};records.forEach(r=>(r.tags||[]).forEach(t=>{cnt[t]=(cnt[t]||0)+1;}));
  const starred=favTags.filter(t=>!aTags.includes(t));
  const byFreq=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([t])=>t).filter(t=>!favTags.includes(t)&&!aTags.includes(t));
  return[...starred,...byFreq].slice(0,12);
}
function toggleFav(t){if(favTags.includes(t))favTags=favTags.filter(x=>x!==t);else favTags=[...favTags,t];saveFavs();renderFavRow();}
function pickFavTag(t){if(aTags.includes(t))return;aTags.push(t);renderTChips();renderFavRow();}
function renderFavRow(){
  const el=document.getElementById('favRow');if(!el)return;
  const q=getQuickTags();
  if(!q.length){el.innerHTML=`<span style="font-size:11px;color:var(--hint)">태그를 추가하면 여기 표시돼요</span>`;return;}
  el.innerHTML=q.map(t=>{const isFav=favTags.includes(t),isUsed=aTags.includes(t);return`<button class="fav-btn${isUsed?' used':''}" onclick="pickFavTag('${esc(t)}')"><i class="ti ${ticon(t)}"></i>#${t}<button class="fav-star${isFav?' on':''}" onclick="event.stopPropagation();toggleFav('${esc(t)}')"><i class="ti ${isFav?'ti-star-filled':'ti-star'}"></i></button></button>`;}).join('');}
function tagKey(e){
  const inp=document.getElementById('tfield'),v=inp.value.replace(/^#/,'').replace(/,/g,'').trim();
  if((e.key==='Enter'||e.key===',')&&v){e.preventDefault();if(!aTags.includes(v)){aTags.push(v);renderTChips();renderFavRow();}inp.value='';}
  else if(e.key==='Backspace'&&!inp.value&&aTags.length){aTags.pop();renderTChips();renderFavRow();}
}
function renderTChips(){const el=document.getElementById('tchips');if(el)el.innerHTML=aTags.map((t,i)=>`<span class="tchip">#${t}<button onclick="rmTag(${i})">×</button></span>`).join('');}
function rmTag(i){aTags.splice(i,1);renderTChips();renderFavRow();}

// ═══ Form (Add / Edit) ═══
function openAdd(){aBlks=[];aTags=[];editingId=null;openForm(null);}
function openEdit(id){
  const rec=records.find(r=>r.id===id);if(!rec)return;
  editingId=id;aBlks=(rec.blocks||[]).map(b=>({...b}));aTags=[...(rec.tags||[])];
  closeSheet();setTimeout(()=>openForm(rec),50);
}
function openForm(rec){
  if (location.hash === '#sidebar') {
    location.replace('#sheet');
    document.getElementById('sidebar').classList.remove('on');
    document.getElementById('sbOverlay').classList.remove('on');
  } else {
    location.hash = 'sheet';
  }
  document.getElementById('overlay').classList.add('on');
  const allA=[...new Set(records.map(r=>r.assignee).filter(Boolean))];
  const aOpts=allA.length?`<datalist id="aList">${allA.map(a=>`<option value="${a}">`).join('')}</datalist>`:'';
  document.getElementById('sheet').innerHTML=`<div class="sh-handle"></div>
  <div class="sh-title">${rec?'수리 기록 수정':'수리 기록 추가'}<button class="btn-x" onclick="closeSheet()"><i class="ti ti-x"></i></button></div>
  <div class="frow">
    <div class="fl"><label>제조사</label><select id="fmk"><option${rec?.model?.startsWith('Samsung')?' selected':''}>Samsung</option><option${rec?.model?.startsWith('Apple')?' selected':''}>Apple</option><option${rec?.model?.startsWith('LG')?' selected':''}>LG</option><option${rec?.model?.startsWith('Xiaomi')?' selected':''}>Xiaomi</option><option${rec?.model?.startsWith('Google')?' selected':''}>Google</option><option>기타</option></select></div>
    <div class="fl"><label>모델명</label><input type="text" id="fmd" placeholder="S24, iPhone 15..." value="${rec?rec.model?.split(' ').slice(1).join(' ')||'':''}"></div>
  </div>
  <div class="fl"><label>담당자</label>${aOpts}<input type="text" id="fassignee" placeholder="담당자" value="${rec?.assignee||currentUser.username}" list="aList"></div>
  <div class="fl"><label>해시태그</label>
    <div class="tag-wrap" onclick="document.getElementById('tfield').focus()"><span id="tchips"></span><input class="tag-field" id="tfield" placeholder="#태그 입력 후 Enter"></div>
    <div class="fav-row" id="favRow"></div>
    <p class="fhint">★ 별표로 즐겨찾기 고정 · 클릭으로 빠른 추가</p>
  </div>
  <div class="fl"><label>본문</label><div class="block-list" id="blist"></div>
    <div class="add-blk-row">
      <button class="btn-blk" onclick="openDrawPicker()"><i class="ti ti-photo-plus"></i> 마크업 사진</button>
      <button class="btn-blk" onclick="addTxtBlk()"><i class="ti ti-text-plus"></i> 텍스트</button>
    </div>
  </div>
  <button class="btn-save" id="saveBtn" onclick="submitForm()">${rec?'<i class="ti ti-check"></i> 수정 완료':'<i class="ti ti-device-floppy"></i> 저장하기'}</button>`;
  document.getElementById('tfield').addEventListener('keydown',tagKey);
  renderTChips();renderFavRow();renderBlks();
}

function renderBlks(){
  const el=document.getElementById('blist');if(!el)return;
  el.innerHTML=aBlks.map((b,i)=>`<div class="blk" data-i="${i}">
    ${b.type==='image'?`<img src="${b.previewUrl||b.url||''}" alt="">`:
    `<textarea onchange="aBlks[${i}].content=this.value" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" placeholder="텍스트를 입력하세요...">${b.content||''}</textarea>`}
    <div class="blk-actions">
      ${i>0?`<button class="blk-btn" onclick="moveBlk(${i},-1)" title="위로"><i class="ti ti-chevron-up"></i></button>`:''}
      ${i<aBlks.length-1?`<button class="blk-btn" onclick="moveBlk(${i},1)" title="아래로"><i class="ti ti-chevron-down"></i></button>`:''}
      <button class="blk-btn del" onclick="rmBlk(${i})" title="삭제"><i class="ti ti-trash"></i></button>
    </div>
  </div>`).join('');
  el.querySelectorAll('textarea').forEach(t=>{t.style.height='auto';t.style.height=t.scrollHeight+'px';});
}

function moveBlk(i,dir){
  const ni=i+dir;if(ni<0||ni>=aBlks.length)return;
  [aBlks[i],aBlks[ni]]=[aBlks[ni],aBlks[i]];renderBlks();
}
function addImgBlk(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=e=>{const f=e.target.files[0];if(!f)return;aBlks.push({type:'image',file:f,previewUrl:URL.createObjectURL(f)});renderBlks();};inp.click();
}
function addTxtBlk(){aBlks.push({type:'text',content:''});renderBlks();setTimeout(()=>{const ts=document.querySelectorAll('.blk textarea');if(ts.length)ts[ts.length-1].focus();},50);}
function rmBlk(i){if(aBlks[i].previewUrl&&aBlks[i].file)URL.revokeObjectURL(aBlks[i].previewUrl);aBlks.splice(i,1);renderBlks();}

async function uploadFile(file,path){const ref=storage.ref(path);await ref.put(file);return ref.getDownloadURL();}
async function makeThumb(src){return new Promise(res=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),M=320,ratio=Math.min(M/img.width,M/img.height);c.width=img.width*ratio;c.height=img.height*ratio;c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(async blob=>{try{const path=`thumbs/${Date.now()}.jpg`;const ref=storage.ref(path);await ref.put(blob);res(await ref.getDownloadURL());}catch(e){res(null);}}, 'image/jpeg',.75);};img.onerror=()=>res(null);img.src=src;});}

async function submitForm(){
  document.querySelectorAll('.blk[data-i] textarea').forEach(ta=>{const i=parseInt(ta.closest('[data-i]').dataset.i);if(aBlks[i])aBlks[i].content=ta.value;});
  const ti=document.getElementById('tfield');if(ti){const v=ti.value.replace(/^#/,'').replace(/,/g,'').trim();if(v&&!aTags.includes(v))aTags.push(v);}
  const maker=document.getElementById('fmk')?.value,mp=document.getElementById('fmd')?.value.trim();
  const model=[maker,mp].filter(Boolean).join(' ');
  const assignee=document.getElementById('fassignee')?.value.trim()||currentUser.username;
  const btn=document.getElementById('saveBtn');btn.disabled=true;btn.innerHTML='<i class="ti ti-loader"></i> 저장 중...';
  ld(true,'이미지 업로드 중...');
  try{
    const recId=editingId||db.collection(currentBoardCollection).doc().id;
    const processedBlocks=[];
    let thumbUrl=editingId?(records.find(r=>r.id===editingId)?.thumbUrl||null):null;
    let firstNewImgPreview=null;
    for(let i=0;i<aBlks.length;i++){
      const b=aBlks[i];
      if(b.type==='image'){
        if(b.file){const url=await uploadFile(b.file,`images/${recId}/${Date.now()}_${i}.jpg`);processedBlocks.push({type:'image',url,path:`images/${recId}/${Date.now()}_${i}.jpg`});if(!firstNewImgPreview)firstNewImgPreview=b.previewUrl;}
        else processedBlocks.push({type:'image',url:b.url,path:b.path||''});
      }else processedBlocks.push({type:'text',content:b.content||''});
    }
    if(firstNewImgPreview){ld(true,'썸네일 생성 중...');const t=await makeThumb(firstNewImgPreview);if(t)thumbUrl=t;}
    const firstText=(processedBlocks.find(b=>b.type==='text')?.content||'').slice(0,120);
    const now=new Date().toISOString();
    ld(true,'저장 중...');
    const histEntry={by:currentUser.username,at:now,action:editingId?'edited':'created'};
    
    if(editingId){
      const old=records.find(r=>r.id===editingId);
      const hist=[...(old?.history||[]),histEntry];
      await db.collection(currentBoardCollection).doc(editingId).update({model,assignee,tags:[...aTags],blocks:processedBlocks,thumbUrl,firstText,updatedAt:now,history:hist});
    }else{
      await db.collection(currentBoardCollection).doc(recId).set({model,assignee,tags:[...aTags],blocks:processedBlocks,thumbUrl,firstText,date:now,updatedAt:null,createdBy:currentUser.uid,history:[histEntry],commentCount:0});
    }
    editingId=null;closeSheet();toast(editingId?'수정됐어요!':'저장됐어요!','ok');
  }catch(err){console.error(err);toast('저장에 실패했어요','err');btn.disabled=false;btn.innerHTML='<i class="ti ti-device-floppy"></i> 저장하기';}
  finally{ld(false);}
}

// ═══ Detail ═══
async function openDetail(id){
  location.hash = 'sheet';
  document.getElementById('overlay').classList.add('on');
  document.getElementById('sheet').innerHTML=`<div class="sh-handle"></div><div style="text-align:center;padding:32px;color:var(--hint)"><div class="spin" style="margin:0 auto"></div></div>`;
  const rec=records.find(r=>r.id===id);if(!rec){closeSheet();return;}
  renderDetailHTML(rec);
  loadComments(id);
}

function renderDetailHTML(r){
  const canDel=currentUser.isMaster||currentUser.canDelete;
  document.getElementById('sheet').innerHTML=`<div class="sh-handle"></div>
  <div class="sh-title">${r.model||'수리 기록'}<button class="btn-x" onclick="closeSheet()"><i class="ti ti-x"></i></button></div>
  ${(r.tags||[]).length?`<div class="det-tags">${r.tags.map(t=>`<span class="pill">#${t}</span>`).join('')}</div>`:''}
  <div class="det-meta">
    <span class="det-meta-item"><i class="ti ti-calendar"></i>${fdFull(r.date)}</span>
    ${r.assignee?`<span class="det-meta-item"><i class="ti ti-user"></i>${r.assignee}</span>`:''}
    ${r.updatedAt?`<span class="det-meta-item"><i class="ti ti-pencil"></i>수정됨</span>`:''}
  </div>
  ${(r.blocks||[]).map((b,bi)=>`<div class="vblk">${b.type==='image'?`<div class="vblk-img-wrap" style="text-align:center"><img id="vimg_${bi}" src="${b.url}" alt="" style="width:50%;max-height:none;object-fit:contain;border-radius:13px;border:1px solid var(--border);display:inline-block;cursor:zoom-in;transition:width .2s" onclick="window.open('${b.url}','_blank')"><button class="img-copy-btn" onclick="copyImg('${b.url}')"><i class="ti ti-copy"></i> 복사</button></div><div class="img-size-bar">${['S','M','L','전체'].map(s=>`<button class="img-size-btn${s==='M'?' on':''}" onclick="setImgSize(this,'vimg_${bi}','${s}')">${s}</button>`).join('')}</div>`:b.content?`<p>${b.content}</p>`:''}</div>`).join('')}
  <div class="det-btn-row">
    <button class="btn-edit" onclick="openEdit('${r.id}')"><i class="ti ti-pencil"></i> 수정</button>
    ${canDel?`<button class="btn-del" onclick="doDel('${r.id}')"><i class="ti ti-trash"></i> 삭제</button>`:`<button class="btn-del" disabled style="opacity:.3;cursor:not-allowed"><i class="ti ti-lock"></i> 권한 없음</button>`}
  </div>
  ${(r.history||[]).length?`<div class="hist-section">
    <div class="hist-title" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'flex':'none'"><i class="ti ti-history"></i>수정 이력 (${r.history.length})</div>
    <div class="hist-list" style="display:flex;flex-direction:column">${[...(r.history||[])].reverse().map(h=>`
      <div class="hist-item">
        <div class="hist-dot ${h.action}"><i class="ti ${h.action==='created'?'ti-plus':'ti-pencil'}"></i></div>
        <div class="hist-info"><div class="hist-action">${h.action==='created'?'등록됨':'수정됨'}</div><div class="hist-by">${h.by} · ${timeAgo(h.at)}</div></div>
      </div>`).join('')}</div>
  </div>`:''}
  <div class="comment-section">
    <div class="comment-title"><i class="ti ti-message-2"></i>댓글 <span id="cmtCnt">0</span></div>
    <div class="comment-list" id="cmtList"><div class="comment-empty">댓글이 없어요. 첫 댓글을 남겨보세요!</div></div>
    <div class="comment-input-row">
      <textarea class="comment-input" id="cmtInput" placeholder="댓글을 입력하세요..." rows="1" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addComment('${r.id}');}"></textarea>
      <button class="comment-send" onclick="addComment('${r.id}')"><i class="ti ti-send"></i></button>
    </div>
  </div>`;
}

// ═══ Image Size Control ═══
const IMG_SIZES={S:'25%',M:'50%',L:'75%',전체:'100%'};
function setImgSize(btn,imgId,size){
  const img=document.getElementById(imgId);if(!img)return;
  img.style.width=IMG_SIZES[size];
  img.style.maxHeight='none';
  img.style.objectFit='contain';
  btn.closest('.vblk').querySelectorAll('.img-size-btn').forEach(b=>{
    b.classList.toggle('on',b.textContent===size);
  });
}

// ═══ Image Copy ═══
async function copyImg(url){
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    const imgBlob=new Blob([blob],{type:'image/png'});
    await navigator.clipboard.write([new ClipboardItem({'image/png':imgBlob})]);
    toast('이미지가 복사됐어요 📋','ok');
  }catch(e){
    window.open(url,'_blank');
    toast('브라우저 제한으로 새 탭에서 열었어요');
  }
}

// ═══ Comments ═══
function loadComments(recId){
  if(unsubComments)unsubComments();
  unsubComments=db.collection(currentBoardCollection).doc(recId).collection('comments').orderBy('createdAt','asc').onSnapshot(snap=>{
    const comments=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderComments(comments,recId);
    document.getElementById('cmtCnt').textContent=comments.length;
    db.collection(currentBoardCollection).doc(recId).update({commentCount:comments.length}).catch(()=>{});
  },err=>console.error(err));
}
  
function renderComments(comments,recId){
  const el=document.getElementById('cmtList');if(!el)return;
  if(!comments.length){el.innerHTML=`<div class="comment-empty">댓글이 없어요. 첫 댓글을 남겨보세요!</div>`;return;}
  el.innerHTML=comments.map(c=>{
    const canDel=currentUser.isMaster||c.authorId===currentUser.uid;
    const initials=c.authorName?c.authorName.slice(0,1).toUpperCase():'?';
    return`<div class="comment-item">
      <div class="comment-header">
        <div class="comment-avatar">${initials}</div>
        <span class="comment-author">${c.authorName||'알 수 없음'}</span>
        <span class="comment-time">${timeAgo(c.createdAt?.toDate?.()?.toISOString()||c.createdAt)}</span>
      </div>
      <div class="comment-text">${c.text}</div>
      ${canDel?`<button class="comment-del" onclick="delComment('${recId}','${c.id}')"><i class="ti ti-trash"></i></button>`:''}
    </div>`;
  }).join('');
}

async function addComment(recId){
  const inp=document.getElementById('cmtInput');
  const text=inp?.value.trim();if(!text)return;
  try{
    await db.collection(currentBoardCollection).doc(recId).collection('comments').add({text,authorId:currentUser.uid,authorName:currentUser.username,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    if(inp)inp.value='';
  }catch(e){toast('댓글 등록에 실패했어요','err');}
}

async function delComment(recId,cmtId){
  if(!confirm('댓글을 삭제할까요?'))return;
  try{
    await db.collection(currentBoardCollection).doc(recId).collection('comments').doc(cmtId).delete();
  }
  catch(e){toast('삭제에 실패했어요','err');}
}

// ═══ Delete Record ═══
async function doDel(id){
  if(!confirm('이 기록을 삭제할까요?'))return;
  ld(true,'삭제 중...');
  try{
    const rec=records.find(r=>r.id===id);
    if(rec){
      for(const b of(rec.blocks||[])){if(b.type==='image'&&b.path){try{await storage.ref(b.path).delete();}catch(e){}}}
      try{await storage.ref(`thumbs/${id}.jpg`).delete();}catch(e){}
      const cmts=await db.collection(currentBoardCollection).doc(id).collection('comments').get();
      for(const c of cmts.docs)await c.ref.delete();
    }
    await db.collection(currentBoardCollection).doc(id).delete();
    closeSheet();toast('삭제됐어요');
  }catch(err){toast('삭제에 실패했어요','err');}
  finally{ld(false);}
}

// ═══ Settings ═══
function openSettings(){
  if (location.hash === '#sidebar') {
    location.replace('#sheet');
    document.getElementById('sidebar').classList.remove('on');
    document.getElementById('sbOverlay').classList.remove('on');
  } else {
    location.hash = 'sheet';
  }
  document.getElementById('overlay').classList.add('on');
  renderSettingsSheet();
}

async function renderSettingsSheet(){
  let pendingHTML='',usersHTML='';
  if(currentUser.isMaster){
    try{
      const snap=await db.collection('users').orderBy('createdAt','asc').get();
      const all=snap.docs.map(d=>({uid:d.id,...d.data()}));
      const pending=all.filter(u=>u.status==='pending');
      const approved=all.filter(u=>u.status!=='pending');
      if(pending.length)pendingHTML=`<div class="pending-section"><div class="pending-title"><i class="ti ti-clock"></i>가입 승인 대기 ${pending.length}명</div>${pending.map(u=>`<div class="pending-item"><span class="pending-name">${u.username}</span><button onclick="approveUser('${u.uid}')" class="btn-approve">승인</button><button class="u-del" onclick="removeUser('${u.uid}','${esc(u.username)}')"><i class="ti ti-x"></i></button></div>`).join('')}</div>`;
      usersHTML=`<div class="set-section"><div class="set-section-title"><i class="ti ti-users"></i>사용자 관리</div>${approved.map(u=>`<div class="user-row"><span class="u-name">${u.username}</span><span class="u-badge ${u.isMaster?'master':'user'}">${u.isMaster?'마스터':'사용자'}</span>${!u.isMaster?`<label class="u-toggle"><input type="checkbox" ${u.canDelete?'checked':''} onchange="toggleDelPerm('${u.uid}',this.checked)"> 삭제 권한</label><button class="u-del" onclick="removeUser('${u.uid}','${esc(u.username)}')"><i class="ti ti-trash"></i></button>`:''}  </div>`).join('')}</div><div class="sep"></div>`;
    }catch(e){console.error(e);}
  }
  const notifSupported='Notification' in window;
  document.getElementById('sheet').innerHTML=`<div class="sh-handle"></div>
  <div class="sh-title">설정<button class="btn-x" onclick="closeSheet()"><i class="ti ti-x"></i></button></div>
  <div class="set-info"><i class="ti ti-user-circle"></i><span><strong>${currentUser.username}</strong> 로그인 중${currentUser.isMaster?' <span style="font-size:11px;color:var(--master);font-weight:700;background:var(--mb);padding:2px 7px;border-radius:20px">마스터</span>':''}</span></div>
  ${pendingHTML}${usersHTML}
  <div class="set-section">
    <div class="set-section-title"><i class="ti ti-bell"></i>알림 설정</div>
    <div class="toggle-row">
      <div><div class="toggle-label">새 기록 알림</div><div class="toggle-sub">${notifSupported?'다른 사원이 기록을 추가하면 알려드려요':'이 브라우저는 알림을 지원하지 않아요'}</div></div>
      <label class="toggle-switch"><input type="checkbox" ${notifEnabled?'checked':''} ${!notifSupported?'disabled':''} onchange="toggleNotif(this.checked)"><span class="toggle-slider"></span></label>
    </div>
  </div>
  <div class="set-section">
    <div class="set-section-title"><i class="ti ti-lock"></i>비밀번호 변경</div>
    <input type="text" style="display:none" autocomplete="username">
    <div class="fl"><label>현재 비밀번호</label><input type="password" id="cp" placeholder="현재 비밀번호" autocomplete="new-password"></div>
    <div class="fl"><label>새 비밀번호</label><input type="password" id="np1" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password"></div>
    <div class="fl"><label>새 비밀번호 확인</label><input type="password" id="np2" placeholder="재입력" autocomplete="new-password"></div>
    <div id="cperr" class="auth-err"></div><div id="cpok" class="auth-ok"></div>
    <button class="btn-save" onclick="doChPass()">비밀번호 변경</button>
  </div>
  <button class="btn-del-full" onclick="doLogout()"><i class="ti ti-logout"></i> 로그아웃</button>`;
}

async function approveUser(uid){try{await db.collection('users').doc(uid).update({status:'approved'});renderSettingsSheet();toast('승인됐어요','ok');}catch(e){toast('실패했어요','err');}}
async function removeUser(uid,username){if(!confirm(`'${username}' 계정을 삭제할까요?`))return;try{await db.collection('users').doc(uid).delete();renderSettingsSheet();toast('삭제됐어요');}catch(e){toast('실패했어요','err');}}
async function toggleDelPerm(uid,val){try{await db.collection('users').doc(uid).update({canDelete:val});if(uid===currentUser.uid)currentUser.canDelete=val;}catch(e){toast('변경에 실패했어요','err');}}
async function doChPass(){
  const c=document.getElementById('cp').value,n1=document.getElementById('np1').value,n2=document.getElementById('np2').value;
  const e=document.getElementById('cperr'),o=document.getElementById('cpok');
  e.style.display='none';o.style.display='none';
  if(!c){e.textContent='현재 비밀번호를 입력해주세요';e.style.display='block';return;}
  if(n1.length<6){e.textContent='새 비밀번호는 6자 이상이어야 해요';e.style.display='block';return;}
  if(n1!==n2){e.textContent='비밀번호가 일치하지 않아요';e.style.display='block';return;}
  try{
    const user=auth.currentUser;
    const cred=firebase.auth.EmailAuthProvider.credential(user.email,c);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(n1);
    o.textContent='비밀번호가 변경됐어요!';o.style.display='block';
    ['cp','np1','np2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }catch(err){e.textContent='현재 비밀번호가 올바르지 않아요';e.style.display='block';}
}
function doLogout(){if(unsubRecords){unsubRecords();unsubRecords=null;}if(unsubComments){unsubComments();unsubComments=null;}currentUser=null;records=[];favTags=[];auth.signOut();closeSheet();}

function closeSheet() {
  if(location.hash === '#sheet') history.back();
  document.getElementById('overlay').classList.remove('on');
  if (unsubComments) {
    unsubComments();
    unsubComments = null;
  }
  render(); 
}

function bgClick(e){if(e.target===document.getElementById('overlay'))closeSheet();}
/* ========== 게시판 전환 로직 (사이드바 연동 버전) ========== */
var currentBoardCollection = 'records'; 

function setBoard(boardType) {
  currentBoardCollection = boardType;
  
  const ht = document.getElementById('hdrTitle');
  if(ht) ht.textContent = boardType === 'records' ? '수리 일지' : '가이드';
  
  const recTab = document.getElementById('sideTabRecords');
  const guiTab = document.getElementById('sideTabGuides');
  
  if(recTab) recTab.classList.toggle('active', boardType === 'records');
  if(guiTab) guiTab.classList.toggle('active', boardType === 'guides');
  
  if(typeof subscribeRecords === 'function') subscribeRecords(); 
  
  if(typeof closeSidebar === 'function') closeSidebar();
  
  toast(boardType === 'records' ? '수리 일지로 이동했습니다.' : '가이드로 이동했습니다.');
}
  
/* ========== [추가] 캔버스 그리기(마크업) 로직 ========== */
let baseImg = new Image();
let drawCtx;
let isDrawing = false;
let drawCanvas;

window.addEventListener('DOMContentLoaded', () => {
  drawCanvas = document.getElementById('drawCanvas');
  if(drawCanvas) {
    drawCanvas.addEventListener('mousedown', startDraw);
    drawCanvas.addEventListener('mousemove', moveDraw);
    drawCanvas.addEventListener('mouseup', endDraw);
    drawCanvas.addEventListener('mouseout', endDraw);
    drawCanvas.addEventListener('touchstart', startDraw, {passive: false});
    drawCanvas.addEventListener('touchmove', moveDraw, {passive: false});
    drawCanvas.addEventListener('touchend', endDraw);
  }
});

function handleFileSelectForDraw(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    baseImg.src = evt.target.result;
    baseImg.onload = function() { openDrawModal(); }
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function openDrawModal() {
  location.hash = 'draw';
  document.getElementById('drawOverlay').classList.add('on');
  drawCtx = drawCanvas.getContext('2d');
  const wrap = document.getElementById('drawCanvasWrap');
  const ww = wrap.clientWidth; const wh = wrap.clientHeight; const wr = ww / wh;
  
  let iw = baseImg.width; let ih = baseImg.height;
  const MAX_RES = 1200;
  if(iw > MAX_RES || ih > MAX_RES) {
    const ir = iw / ih;
    if(iw > ih) { iw = MAX_RES; ih = MAX_RES / ir; } else { ih = MAX_RES; iw = MAX_RES * ir; }
  }
  drawCanvas.width = iw; drawCanvas.height = ih;
  
  const ir = iw / ih; let dw, dh;
  if(ir > wr) { dw = ww; dh = ww / ir; } else { dh = wh; dw = wh * ir; }
  drawCanvas.style.width = dw + 'px'; drawCanvas.style.height = dh + 'px';
  drawCanvas.style.left = (ww - dw)/2 + 'px'; drawCanvas.style.top = (wh - dh)/2 + 'px';
  resetDraw();
}

function resetDraw() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.drawImage(baseImg, 0, 0, drawCanvas.width, drawCanvas.height);
}

function getMousePos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  return {
    x: (clientX - rect.left) * (drawCanvas.width / rect.width),
    y: (clientY - rect.top) * (drawCanvas.height / rect.height)
  };
}

const startDraw = (e) => {
  isDrawing = true; const pos = getMousePos(e);
  drawCtx.beginPath(); drawCtx.moveTo(pos.x, pos.y);
  drawCtx.strokeStyle = '#EF4444'; drawCtx.lineWidth = Math.max(4, drawCanvas.width / 150);
  drawCtx.lineCap = 'round'; drawCtx.lineJoin = 'round';
};

const moveDraw = (e) => {
  if(!isDrawing) return;
  e.preventDefault();
  const pos = getMousePos(e);
  drawCtx.lineTo(pos.x, pos.y); drawCtx.stroke();
};

const endDraw = () => { isDrawing = false; };

function openDrawPicker() {
  let inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      aBlks.push({
        type: 'image',
        file: file,
        previewUrl: ev.target.result
      });
      renderBlks();
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function dataURLtoFile(dataurl, filename) {
  let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){ u8arr[n] = bstr.charCodeAt(n); }
  return new File([u8arr], filename, {type:mime});
}

function applyDraw() {
  const dataUrl = drawCanvas.toDataURL('image/jpeg', 0.85);
  const drawnFile = dataURLtoFile(dataUrl, 'markup_' + Date.now() + '.jpg');

  aBlks.push({
    type: 'image',
    file: drawnFile,
    previewUrl: dataUrl
  });
  
  renderBlks(); 
  document.getElementById('drawOverlay').classList.remove('on');
  if(location.hash === '#draw') history.back();
}

window.addEventListener('popstate', function(e) {
  if (location.hash === '') {
    const overlay = document.getElementById('overlay');
    const sidebar = document.getElementById('sidebar');
    const drawOverlay = document.getElementById('drawOverlay');

    if (overlay && overlay.classList.contains('on')) {
      overlay.classList.remove('on');
      if (unsubComments) { unsubComments(); unsubComments = null; }
      render();
    }
    if (sidebar && sidebar.classList.contains('on')) {
      sidebar.classList.remove('on');
      document.getElementById('sbOverlay').classList.remove('on');
    }
    if (drawOverlay && drawOverlay.classList.contains('on')) {
      drawOverlay.classList.remove('on');
    }
  }
});
