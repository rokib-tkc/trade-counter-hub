const CFG=window.APP_CONFIG||{};
const PAYMENT_TYPES=['Account','Card on Collection','Cash on Collection','Account Credit','Bank Transfer','Other'];
const PICK_STATUSES=['Waiting','Picking','Ready','Problem','Cancelled'];
const AVATARS=['👨🏻','👩🏻','👨🏽','👩🏽','👨🏿','👩🏿'];
const state={user:null,token:'',bookings:[],team:[],activity:[],config:{VAT_PERCENT:20,OPEN_TIME:'08:00',CLOSE_TIME:'17:00',SLOT_MINUTES:30},blocks:[],page:'advance',viewMode:'week',weekStart:startOfWeek(new Date()),day:new Date(),selected:null,editing:null};
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function startOfWeek(d){d=new Date(d);const day=d.getDay()||7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day+1);return d}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function normaliseTime(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?`${String(+m[1]).padStart(2,'0')}:${m[2]}`:''}
function showToast(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2600)}
function session(){return JSON.parse(sessionStorage.getItem('apm_session')||'null')}
function saveSession(){sessionStorage.setItem('apm_session',JSON.stringify({user:state.user,token:state.token}))}
function clearSession(){sessionStorage.removeItem('apm_session')}
function api(action,params={}){const url=CFG.API_URL;if(!url||url.includes('PASTE_YOUR'))return Promise.reject(new Error('The Apps Script URL has not been added to config.js.'));return new Promise((resolve,reject)=>{const cb=`apm_${Date.now()}_${Math.random().toString(36).slice(2)}`,s=document.createElement('script');let done=false;const timeout=setTimeout(()=>finish(new Error('Request timed out.')),20000);function finish(err,data){if(done)return;done=true;clearTimeout(timeout);delete window[cb];s.remove();err?reject(err):resolve(data)}window[cb]=data=>data&&data.ok===false?finish(new Error(data.error||'Request failed')):finish(null,data);const q=new URLSearchParams({action,callback:cb,...params});if(state.user){q.set('user',state.user.name);q.set('token',state.token);q.set('sessionId',getSessionId());q.set('device',getDeviceLabel())}s.src=`${url}?${q}`;s.onerror=()=>finish(new Error('Could not contact Google Apps Script.'));document.body.appendChild(s)})}
async function login(e){e.preventDefault();$('loginError').textContent='';try{const r=await api('login',{name:$('loginName').value.trim(),accessKey:$('loginKey').value});state.user=r.user;state.token=r.sessionToken;saveSession();await enterApp()}catch(err){$('loginError').textContent=err.message}}
async function enterApp(){try{const b=await api('bootstrap');state.user=b.user;state.team=b.team||[];state.config=b.config||state.config;state.blocks=b.blocks||[];$('loginScreen').classList.add('hidden');$('app').classList.remove('hidden');updateUserChip();await loadData();setPage('advance')}catch(err){clearSession();$('loginScreen').classList.remove('hidden');$('app').classList.add('hidden');$('loginError').textContent=err.message}}
async function loadData(){const from=localDate(state.viewMode==='day'?state.day:state.weekStart),to=localDate(state.viewMode==='day'?state.day:addDays(state.weekStart,6));try{const r=await api('list',{from,to});state.bookings=r.bookings||[];state.activity=r.activity||[];state.team=r.team||state.team;state.config=r.config||state.config;state.blocks=r.blocks||state.blocks;renderAll()}catch(e){showToast(e.message)}}
function updateUserChip(){if(!state.user)return;$('userName').textContent=state.user.name;$('userRole').textContent=state.user.role;renderAvatar($('userAvatar'),state.user)}
function renderAvatar(el,user){if(user.profileImage){el.textContent='';el.style.backgroundImage=`url(${user.profileImage})`}else{el.style.backgroundImage='none';const idx=Math.max(0,Number(String(user.avatar||'avatar-1').split('-')[1])-1);el.textContent=AVATARS[idx]||AVATARS[0]}}
function setPage(p){state.page=p;document.querySelectorAll('.sidebar [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));const titles={dashboard:['Dashboard','Overview of today’s Trade Counter workload'],advance:['Advance Picks','View and manage timed large-order collections'],small:['Small Orders','Manage small orders and walk-in collections'],board:['Picking Board','Prioritise and progress all picking work'],workload:['Team Workload','Review picker assignments and workload'],reports:['Reports','Customer service, picking and sales performance'],settings:['Settings','Manage your profile and application settings']};$('pageTitle').textContent=titles[p][0];$('pageSubtitle').textContent=titles[p][1];$('plannerControls').classList.toggle('hidden',['dashboard','reports','settings'].includes(p));$('filterPanel').classList.add('hidden');$('stats').classList.toggle('hidden',['settings','reports'].includes(p));renderAll();if(p==='settings')openSettings()}
function filtered(){const q=$('searchInput').value.toLowerCase(),sf=$('statusFilter').value,pf=$('pickerFilter').value,pr=$('priorityFilter').value;return state.bookings.filter(b=>(!q||`${b.orderNumber} ${b.customer}`.toLowerCase().includes(q))&&(!sf||displayStatus(b)===sf)&&(!pf||b.assignedPicker===pf)&&(!pr||b.priority===pr))}
function displayStatus(b){return b.collectionStatus==='Collected'?'Collected':b.collectionStatus==='Customer Waiting'?'Customer Waiting':b.pickStatus||'Waiting'}
function renderAll(){renderDateLabel();renderFilters();renderStats();renderNotifications();if(state.page==='dashboard')renderDashboard();else if(state.page==='advance')renderTimedCalendar();else if(state.page==='small')renderSmallCalendar();else if(state.page==='board')renderBoard();else if(state.page==='workload')renderWorkload();else if(state.page==='reports')renderReports();}
function renderDateLabel(){const start=state.viewMode==='day'?state.day:state.weekStart,end=state.viewMode==='day'?state.day:addDays(state.weekStart,6);$('dateLabel').textContent=state.viewMode==='day'?start.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):`${start.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;$('viewMode').value=state.viewMode}
function renderFilters(){const statuses=['Waiting','Picking','Ready','Customer Waiting','Collected','Problem','Cancelled'];const current=$('statusFilter').value;$('statusFilter').innerHTML='<option value="">All statuses</option>'+statuses.map(s=>`<option>${s}</option>`).join('');$('statusFilter').value=current;const pc=$('pickerFilter').value;$('pickerFilter').innerHTML='<option value="">All pickers</option>'+state.team.filter(t=>t.active).map(t=>`<option>${safe(t.name)}</option>`).join('');$('pickerFilter').value=pc;const sel=$('assignedPicker');if(sel){const v=sel.value;sel.innerHTML='<option value="">Unassigned</option>'+state.team.filter(t=>t.active).map(t=>`<option>${safe(t.name)}</option>`).join('');sel.value=v}}
function renderStats(){const b=filtered(),ready=b.filter(x=>x.pickStatus==='Ready').length,picking=b.filter(x=>x.pickStatus==='Picking').length,waiting=b.filter(x=>x.pickStatus==='Waiting').length,issues=b.filter(x=>['Problem','Cancelled'].includes(x.pickStatus)||isLate(x)).length;const cards=[['▣','Collections',b.length,'Current selected period'],['✓','Ready for Collection',ready,`${pct(ready,b.length)}% of bookings`],['⇆','Being Picked',picking,`${pct(picking,b.length)}% of bookings`],['◷','Waiting to Pick',waiting,`${pct(waiting,b.length)}% of bookings`],['!','Issues / Overdue',issues,issues?'Requires attention':'No current issues']];$('stats').innerHTML=cards.map(c=>`<div class="stat"><div class="stat-icon">${c[0]}</div><span>${c[1]}</span><strong>${c[2]}</strong><small>${c[3]}</small></div>`).join('')}
function pct(a,b){return b?Math.round(a/b*100):0}
function nowLondon(){return new Date()}
function isLate(b){if(!b.collectionTime||b.collectionStatus==='Collected'||b.pickStatus==='Cancelled')return false;return new Date(`${b.collectionDate}T${b.collectionTime}:00`)<nowLondon()}
function needsPickSoon(b){if(!b.collectionTime||['Ready'].includes(b.pickStatus)||b.collectionStatus==='Collected'||b.pickStatus==='Cancelled')return false;const t=new Date(`${b.collectionDate}T${b.collectionTime}:00`);return t-nowLondon()<=30*60000&&t-nowLondon()>0}
function notifications(){return state.bookings.flatMap(b=>{const arr=[];if(isLate(b))arr.push({type:'Overdue',b,msg:'Collection time has passed'});if(needsPickSoon(b))arr.push({type:'Pick due',b,msg:'Not ready within 30 minutes of collection'});if(['Problem','Cancelled'].includes(b.pickStatus))arr.push({type:b.pickStatus,b,msg:b.pickStatus==='Problem'?'Order has a problem':'Booking is cancelled'});return arr})}
function renderNotifications(){const n=notifications();$('notificationBadge').textContent=n.length;$('notificationBadge').classList.toggle('hidden',!n.length);$('notificationList').innerHTML=n.length?n.map(x=>`<div class="notice" data-id="${x.b.id}"><strong>${safe(x.type)} · ${safe(x.b.orderNumber)}</strong><span>${safe(x.b.customer)}</span><small>${safe(x.msg)}</small></div>`).join(''):'<p>No current notifications.</p>';document.querySelectorAll('.notice').forEach(x=>x.onclick=()=>openOrder(x.dataset.id))}
function timeSlots(date){const start=normaliseTime(state.config.OPEN_TIME||'08:00'),end=normaliseTime(state.config.CLOSE_TIME||'17:00'),step=Number(state.config.SLOT_MINUTES||30),out=[];let [h,m]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);for(let cur=h*60+m;cur<eh*60+em;cur+=step)out.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`);return out}
function isBlocked(date,time){const day=new Date(date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long'});return state.blocks.find(b=>b.active&&b.dayOfWeek===day&&time>=b.startTime&&time<b.endTime)}
function visibleDays(){return state.viewMode==='day'?[new Date(state.day)]:[0,1,2,3,4].map(i=>addDays(state.weekStart,i))}
function card(b){const status=displayStatus(b),held=b.accountStatus==='Held'?'<span class="pill p-Held">HELD</span>':'';return `<article class="booking-card status-${safe(b.pickStatus)}" draggable="true" data-id="${safe(b.id)}"><div class="card-row"><strong>${safe(b.orderNumber)}</strong>${b.collectionTime?`<b>${safe(b.collectionTime)}</b>`:''}</div><span class="customer">${safe(b.customer)}</span><div class="card-row"><span>${Number(b.itemCount||0)} items</span><span class="pill p-${safe(status)}">${safe(status)}</span></div><div class="card-row"><span>${safe(b.bookingType)}</span>${held}</div>${b.priority!=='Normal'?`<div class="card-row"><span class="pill p-Problem">${safe(b.priority)} priority</span></div>`:''}</article>`}
function renderTimedCalendar(){const days=visibleDays(),bookings=filtered().filter(b=>b.bookingType==='Advance Large Order');let html=`<div class="calendar-wrap ${state.viewMode==='day'?'day-view':''}"><div class="calendar-grid"><div class="cal-cell cal-head"></div>${days.map(d=>`<div class="cal-cell cal-head">${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>`).join('')}`;for(const time of timeSlots()){html+=`<div class="cal-cell time-cell">${time}</div>`;for(const d of days){const date=localDate(d),block=isBlocked(date,time);html+=`<div class="cal-cell slot ${block?'blocked':''}" data-date="${date}" data-time="${time}">${block?safe(block.label||'Blocked'):bookings.filter(b=>b.collectionDate===date&&normaliseTime(b.collectionTime)===time).map(b=>card(b)).join('')}</div>`}}html+='</div></div>';$('pageBody').innerHTML=html;wireCards()}
function renderSmallCalendar(){const days=visibleDays(),b=filtered().filter(x=>['Small Order','Walk in'].includes(x.bookingType));$('pageBody').innerHTML=`<div class="small-calendar">${days.map(d=>{const date=localDate(d);return `<section class="day-column" data-date="${date}"><h3>${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</h3>${b.filter(x=>x.collectionDate===date).sort(sortBookings).map(b=>card(b,{showTime:true})).join('')}</section>`}).join('')}</div>`;wireCards()}
function sortBookings(a,b){return `${a.collectionTime||'99:99'}${a.priority}`.localeCompare(`${b.collectionTime||'99:99'}${b.priority}`)}
function renderBoard(){const all=filtered().filter(b=>state.viewMode==='week'||b.collectionDate===localDate(state.day));const renderSection=(title,items)=>`<div class="board-section"><h2>${title}</h2><div class="board">${PICK_STATUSES.map(s=>`<section class="board-col"><div class="board-head"><span>${s}</span><span>${items.filter(b=>b.pickStatus===s).length}</span></div><div class="board-list" data-status="${s}">${items.filter(b=>b.pickStatus===s).sort(sortBookings).map(b=>card(b,{showTime:true})).join('')}</div></section>`).join('')}</div></div>`;$('pageBody').innerHTML=renderSection('Advance Picks',all.filter(b=>b.bookingType==='Advance Large Order'))+renderSection('Small Orders / Walk ins',all.filter(b=>b.bookingType!=='Advance Large Order'));wireCards()}
function renderWorkload(){const b=filtered().filter(x=>state.viewMode==='week'||x.collectionDate===localDate(state.day));$('pageBody').innerHTML=`<div class="workload-grid">${state.team.filter(t=>t.active).map(t=>{const jobs=b.filter(x=>x.assignedPicker===t.name&&x.pickStatus!=='Cancelled'&&x.collectionStatus!=='Collected'),ready=jobs.filter(x=>x.pickStatus==='Ready').length,p=Math.min(100,jobs.length*15);return `<div class="person-card"><div class="card-row"><h3>${safe(t.name)}</h3><span>${safe(t.role)}</span></div><p>${jobs.length} active bookings · ${ready} ready</p><div class="progress"><div style="width:${p}%"></div></div>${jobs.slice(0,4).map(b=>card(b,{showTime:true})).join('')}</div>`}).join('')}</div>`;wireCards()}
function renderDashboard(){const today=localDate(new Date()),b=state.bookings.filter(x=>x.collectionDate===today);$('pageBody').innerHTML=`<div class="dashboard-grid"><div class="dashboard-card">Today’s Collections<strong>${b.length}</strong></div><div class="dashboard-card">Waiting to Pick<strong>${b.filter(x=>x.pickStatus==='Waiting').length}</strong></div><div class="dashboard-card">Ready<strong>${b.filter(x=>x.pickStatus==='Ready').length}</strong></div><div class="dashboard-card">Customer Waiting<strong>${b.filter(x=>x.collectionStatus==='Customer Waiting').length}</strong></div></div><h2>Today’s Queue</h2><div class="small-calendar"><section class="day-column">${b.sort(sortBookings).map(b=>card(b,{showTime:true})).join('')||'<p>No bookings today.</p>'}</section></div>`;wireCards()}
async function renderReports(){const from=localDate(state.viewMode==='day'?state.day:state.weekStart),to=localDate(state.viewMode==='day'?state.day:addDays(state.weekStart,6));$('pageBody').innerHTML='<p>Loading reports…</p>';try{const r=await api('reports',{from,to}),s=r.summary;$('pageBody').innerHTML=`<div class="report-grid"><div class="report-card">Bookings<strong>${s.bookings}</strong></div><div class="report-card">Average Customer Wait<strong>${s.averageWaitMinutes} min</strong></div><div class="report-card">Average Pick Time<strong>${s.averagePickMinutes} min</strong></div><div class="report-card">Sales inc VAT<strong>£${Number(s.totalSalesIncVAT).toLocaleString('en-GB',{minimumFractionDigits:2})}</strong></div></div><h2>Daily Breakdown</h2><table class="table"><thead><tr><th>Date</th><th>Bookings</th><th>Collected</th><th>Sales ex VAT</th><th>Sales inc VAT</th></tr></thead><tbody>${Object.entries(r.byDay).sort().map(([d,x])=>`<tr><td>${d}</td><td>${x.bookings}</td><td>${x.collected}</td><td>£${x.salesExVAT.toFixed(2)}</td><td>£${x.salesIncVAT.toFixed(2)}</td></tr>`).join('')}</tbody></table>`}catch(e){$('pageBody').innerHTML=`<p>${safe(e.message)}</p>`}}
function wireCards(){document.querySelectorAll('.booking-card').forEach(el=>{el.onclick=()=>openOrder(el.dataset.id);el.ondragstart=e=>e.dataTransfer.setData('text/plain',el.dataset.id)});document.querySelectorAll('.slot:not(.blocked)').forEach(el=>{el.ondragover=e=>{e.preventDefault();el.classList.add('drag-over')};el.ondragleave=()=>el.classList.remove('drag-over');el.ondrop=e=>{e.preventDefault();quickUpdate(e.dataTransfer.getData('text/plain'),{collectionDate:el.dataset.date,collectionTime:el.dataset.time})}});document.querySelectorAll('.day-column').forEach(el=>{el.ondragover=e=>e.preventDefault();el.ondrop=e=>quickUpdate(e.dataTransfer.getData('text/plain'),{collectionDate:el.dataset.date})});document.querySelectorAll('.board-list').forEach(el=>{el.ondragover=e=>e.preventDefault();el.ondrop=e=>quickUpdate(e.dataTransfer.getData('text/plain'),{pickStatus:el.dataset.status})})}
async function quickUpdate(id,changes){try{await api('quick',{id,changes:JSON.stringify(changes)});showToast('Booking updated');await loadData()}catch(e){showToast(e.message)}}
function openOrder(id){state.selected=state.bookings.find(b=>b.id===id);if(!state.selected)return;$('orderPanelTitle').textContent=state.selected.orderNumber||'Order';$('orderPanelStatus').innerHTML=`<span class="pill status ${displayStatus(state.selected).toLowerCase().replace(/\s+/g,'-')}">${safe(displayStatus(state.selected))}</span>`;$('orderPanel').classList.remove('hidden');renderOrderTab('details')}
function renderOrderTab(tab){const b=state.selected;if(!b)return;$('orderPanelTitle').textContent=b.orderNumber;$('orderPanelStatus').innerHTML=`<span class="pill p-${safe(displayStatus(b))}">${safe(displayStatus(b))}</span>`;document.querySelectorAll('[data-order-tab]').forEach(x=>x.classList.toggle('active',x.dataset.orderTab===tab));if(tab==='details'){$('orderPanelContent').innerHTML=`<div class="tracker">${['Waiting','Picking','Ready','Collected'].map((s,i)=>`<div class="tracker-step ${trackerDone(b,i)?'done':''}">${s}</div>`).join('')}</div><div class="detail-list">${detail('Customer',b.customer)}${detail('Collection',`${b.collectionDate}${b.collectionTime?' at '+b.collectionTime:''}`)}${detail('Booking Type',b.bookingType)}${detail('Items',b.itemCount)}${detail('Payment',`${b.paymentType||'-'} · ${b.paymentStatus||'-'}`)}${detail('Account',b.accountStatus||'-')}${detail('Assigned Picker',b.assignedPicker||'Unassigned')}${detail('Priority',b.priority)}${detail('Order Value',`£${Number(b.orderValueExVAT||0).toFixed(2)} ex VAT / £${Number(b.orderValueIncVAT||0).toFixed(2)} inc VAT`)}${detail('Booked By',b.bookedBy||'-')}${detail('Requirements',requirements(b)||'None')}</div>`}else if(tab==='notes')$('orderPanelContent').innerHTML=`<p>${safe(b.notes||'No notes recorded.')}</p>`;else{$('orderPanelContent').innerHTML=(state.activity.filter(a=>a.bookingId===b.id).sort((a,z)=>z.timestamp.localeCompare(a.timestamp)).map(a=>`<div class="activity-item"><strong>${safe(a.action)}</strong><div>${safe(a.details)}</div><small>${safe(a.performedBy)} · ${safe(formatDateTime(a.timestamp))}</small></div>`).join('')||'<p>No activity recorded.</p>')};$('panelWaiting').disabled=b.collectionStatus==='Collected';$('panelReady').disabled=b.pickStatus==='Ready';$('panelCollected').disabled=b.collectionStatus==='Collected'}
function trackerDone(b,i){if(i===0)return true;if(i===1)return ['Picking','Ready'].includes(b.pickStatus)||b.collectionStatus==='Collected';if(i===2)return b.pickStatus==='Ready'||b.collectionStatus==='Collected';return b.collectionStatus==='Collected'}
function detail(a,b){return `<div class="detail-row"><span>${a}</span><strong>${safe(b)}</strong></div>`}
function requirements(b){return [['Drilling',b.drillingRequired],['Parkway',b.parkwayItems],['Air Picks',b.airPicks],['O/S',b.osItems],['Painted',b.paintedOrder],['MTM',b.madeToMeasure]].filter(x=>x[1]).map(x=>x[0]).join(', ')}
function formatDateTime(v){return v?new Date(v).toLocaleString('en-GB'):'-'}
function validWeekday(date){const d=new Date(date+'T12:00:00').getDay();return d!==0&&d!==6}
function updateTimeOptions(){const date=$('collectionDate').value,type=$('bookingType').value,current=$('collectionTime').value;$('collectionTime').innerHTML=`<option value="">${type==='Advance Large Order'?'Select a time':'No fixed time'}</option>`+timeSlots().map(t=>`<option value="${t}" ${date&&isBlocked(date,t)?'disabled':''}>${t}${date&&isBlocked(date,t)?' – Blocked':''}</option>`).join('');$('collectionTime').required=type==='Advance Large Order';$('collectionTime').value=current}
function openBooking(id){state.editing=id?state.bookings.find(x=>x.id===id):null;const b=state.editing||{collectionDate:localDate(new Date()),bookingType:'Advance Large Order',pickStatus:'Waiting',paymentStatus:'Payment Required',accountStatus:'Released',priority:'Normal'};$('modalTitle').textContent=id?`Edit ${b.orderNumber}`:'New Booking';const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','orderValueIncVAT','notes'];fields.forEach(k=>{const el=$(k),key=k==='bookingId'?'id':k;if(el)el.value=b[key]??''});['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>$(k).checked=!!b[k]);updateTimeOptions();$('collectionTime').value=b.collectionTime||'';$('deleteBookingBtn').classList.toggle('hidden',!id);$('bookingModal').classList.remove('hidden');calcVat()}
function calcVat(){const ex=Number($('orderValueExVAT').value||0),vat=Number(state.config.VAT_PERCENT||20);$('orderValueIncVAT').value=(ex*(1+vat/100)).toFixed(2)}
async function saveBooking(e){e.preventDefault();if(!validWeekday($('collectionDate').value)){showToast('Collection dates must be Monday to Friday.');return}const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','notes'];const b={};fields.forEach(k=>b[k==='bookingId'?'id':k]=$(k).value);['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>b[k]=$(k).checked);try{await api('save',{payload:JSON.stringify(b)});$('bookingModal').classList.add('hidden');showToast('Booking saved');await loadData()}catch(err){showToast(err.message)}}
async function deleteBooking(){if(!state.editing||!confirm(`Delete ${state.editing.orderNumber}?`))return;try{await api('delete',{id:state.editing.id});$('bookingModal').classList.add('hidden');$('orderPanel').classList.add('hidden');showToast('Booking deleted');await loadData()}catch(e){showToast(e.message)}}
function openSettings(){renderSettings();$('settingsModal').classList.remove('hidden')}
function renderSettings(){const manager=state.user.role==='Manager';$('settingsContent').innerHTML=`<div class="settings-grid"><section class="settings-section"><h3>My Profile</h3><p>${safe(state.user.name)} · ${safe(state.user.role)}</p><label>New Access Key<input id="ownNewKey" type="password"></label><button id="changeOwnKey">Change Access Key</button><h4>Choose Avatar</h4><div class="avatar-options">${AVATARS.map((a,i)=>`<button class="avatar-choice ${(state.user.avatar===`avatar-${i+1}`)?'selected':''}" data-avatar="avatar-${i+1}">${a}</button>`).join('')}</div><label>Upload Selfie<input id="profileUpload" type="file" accept="image/*"></label><small>Images are compressed before being saved.</small></section>${manager?`<section class="settings-section"><h3>Application Settings</h3><label>Opening Time<input id="cfgOpen" type="time" step="1800" value="${safe(state.config.OPEN_TIME||'08:00')}"></label><label>Closing Time<input id="cfgClose" type="time" step="1800" value="${safe(state.config.CLOSE_TIME||'17:00')}"></label><label>VAT Percentage<input id="cfgVat" type="number" step="0.01" value="${safe(state.config.VAT_PERCENT||20)}"></label><button id="saveConfigBtn">Save Settings</button></section><section class="settings-section"><h3>Users</h3><div id="userRows">${state.team.map(userRow).join('')}</div><button id="addUserBtn">＋ Add User</button></section><section class="settings-section"><h3>Blocked Booking Times</h3><div>${state.blocks.map(blockRow).join('')}</div><button id="addBlockBtn">＋ Add Blocked Time</button></section>`:''}</div>`;wireSettings(manager)}
function userRow(u){return `<div class="notice"><strong>${safe(u.name)}</strong><span>${safe(u.role)} · ${u.active?'Active':'Inactive'}</span><div><button data-edit-user="${safe(u.name)}">Edit</button><button data-delete-user="${safe(u.name)}">Delete</button></div></div>`}
function blockRow(b){return `<div class="notice"><strong>${safe(b.dayOfWeek)} ${safe(b.startTime)}–${safe(b.endTime)}</strong><span>${safe(b.label)}</span><div><button data-edit-block="${b.id}">Edit</button><button data-delete-block="${b.id}">Delete</button></div></div>`}
function wireSettings(manager){$('changeOwnKey').onclick=async()=>{try{const r=await api('changeKey',{newKey:$('ownNewKey').value});state.token=r.sessionToken;state.issuedAt=Number(r.issuedAt||Date.now());state.expiresAt=Number(r.expiresAt||state.issuedAt+12*60*60*1000);saveSession();showToast('Access key changed')}catch(e){showToast(e.message)}};document.querySelectorAll('[data-avatar]').forEach(x=>x.onclick=async()=>{try{await api('setAvatar',{avatar:x.dataset.avatar});state.user.avatar=x.dataset.avatar;state.user.profileImage='';saveSession();updateUserChip();renderSettings()}catch(e){showToast(e.message)}});$('profileUpload').onchange=uploadProfile;if(manager){$('saveConfigBtn').onclick=async()=>{try{const r=await api('saveConfig',{payload:JSON.stringify({OPEN_TIME:$('cfgOpen').value,CLOSE_TIME:$('cfgClose').value,VAT_PERCENT:$('cfgVat').value})});state.config=r.config;showToast('Settings saved');renderSettings();renderAll()}catch(e){showToast(e.message)}};$('addUserBtn').onclick=()=>editUser();document.querySelectorAll('[data-edit-user]').forEach(x=>x.onclick=()=>editUser(x.dataset.editUser));document.querySelectorAll('[data-delete-user]').forEach(x=>x.onclick=()=>deleteUser(x.dataset.deleteUser));$('addBlockBtn').onclick=()=>editBlock();document.querySelectorAll('[data-edit-block]').forEach(x=>x.onclick=()=>editBlock(x.dataset.editBlock));document.querySelectorAll('[data-delete-block]').forEach(x=>x.onclick=()=>deleteBlock(x.dataset.deleteBlock))}}
function editUser(name=''){const u=state.team.find(x=>x.name===name)||{name:'',role:'Trade Counter',active:true};const n=prompt('User name',u.name);if(n===null)return;const role=prompt('Role: Manager, Trade Counter or Warehouse',u.role);if(role===null)return;const key=prompt('Access key (leave blank to retain/generate)', '');if(key===null)return;const active=confirm('Click OK for Active, or Cancel for Inactive.');api('saveUser',{payload:JSON.stringify({originalName:u.name,name:n,role,accessKey:key,active})}).then(r=>{state.team=r.team;renderSettings();showToast('User saved')}).catch(e=>showToast(e.message))}
function deleteUser(name){if(!confirm(`Delete user ${name}?`))return;api('deleteUser',{name}).then(r=>{state.team=r.team;renderSettings()}).catch(e=>showToast(e.message))}
function editBlock(id=''){const b=state.blocks.find(x=>x.id===id)||{dayOfWeek:'Monday',startTime:'08:00',endTime:'08:30',label:'Team checks',active:true};const day=prompt('Day of week',b.dayOfWeek);if(day===null)return;const start=prompt('Start time (HH:mm)',b.startTime);if(start===null)return;const end=prompt('End time (HH:mm)',b.endTime);if(end===null)return;const label=prompt('Label',b.label);if(label===null)return;api('saveBlock',{payload:JSON.stringify({id:b.id,dayOfWeek:day,startTime:start,endTime:end,label,active:true})}).then(r=>{state.blocks=r.blocks;renderSettings();renderAll()}).catch(e=>showToast(e.message))}
function deleteBlock(id){if(!confirm('Delete this blocked time?'))return;api('deleteBlock',{id}).then(r=>{state.blocks=r.blocks;renderSettings();renderAll()}).catch(e=>showToast(e.message))}
async function uploadProfile(e){const file=e.target.files[0];if(!file)return;try{const data=await resizeImage(file,120,120,.72),uploadId=Date.now()+'_'+Math.random().toString(36).slice(2),chunks=data.match(/.{1,1200}/g)||[];for(let i=0;i<chunks.length;i++)await api('saveProfileChunk',{uploadId,index:i,total:chunks.length,chunk:chunks[i]});state.user.profileImage=data;saveSession();updateUserChip();showToast('Profile image saved')}catch(err){showToast(err.message)}}
function resizeImage(file,w,h,q){return new Promise((resolve,reject)=>{const img=new Image(),r=new FileReader();r.onload=()=>img.src=r.result;r.onerror=reject;img.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale,sx=(img.width-sw)/2,sy=(img.height-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,0,0,w,h);resolve(c.toDataURL('image/jpeg',q))};r.readAsDataURL(file)})}

$('loginForm').onsubmit=login;$('logoutBtn').onclick=()=>{clearSession();location.reload()};document.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>setPage(x.dataset.page));$('newBookingBtn').onclick=()=>openBooking();$('bookingForm').onsubmit=saveBooking;$('deleteBookingBtn').onclick=deleteBooking;$('orderValueExVAT').oninput=calcVat;$('bookingType').onchange=updateTimeOptions;$('collectionDate').onchange=()=>{if(!validWeekday($('collectionDate').value)){showToast('Please choose Monday to Friday.');$('collectionDate').value=''}updateTimeOptions()};$('filterBtn').onclick=()=>$('filterPanel').classList.toggle('hidden');$('clearFilters').onclick=()=>{$('statusFilter').value='';$('pickerFilter').value='';$('priorityFilter').value='';renderAll()};[$('searchInput'),$('statusFilter'),$('pickerFilter'),$('priorityFilter')].forEach(x=>x.addEventListener(x.tagName==='INPUT'?'input':'change',renderAll));$('viewMode').onchange=()=>{state.viewMode=$('viewMode').value;loadData()};$('prevBtn').onclick=()=>{if(state.viewMode==='day')state.day=addDays(state.day,-1);else state.weekStart=addDays(state.weekStart,-7);loadData()};$('nextBtn').onclick=()=>{if(state.viewMode==='day')state.day=addDays(state.day,1);else state.weekStart=addDays(state.weekStart,7);loadData()};$('todayBtn').onclick=()=>{state.day=new Date();state.weekStart=startOfWeek(new Date());loadData()};$('refreshBtn').onclick=loadData;$('notificationBtn').onclick=()=>$('notificationPanel').classList.toggle('hidden');document.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>$(x.dataset.close).classList.add('hidden'));document.querySelectorAll('[data-order-tab]').forEach(x=>x.onclick=()=>renderOrderTab(x.dataset.orderTab));$('panelEdit').onclick=()=>openBooking(state.selected.id);$('panelReady').onclick=()=>quickUpdate(state.selected.id,{pickStatus:'Ready'});$('panelWaiting').onclick=()=>quickUpdate(state.selected.id,{collectionStatus:'Customer Waiting'});$('panelCollected').onclick=()=>quickUpdate(state.selected.id,{collectionStatus:'Collected'});
PAYMENT_TYPES.forEach(x=>$('paymentType').add(new Option(x,x)));
const s=session();if(s&&s.user&&s.token&&s.issuedAt&&s.expiresAt&&Date.now()<Number(s.expiresAt)){state.user=s.user;state.token=s.token;state.issuedAt=Number(s.issuedAt);state.expiresAt=Number(s.expiresAt);enterApp()}else{clearSession();$('loginScreen').classList.remove('hidden');}

window.APM_APP_LOADED=true;

/* ===== Trade Counter Operations Hub v1.3 refinements ===== */
function setLoading(active,text='Loading…'){
  const overlay=$('loadingOverlay'); if(!overlay)return;
  $('loadingText').textContent=text; overlay.classList.toggle('hidden',!active);
}
function showToast(msg,type='success'){
  const t=$('toast'); t.textContent=msg; t.classList.toggle('error',type==='error'); t.classList.remove('hidden');
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>t.classList.add('hidden'),3000);
}
async function login(e){
  e.preventDefault(); $('loginError').textContent=''; setLoading(true,'Signing you in…');
  try{const r=await api('login',{name:$('loginName').value.trim(),accessKey:$('loginKey').value});state.user=r.user;state.token=r.sessionToken;saveSession();await enterApp()}
  catch(err){$('loginError').textContent=err.message}
  finally{setLoading(false)}
}
async function loadData(){
  const from=localDate(state.viewMode==='day'?state.day:state.weekStart),to=localDate(state.viewMode==='day'?state.day:addDays(state.weekStart,6));
  setLoading(true,'Updating Trade Counter information…');
  try{const r=await api('list',{from,to});state.bookings=r.bookings||[];state.activity=r.activity||[];state.team=r.team||state.team;state.config=r.config||state.config;state.blocks=r.blocks||state.blocks;renderAll()}
  catch(e){showToast(e.message,'error')}
  finally{setLoading(false)}
}
function setPage(p){
  state.page=p; document.querySelectorAll('.sidebar [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  const titles={dashboard:['Dashboard','Today’s operational overview and team workload'],advance:['Advance Picks','View and manage timed large-order collections'],small:['Small Orders','Manage small orders and walk-in collections'],board:['Picking Board','Prioritise and progress all picking work'],reports:['Reports','Customer service, picking and sales performance'],settings:['Settings','Manage your profile and application settings']};
  $('pageTitle').textContent=titles[p][0]; $('pageSubtitle').textContent=titles[p][1];
  $('plannerControls').classList.toggle('hidden',['dashboard','reports','settings'].includes(p)); $('filterPanel').classList.add('hidden'); $('stats').classList.toggle('hidden',['settings','reports'].includes(p));
  renderAll(); if(p==='settings')openSettings();
}
function renderStats(){
  const b=filtered(),ready=b.filter(x=>x.pickStatus==='Ready').length,picking=b.filter(x=>x.pickStatus==='Picking').length,waiting=b.filter(x=>x.pickStatus==='Waiting').length,issues=b.filter(x=>['Problem','Cancelled'].includes(x.pickStatus)||isLate(x)).length;
  const cards=[['▣','Collections',b.length,'Selected period'],['✓','Ready for Collection',ready,`${pct(ready,b.length)}% of bookings`],['⇆','Being Picked',picking,`${pct(picking,b.length)}% of bookings`],['◷','Waiting to Pick',waiting,`${pct(waiting,b.length)}% of bookings`],['!','Issues / Overdue',issues,issues?'Requires attention':'No current issues']];
  $('stats').innerHTML=cards.map(c=>`<div class="stat"><div class="stat-icon">${c[0]}</div><span>${c[1]}</span><strong>${c[2]}</strong><small title="${safe(c[3])}">${c[3]}</small></div>`).join('');
}
function requirementNames(b){return [['drillingRequired','Drilling'],['parkwayItems','Parkway'],['airPicks','Air Pick'],['osItems','O/S Items'],['paintedOrder','Painted'],['madeToMeasure','MTM']].filter(([k])=>b[k]).map(x=>x[1])}
function card(b,options={}){
  const status=displayStatus(b),priority=(b.priority||'Normal'),req=requirementNames(b),showTime=Boolean(options.showTime);
  return `<article class="booking-card status-${status.toLowerCase().replace(/\s+/g,'-')}" draggable="true" data-id="${b.id}">
    <div class="card-top"><span class="card-order">${safe(b.orderNumber)}</span>${priority!=='Normal'?`<span class="card-priority ${priority.toLowerCase()}">${safe(priority)}</span>`:''}</div>
    <div class="card-status-row"><span class="pill status ${status.toLowerCase().replace(/\s+/g,'-')}">${safe(status)}</span></div>
    <div class="card-customer">${safe(b.customer)}</div>
    <div class="card-meta">${Number(b.itemCount||0)} items${showTime&&b.collectionTime?` · ${safe(b.collectionTime)}`:''}</div>
    <div class="card-badges">${req.slice(0,3).map(r=>`<span class="pill requirement">${safe(r)}</span>`).join('')}${req.length>3?`<span class="pill requirement">+${req.length-3}</span>`:''}${b.accountStatus==='Held'?'<span class="pill held">Held</span>':''}</div>
  </article>`;
}
function renderOrderTab(tab){
  document.querySelectorAll('[data-order-tab]').forEach(x=>x.classList.toggle('active',x.dataset.orderTab===tab)); const b=state.selected;if(!b)return;
  if(tab==='notes'){$('orderPanelContent').innerHTML=`<div class="order-summary"><div class="summary-hero"><strong>Order notes</strong><p>${safe(b.notes||'No notes have been added.')}</p></div></div>`;return}
  if(tab==='activity'){const a=state.activity.filter(x=>x.bookingId===b.id).sort((x,y)=>String(y.timestamp).localeCompare(String(x.timestamp)));$('orderPanelContent').innerHTML=`<div class="order-summary">${a.length?a.map(x=>`<div class="notice"><strong>${safe(x.action)}</strong><span>${safe(x.details||'')}</span><small>${safe(x.performedBy)} · ${safe(formatDateTime(x.timestamp))}</small></div>`).join(''):'<div class="empty-state">No activity recorded.</div>'}</div>`;return}
  const req=requirementNames(b); const valEx=Number(b.orderValueExVAT||0).toLocaleString('en-GB',{style:'currency',currency:'GBP'}),valInc=Number(b.orderValueIncVAT||0).toLocaleString('en-GB',{style:'currency',currency:'GBP'});
  $('orderPanelTitle').textContent=b.orderNumber||'Order';
  $('orderPanelStatus').innerHTML=`<span class="pill status ${displayStatus(b).toLowerCase().replace(/\s+/g,'-')}">${safe(displayStatus(b))}</span>`;
  $('orderPanelContent').innerHTML=`<div class="order-summary">
    <div class="summary-hero"><div class="card-badges"><span class="pill status ${displayStatus(b).toLowerCase().replace(/\s+/g,'-')}">${safe(displayStatus(b))}</span>${b.priority!=='Normal'?`<span class="card-priority ${safe(b.priority.toLowerCase())}">${safe(b.priority)}</span>`:''}${b.accountStatus==='Held'?'<span class="pill held">Account Held</span>':''}</div><h3>${safe(b.customer)}</h3><p>${safe(b.bookingType)} · ${Number(b.itemCount||0)} items</p></div>
    <div class="tracker">${['Waiting','Picking','Ready','Collected'].map((s,i)=>`<div class="tracker-step ${trackerDone(b,i)?'done':''}">${s}</div>`).join('')}</div>
    <div class="summary-row"><span>Collection</span><strong>${safe(b.collectionDate)}${b.collectionTime?' at '+safe(b.collectionTime):''}</strong></div>
    <div class="summary-row"><span>Assigned picker</span><strong>${safe(b.assignedPicker||'Unassigned')}</strong></div>
    <div class="summary-row"><span>Payment</span><strong>${safe(b.paymentType||'—')} · ${safe(b.paymentStatus||'—')}</strong></div>
    <div class="summary-row"><span>Order value</span><strong>${valEx} ex VAT<br><small>${valInc} inc VAT</small></strong></div>
    <div class="summary-row"><span>Booked by</span><strong>${safe(b.bookedBy||'—')}</strong></div>
    <h4>Order requirements</h4><div class="requirement-pills">${req.length?req.map(r=>`<span class="pill requirement">${safe(r)}</span>`).join(''):'<span class="pill">No special requirements</span>'}</div>
  </div>`;
}
function renderDashboard(){
  const today=localDate(new Date()),todays=state.bookings.filter(b=>b.collectionDate===today).sort(sortBookings),waiting=todays.filter(b=>b.collectionStatus==='Customer Waiting'&&b.collectionStatus!=='Collected');
  const active=state.team.filter(t=>t.active&&t.role!=='Manager');
  const workload=active.map(t=>({name:t.name,count:todays.filter(b=>b.assignedPicker===t.name&&b.collectionStatus!=='Collected').length})); const max=Math.max(1,...workload.map(x=>x.count));
  $('pageBody').innerHTML=`<div class="dashboard-grid">
    <section class="dashboard-section"><h3>Today’s Queue</h3>${todays.length?todays.slice(0,12).map(b=>`<div class="queue-row" data-id="${b.id}"><strong>${safe(b.collectionTime||'Anytime')}</strong><span>${safe(b.orderNumber)} · ${safe(b.customer)}</span><span class="pill status">${safe(displayStatus(b))}</span></div>`).join(''):'<div class="empty-state">No collections today.</div>'}</section>
    <section class="dashboard-section"><h3>Customer Waiting</h3>${waiting.length?waiting.map(b=>`<div class="queue-row" data-id="${b.id}"><strong>${safe(b.collectionTime||'Now')}</strong><span>${safe(b.orderNumber)} · ${safe(b.customer)}</span><span class="pill held">Priority</span></div>`).join(''):'<div class="empty-state">No customers currently waiting.</div>'}</section>
    <section class="dashboard-section" style="grid-column:1/-1;border-top:1px solid var(--line);border-right:0"><h3>Team Workload</h3>${workload.length?workload.map(w=>`<div class="workload-row"><strong>${safe(w.name)}</strong><div class="workload-bar"><i style="width:${Math.round(w.count/max*100)}%"></i></div><span>${w.count} active</span></div>`).join(''):'<div class="empty-state">No active team members configured.</div>'}</section>
  </div>`; document.querySelectorAll('.queue-row[data-id]').forEach(x=>x.onclick=()=>openOrder(x.dataset.id));
}
let reportResult=null;
function renderReports(){
  $('pageBody').innerHTML=`<div class="report-shell"><div class="report-controls"><label>From date<input id="reportFrom" type="date"></label><label>To date<input id="reportTo" type="date"></label><button id="runReport" class="primary">Run Report</button></div><div id="reportResults">${reportResult?reportMarkup(reportResult):'<div class="empty-state"><strong>Select a date range</strong><p>Reports are only generated after you choose the period you want to review.</p></div>'}</div></div>`;
  $('runReport').onclick=async()=>{const from=$('reportFrom').value,to=$('reportTo').value;if(!from||!to){showToast('Select both a From and To date.','error');return}if(from>to){showToast('The From date must be before the To date.','error');return}setLoading(true,'Generating report…');try{reportResult=await api('reports',{from,to});$('reportResults').innerHTML=reportMarkup(reportResult)}catch(e){showToast(e.message,'error')}finally{setLoading(false)}};
}
function reportMarkup(r){const s=r.summary||{},days=r.byDay||{};return `<div class="stats" style="padding:16px;margin:0"><div class="stat"><div class="stat-icon">▣</div><span>Bookings</span><strong>${s.bookings||0}</strong><small>Selected range</small></div><div class="stat"><div class="stat-icon">✓</div><span>Collected</span><strong>${s.collected||0}</strong><small>Completed collections</small></div><div class="stat"><div class="stat-icon">◷</div><span>Average wait</span><strong>${s.averageWaitMinutes||0}m</strong><small>Waiting to collected</small></div><div class="stat"><div class="stat-icon">⇆</div><span>Average pick</span><strong>${s.averagePickMinutes||0}m</strong><small>Picking to ready</small></div><div class="stat"><div class="stat-icon">£</div><span>Sales inc VAT</span><strong>£${Number(s.totalSalesIncVAT||0).toLocaleString('en-GB',{minimumFractionDigits:2})}</strong><small>Selected range</small></div></div><table><thead><tr><th>Date</th><th>Bookings</th><th>Collected</th><th>Sales ex VAT</th><th>Sales inc VAT</th></tr></thead><tbody>${Object.keys(days).sort().map(d=>`<tr><td>${safe(d)}</td><td>${days[d].bookings}</td><td>${days[d].collected}</td><td>£${Number(days[d].salesExVAT).toFixed(2)}</td><td>£${Number(days[d].salesIncVAT).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="5">No records in this period.</td></tr>'}</tbody></table>`}
async function saveBooking(e){
  e.preventDefault();if(!validWeekday($('collectionDate').value)){showToast('Collection dates must be Monday to Friday.','error');return}
  const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','notes'],b={};fields.forEach(k=>b[k==='bookingId'?'id':k]=$(k).value);['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>b[k]=$(k).checked);
  const oldIndex=state.bookings.findIndex(x=>x.id===b.id),old=oldIndex>=0?{...state.bookings[oldIndex]}:null,temp={...(old||{}),...b,id:b.id||`temp-${Date.now()}`,orderValueIncVAT:Number(b.orderValueExVAT||0)*(1+Number(state.config.VAT_PERCENT||20)/100)};
  if(oldIndex>=0)state.bookings[oldIndex]=temp;else state.bookings.push(temp);$('bookingModal').classList.add('hidden');renderAll();showToast('Saving booking…');
  try{const r=await api('save',{payload:JSON.stringify(b)});const idx=state.bookings.findIndex(x=>x.id===temp.id);if(idx>=0)state.bookings[idx]=r.booking;showToast('Booking saved successfully');await loadData()}
  catch(err){if(oldIndex>=0)state.bookings[oldIndex]=old;else state.bookings=state.bookings.filter(x=>x.id!==temp.id);renderAll();showToast(`Booking was not saved: ${err.message}`,'error')}
}
async function quickUpdate(id,changes){
  const idx=state.bookings.findIndex(b=>b.id===id);if(idx<0)return;const before={...state.bookings[idx]};state.bookings[idx]={...before,...changes};state.selected=state.bookings[idx];renderAll();if(!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');
  try{const r=await api('quick',{id,changes:JSON.stringify(changes)});state.bookings[idx]=r.booking;state.selected=r.booking;showToast('Order updated');renderAll();if(!$('orderPanel').classList.contains('hidden'))renderOrderTab('details')}
  catch(e){state.bookings[idx]=before;state.selected=before;renderAll();showToast(`Update failed: ${e.message}`,'error')}
}
// Replace the unusual diamond with a conventional bell shape without external libraries.


/* ===== Trade Counter Operations Hub v1.3.2 operational update ===== */
function resetPlannerFilters(){
  ['searchInput','statusFilter','pickerFilter','priorityFilter'].forEach(id=>{const el=$(id);if(el)el.value=''});
}
function statusSlug(value){return String(value||'').toLowerCase().replace(/\s+/g,'-')}
function isCollected(b){return b.collectionStatus==='Collected'}
function isCustomerWaiting(b){return b.collectionStatus==='Customer Waiting'}
function pickStatusPill(b){
  if(isCollected(b))return '';
  const s=b.pickStatus||'Waiting';
  return `<span class="pill status ${statusSlug(s)}">${safe(s)}</span>`;
}
function collectionStatusPill(b){
  if(isCollected(b))return '<span class="pill collected">Collected</span>';
  return isCustomerWaiting(b)?'<span class="pill collection-waiting">Customer Waiting</span>':'';
}
function priorityPill(b){
  const p=b.priority||'Normal';
  return p==='Normal'?'':`<span class="pill priority-${statusSlug(p)}">${safe(p)}</span>`;
}
function accountPill(b){
  return b.accountStatus==='Held'?'<span class="pill held">Held</span>':'<span class="pill released">Released</span>';
}
function paymentPill(b){
  return b.paymentStatus==='Paid'?'<span class="pill paid">Paid</span>':'<span class="pill payment-required">Payment Required</span>';
}
function filtered(){
  const q=$('searchInput').value.toLowerCase(),sf=$('statusFilter').value,pf=$('pickerFilter').value,pr=$('priorityFilter').value;
  return state.bookings.filter(b=>{
    const statusMatch=!sf||b.pickStatus===sf||b.collectionStatus===sf;
    return (!q||`${b.orderNumber} ${b.customer}`.toLowerCase().includes(q))&&statusMatch&&(!pf||b.assignedPicker===pf)&&(!pr||b.priority===pr);
  });
}
function sortBookings(a,b){
  const walkA=a.bookingType==='Walk in'?0:1,walkB=b.bookingType==='Walk in'?0:1;
  if(walkA!==walkB)return walkA-walkB;
  const waitA=isCustomerWaiting(a)&&a.pickStatus!=='Ready'?0:1,waitB=isCustomerWaiting(b)&&b.pickStatus!=='Ready'?0:1;
  if(waitA!==waitB)return waitA-waitB;
  const rank={Urgent:0,High:1,Normal:2};
  if((rank[a.priority]??2)!==(rank[b.priority]??2))return (rank[a.priority]??2)-(rank[b.priority]??2);
  return `${a.collectionTime||'99:99'}${a.orderNumber||''}`.localeCompare(`${b.collectionTime||'99:99'}${b.orderNumber||''}`);
}
async function setPage(p){
  state.page=p;
  document.querySelectorAll('.sidebar [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  const titles={dashboard:['Dashboard','Today’s operational overview and team workload'],advance:['Advance Picks','View and manage timed large-order collections'],small:['Small Orders','Manage small orders and walk-in collections'],board:['Picking Board','Prioritise and progress all picking work'],reports:['Reports','Customer service, picking and sales performance'],settings:['Settings','Manage your profile and application settings']};
  $('pageTitle').textContent=titles[p][0];$('pageSubtitle').textContent=titles[p][1];
  $('plannerControls').classList.toggle('hidden',['dashboard','reports','settings'].includes(p));$('filterPanel').classList.add('hidden');$('stats').classList.toggle('hidden',['settings','reports'].includes(p));
  if(p==='dashboard'||p==='board'){
    state.day=new Date();state.viewMode='day';resetPlannerFilters();await loadData();return;
  }
  if(p==='advance'||p==='small'){
    state.weekStart=startOfWeek(new Date());state.day=new Date();state.viewMode='week';resetPlannerFilters();await loadData();return;
  }
  if(p==='settings'){renderAll();openSettings();return}
  renderAll();
}
function minutesBetween(start,end){
  if(!start||!end)return null;const a=new Date(start),b=new Date(end);const m=Math.round((b-a)/60000);return Number.isFinite(m)&&m>=0?m:null;
}
function money(v){return Number(v||0).toLocaleString('en-GB',{style:'currency',currency:'GBP'})}
function renderDashboard(){
  const today=localDate(new Date()),todays=state.bookings.filter(b=>b.collectionDate===today).sort(sortBookings);
  const waiting=todays.filter(b=>isCustomerWaiting(b)&&!isCollected(b));
  const waitTimes=todays.map(b=>minutesBetween(b.customerWaitingAt,b.collectedAt)).filter(v=>v!==null);
  const pickTimes=todays.map(b=>minutesBetween(b.pickingStartedAt,b.readyAt)).filter(v=>v!==null);
  const avgWait=waitTimes.length?Math.round(waitTimes.reduce((a,b)=>a+b,0)/waitTimes.length):0;
  const avgPick=pickTimes.length?Math.round(pickTimes.reduce((a,b)=>a+b,0)/pickTimes.length):0;
  const invoiced=todays.filter(isCollected).reduce((a,b)=>a+Number(b.orderValueIncVAT||0),0);
  const expected=todays.filter(b=>!isCollected(b)&&b.pickStatus!=='Cancelled').reduce((a,b)=>a+Number(b.orderValueIncVAT||0),0);
  const active=state.team.filter(t=>t.active&&t.role!=='Manager');
  const workload=active.map(t=>({name:t.name,count:todays.filter(b=>b.assignedPicker===t.name&&!isCollected(b)&&b.pickStatus!=='Cancelled').length}));const max=Math.max(1,...workload.map(x=>x.count));
  $('pageBody').innerHTML=`
    <div class="dashboard-metrics">
      <div class="dashboard-metric"><span>Today’s average wait</span><strong>${avgWait} min</strong><small>Customer waiting to collected</small></div>
      <div class="dashboard-metric"><span>Today’s invoiced value</span><strong>${money(invoiced)}</strong><small>Collected orders inc VAT</small></div>
      <div class="dashboard-metric"><span>Expected invoice value</span><strong>${money(expected)}</strong><small>Booked but not yet collected</small></div>
      <div class="dashboard-metric"><span>Today’s average pick</span><strong>${avgPick} min</strong><small>Picking started to ready</small></div>
    </div>
    <div class="dashboard-grid">
      <section class="dashboard-section"><h3>Today’s Queue</h3>${todays.length?todays.slice(0,14).map(b=>`<div class="queue-row" data-id="${b.id}"><strong>${safe(b.collectionTime||'Anytime')}</strong><span>${safe(b.orderNumber)} · ${safe(b.customer)}</span><span>${pickStatusPill(b)}${collectionStatusPill(b)}</span></div>`).join(''):'<div class="empty-state">No collections today.</div>'}</section>
      <section class="dashboard-section"><h3>Customer Waiting</h3>${waiting.length?waiting.map(b=>`<div class="queue-row" data-id="${b.id}"><strong>${safe(b.collectionTime||'Now')}</strong><span>${safe(b.orderNumber)} · ${safe(b.customer)}</span><span class="pill held">Immediate action</span></div>`).join(''):'<div class="empty-state">No customers currently waiting.</div>'}</section>
      <section class="dashboard-section" style="grid-column:1/-1;border-top:1px solid var(--line);border-right:0"><h3>Team Workload</h3>${workload.length?workload.map(w=>`<div class="workload-row"><strong>${safe(w.name)}</strong><div class="workload-bar"><i style="width:${Math.round(w.count/max*100)}%"></i></div><span>${w.count} active</span></div>`).join(''):'<div class="empty-state">No active team members configured.</div>'}</section>
    </div>`;
  document.querySelectorAll('.queue-row[data-id]').forEach(x=>x.onclick=()=>openOrder(x.dataset.id));
}
function currentTimeRowInfo(){
  const now=new Date(),today=localDate(now),slots=timeSlots();const total=now.getHours()*60+now.getMinutes();
  for(let i=0;i<slots.length;i++){
    const [h,m]=slots[i].split(':').map(Number),start=h*60+m,end=start+Number(state.config.SLOT_MINUTES||30);
    if(total>=start&&total<end)return {today,time:slots[i],offset:((total-start)/(end-start))*100};
  }
  return null;
}
function renderTimedCalendar(){
  const days=visibleDays(),bookings=filtered().filter(b=>b.bookingType==='Advance Large Order'),current=currentTimeRowInfo(),todayVisible=days.some(d=>localDate(d)===current?.today);
  let html=`<div class="calendar-wrap ${state.viewMode==='day'?'day-view':''}"><div class="calendar-grid"><div class="cal-cell cal-head"></div>${days.map(d=>`<div class="cal-cell cal-head">${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>`).join('')}`;
  for(const time of timeSlots()){
    const currentRow=todayVisible&&current&&current.time===time,style=currentRow?` style="--current-offset:${current.offset}%"`:'';
    html+=`<div class="cal-cell time-cell ${currentRow?'current-time-cell':''}"${style}>${time}</div>`;
    for(const d of days){const date=localDate(d),block=isBlocked(date,time);html+=`<div class="cal-cell slot ${block?'blocked':''} ${currentRow?'current-time-cell':''}"${style} data-date="${date}" data-time="${time}">${block?safe(block.label||'Blocked'):bookings.filter(b=>b.collectionDate===date&&normaliseTime(b.collectionTime)===time).sort(sortBookings).map(b=>card(b)).join('')}</div>`}
  }
  html+='</div></div>';$('pageBody').innerHTML=html;wireCards();
}
function card(b,options={}){
  const req=requirementNames(b),showTime=Boolean(options.showTime),walk=b.bookingType==='Walk in';
  return `<article class="booking-card status-${statusSlug(b.pickStatus)} ${walk?'walk-in-card':''}" draggable="true" data-id="${safe(b.id)}">
    <div class="card-layout"><div class="card-main">
      <div class="card-order">${safe(b.orderNumber)}</div>
      <div class="card-customer">${safe(b.customer)}</div>
      <div class="card-meta">${Number(b.itemCount||0)} items${showTime&&b.collectionTime?` · ${safe(b.collectionTime)}`:''}</div>
      <div class="card-badges">${req.slice(0,3).map(r=>`<span class="pill requirement">${safe(r)}</span>`).join('')}${req.length>3?`<span class="pill requirement">+${req.length-3}</span>`:''}</div>
    </div><div class="card-status-stack">${walk?'<span class="pill walk-in">Walk-in</span>':''}${pickStatusPill(b)}${collectionStatusPill(b)}${priorityPill(b)}</div></div>
    <div class="card-account-row">${accountPill(b)}</div>
  </article>`;
}
function renderSmallCalendar(){
  const days=visibleDays(),b=filtered().filter(x=>['Small Order','Walk in'].includes(x.bookingType));
  $('pageBody').innerHTML=`<div class="small-calendar">${days.map(d=>{const date=localDate(d);return `<section class="day-column" data-date="${date}"><h3>${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</h3>${b.filter(x=>x.collectionDate===date).sort(sortBookings).map(x=>card(x,{showTime:true})).join('')}</section>`}).join('')}</div>`;wireCards();
}
function renderBoard(){
  const all=filtered().filter(b=>state.viewMode==='week'||b.collectionDate===localDate(state.day));
  const renderSection=(title,items)=>`<div class="board-section"><h2>${title}</h2><div class="board">${PICK_STATUSES.map(s=>`<section class="board-col"><div class="board-head"><span>${s}</span><span>${items.filter(b=>b.pickStatus===s).length}</span></div><div class="board-list" data-status="${s}">${items.filter(b=>b.pickStatus===s).sort(sortBookings).map(b=>card(b,{showTime:true})).join('')}</div></section>`).join('')}</div></div>`;
  $('pageBody').innerHTML=renderSection('Advance Picks',all.filter(b=>b.bookingType==='Advance Large Order'))+renderSection('Small Orders / Walk ins',all.filter(b=>b.bookingType!=='Advance Large Order'));wireCards();
}
function notifications(){
  return state.bookings.flatMap(b=>{const arr=[];
    if(isLate(b))arr.push({type:'Overdue',b,msg:'Collection time has passed'});
    if(needsPickSoon(b))arr.push({type:'Pick due',b,msg:'Not ready within 30 minutes of collection'});
    if(isCustomerWaiting(b)&&b.pickStatus!=='Ready'&&!isCollected(b))arr.push({type:'Customer waiting',b,msg:`Customer is waiting while order is ${b.pickStatus||'Waiting'}`});
    if(['Problem','Cancelled'].includes(b.pickStatus))arr.push({type:b.pickStatus,b,msg:b.pickStatus==='Problem'?'Order has a problem':'Booking is cancelled'});
    return arr;
  });
}
function openOrder(id){
  state.selected=state.bookings.find(b=>b.id===id);if(!state.selected)return;
  $('orderPanelTitle').textContent=state.selected.orderNumber||'Order';
  $('orderPanel').classList.remove('hidden');$('orderPanel').scrollTop=0;renderOrderTab('details');
}
function renderOrderTab(tab){
  document.querySelectorAll('[data-order-tab]').forEach(x=>x.classList.toggle('active',x.dataset.orderTab===tab));const b=state.selected;if(!b)return;
  $('orderPanelTitle').textContent=b.orderNumber||'Order';
  $('orderPanelStatus').innerHTML=`<span class="order-status-stack">${pickStatusPill(b)}${collectionStatusPill(b)}</span>`;
  if(tab==='notes'){$('orderPanelContent').innerHTML=`<div class="order-summary"><div class="summary-hero"><strong>Order notes</strong><p>${safe(b.notes||'No notes have been added.')}</p></div></div>`;return}
  if(tab==='activity'){const a=state.activity.filter(x=>x.bookingId===b.id).sort((x,y)=>String(y.timestamp).localeCompare(String(x.timestamp)));$('orderPanelContent').innerHTML=`<div class="order-summary">${a.length?a.map(x=>`<div class="notice"><strong>${safe(x.action)}</strong><span>${safe(x.details||'')}</span><small>${safe(x.performedBy)} · ${safe(formatDateTime(x.timestamp))}</small></div>`).join(''):'<div class="empty-state">No activity recorded.</div>'}</div>`;return}
  const req=requirementNames(b),valEx=money(b.orderValueExVAT),valInc=money(b.orderValueIncVAT);
  $('orderPanelContent').innerHTML=`<div class="order-summary">
    <div class="summary-hero"><div class="summary-hero-row"><div class="summary-customer"><h3>${safe(b.customer)}</h3><p>${safe(b.bookingType)} · ${Number(b.itemCount||0)} items</p></div><div class="summary-indicators">${priorityPill(b)}${accountPill(b)}${paymentPill(b)}</div></div></div>
    <div class="tracker">${['Waiting','Picking','Ready','Collected'].map((s,i)=>`<div class="tracker-step ${trackerDone(b,i)?'done':''}">${s}</div>`).join('')}</div>
    <div class="summary-row"><span>Collection</span><strong>${safe(b.collectionDate)}${b.collectionTime?' at '+safe(b.collectionTime):''}</strong></div>
    <div class="summary-row"><span>Assigned picker</span><strong>${safe(b.assignedPicker||'Unassigned')}</strong></div>
    <div class="summary-row"><span>Payment</span><strong>${safe(b.paymentType||'—')} · ${safe(b.paymentStatus||'—')}</strong></div>
    <div class="summary-row"><span>Order value</span><strong>${valEx} ex VAT<br><small>${valInc} inc VAT</small></strong></div>
    <div class="summary-row"><span>Booked by</span><strong>${safe(b.bookedBy||'—')}</strong></div>
    <h4>Order requirements</h4><div class="requirement-pills">${req.length?req.map(r=>`<span class="pill requirement">${safe(r)}</span>`).join(''):'<span class="pill">No special requirements</span>'}</div>
  </div>`;
  $('panelWaiting').disabled=isCustomerWaiting(b)||isCollected(b);
  $('panelReady').disabled=b.pickStatus==='Ready'||isCollected(b);
  $('panelCollected').disabled=isCollected(b)||b.pickStatus!=='Ready';
}
function resetBookingModalScroll(){const card=document.querySelector('#bookingModal .modal-card');if(card)card.scrollTop=0}
function openBooking(id){
  state.editing=id?state.bookings.find(x=>x.id===id):null;const b=state.editing||{collectionDate:localDate(new Date()),bookingType:'Advance Large Order',pickStatus:'Waiting',paymentStatus:'Payment Required',accountStatus:'Released',priority:'Normal'};
  $('modalTitle').textContent=id?`Edit ${b.orderNumber}`:'New Booking';const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','orderValueIncVAT','notes'];fields.forEach(k=>{const el=$(k),key=k==='bookingId'?'id':k;if(el)el.value=b[key]??''});['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>$(k).checked=!!b[k]);updateTimeOptions();$('collectionTime').value=b.collectionTime||'';$('deleteBookingBtn').classList.toggle('hidden',!id);$('bookingModal').classList.remove('hidden');resetBookingModalScroll();calcVat();
}
async function saveBooking(e){
  e.preventDefault();if(!validWeekday($('collectionDate').value)){showToast('Collection dates must be Monday to Friday.','error');return}
  if($('collectionStatus').value==='Collected'&&$('pickStatus').value!=='Ready'){showToast('An order can only be marked Collected after it is Ready.','error');return}
  const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','notes'],b={};fields.forEach(k=>b[k==='bookingId'?'id':k]=$(k).value);['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>b[k]=$(k).checked);
  const oldIndex=state.bookings.findIndex(x=>x.id===b.id),old=oldIndex>=0?{...state.bookings[oldIndex]}:null,temp={...(old||{}),...b,id:b.id||`temp-${Date.now()}`,orderValueIncVAT:Number(b.orderValueExVAT||0)*(1+Number(state.config.VAT_PERCENT||20)/100)};
  if(oldIndex>=0)state.bookings[oldIndex]=temp;else state.bookings.push(temp);if(state.selected&&state.selected.id===temp.id)state.selected=temp;$('bookingModal').classList.add('hidden');resetBookingModalScroll();renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');showToast('Saving booking…');
  try{const r=await api('save',{payload:JSON.stringify(b)});const idx=state.bookings.findIndex(x=>x.id===temp.id);if(idx>=0)state.bookings[idx]=r.booking;if(state.selected&&(state.selected.id===temp.id||state.selected.id===r.booking.id))state.selected=r.booking;showToast('Booking saved successfully');renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');await loadData()}
  catch(err){if(oldIndex>=0)state.bookings[oldIndex]=old;else state.bookings=state.bookings.filter(x=>x.id!==temp.id);state.selected=old||state.selected;renderAll();showToast(`Booking was not saved: ${err.message}`,'error')}
}
async function quickUpdate(id,changes){
  const idx=state.bookings.findIndex(b=>b.id===id);if(idx<0)return;const before={...state.bookings[idx]};
  const proposed={...before,...changes};if(proposed.collectionStatus==='Collected'&&proposed.pickStatus!=='Ready'){showToast('Mark the order Ready before marking it Collected.','error');return}
  state.bookings[idx]=proposed;if(state.selected&&state.selected.id===id)state.selected=proposed;renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');
  try{const r=await api('quick',{id,changes:JSON.stringify(changes)});state.bookings[idx]=r.booking;if(state.selected&&state.selected.id===id)state.selected=r.booking;showToast('Order updated');renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details')}
  catch(e){state.bookings[idx]=before;if(state.selected&&state.selected.id===id)state.selected=before;renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');showToast(`Update failed: ${e.message}`,'error')}
}
// Add Web/online without changing the existing Apps Script data model.
if($('paymentType')&&!Array.from($('paymentType').options).some(o=>o.value==='Web/online'))$('paymentType').add(new Option('Web/online','Web/online'));
// Ensure all booking modal close actions reset scroll position.
document.querySelectorAll('[data-close="bookingModal"]').forEach(btn=>btn.addEventListener('click',resetBookingModalScroll));
// Re-bind quick action buttons with the new status rules.
$('panelReady').onclick=()=>quickUpdate(state.selected.id,{pickStatus:'Ready'});
$('panelWaiting').onclick=()=>quickUpdate(state.selected.id,{collectionStatus:'Customer Waiting'});
$('panelCollected').onclick=()=>quickUpdate(state.selected.id,{collectionStatus:'Collected'});


/* ===== v1.3.3 live synchronisation and user presence ===== */
state.presence=[];
state.liveSyncTimer=null;
state.lastSilentSync=0;
state.activeOrderTab='details';

function getSessionId(){
  let id=sessionStorage.getItem('tch_session_id');
  if(!id){id=(window.crypto&&window.crypto.randomUUID)?window.crypto.randomUUID():`session-${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem('tch_session_id',id)}
  return id;
}
function getDeviceLabel(){
  const ua=navigator.userAgent||'';
  if(/Mobile|Android|iPhone|iPad/i.test(ua))return 'Mobile / tablet';
  return 'Desktop browser';
}
function presenceAvatarHtml(user){
  if(user.profileImage)return `<span class="presence-avatar" style="background-image:url('${safe(user.profileImage)}')"></span>`;
  const idx=Math.max(0,Number(String(user.avatar||'avatar-1').split('-')[1])-1);
  return `<span class="presence-avatar">${safe(AVATARS[idx]||AVATARS[0])}</span>`;
}
function renderPresence(){
  const list=$('presenceList'),count=$('presenceCount');if(!list||!count)return;
  const users=(state.presence||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  count.textContent=users.length;
  list.innerHTML=users.length?users.map(u=>`<div class="presence-user" title="${safe(u.name)} · ${safe(u.role)}">${presenceAvatarHtml(u)}<span class="presence-user-text"><strong>${safe(u.name)}${state.user&&u.name===state.user.name?' · You':''}</strong><small>${safe(u.role)}</small></span></div>`).join(''):'<span class="presence-empty">No users currently online</span>';
  list.insertAdjacentHTML('beforeend','<span class="live-sync-state">Live updates active</span>');
}
function applySyncResponse(r){
  const selectedId=state.selected&&state.selected.id;
  state.bookings=r.bookings||[];state.activity=r.activity||[];state.team=r.team||state.team;state.config=r.config||state.config;state.blocks=r.blocks||state.blocks;state.presence=r.presence||state.presence||[];
  if(selectedId)state.selected=state.bookings.find(b=>b.id===selectedId)||null;
  renderAll();renderPresence();
  if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab(state.activeOrderTab||'details');
}
async function loadData(options={}){
  const silent=Boolean(options.silent),from=localDate(state.viewMode==='day'?state.day:state.weekStart),to=localDate(state.viewMode==='day'?state.day:addDays(state.weekStart,6));
  if(!silent)setLoading(true,'Updating Trade Counter information…');
  try{const r=await api('sync',{from,to});applySyncResponse(r);state.lastSilentSync=Date.now()}
  catch(e){if(!silent)showToast(e.message,'error')}
  finally{if(!silent)setLoading(false)}
}
function stopLiveSync(){if(state.liveSyncTimer){clearInterval(state.liveSyncTimer);state.liveSyncTimer=null}}
function startLiveSync(){
  stopLiveSync();const interval=Math.max(10000,Number(CFG.SYNC_INTERVAL_MS||15000));
  state.liveSyncTimer=setInterval(()=>{
    if(!state.user)return;
    const hidden=document.hidden;
    if(hidden&&Date.now()-state.lastSilentSync<45000)return;
    loadData({silent:true});
  },interval);
}
async function enterApp(){
  try{const b=await api('bootstrap');state.user=b.user;state.team=b.team||[];state.config=b.config||state.config;state.blocks=b.blocks||[];state.presence=b.presence||[];$('loginScreen').classList.add('hidden');$('app').classList.remove('hidden');updateUserChip();renderPresence();await loadData();startLiveSync();await setPage('advance')}
  catch(err){stopLiveSync();clearSession();$('loginScreen').classList.remove('hidden');$('app').classList.add('hidden');$('loginError').textContent=err.message}
}
async function signOut(){
  stopLiveSync();try{await api('signout')}catch(e){}clearSession();sessionStorage.removeItem('tch_session_id');location.reload();
}
$('logoutBtn').onclick=signOut;
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user)loadData({silent:true})});
window.addEventListener('focus',()=>{if(state.user)loadData({silent:true})});
document.querySelectorAll('[data-order-tab]').forEach(x=>x.addEventListener('click',()=>{state.activeOrderTab=x.dataset.orderTab||'details'}));


/* ===== v1.3.4 stability, integrity and collaboration safeguards ===== */
state.syncInFlight=false;state.syncQueued=false;state.syncSequence=0;state.appliedSyncSequence=0;state.serverOffsetMs=0;state.lastSuccessfulSync=0;state.dataRevision='';state.connectionTimer=null;
function operationalNow(){return new Date(Date.now()+Number(state.serverOffsetMs||0))}
function nowLondon(){return operationalNow()}
function updateConnectionState(mode,message){const el=$('connectionState');if(!el)return;el.className='connection-state '+mode;el.innerHTML=`<span></span><strong>${safe(message)}</strong>`}
function refreshConnectionLabel(){if(!state.user)return;const age=Date.now()-Number(state.lastSuccessfulSync||0);if(!state.lastSuccessfulSync)updateConnectionState('connecting','Connecting…');else if(age>90000)updateConnectionState('offline',`Updates paused · last connected ${new Date(state.lastSuccessfulSync).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`);else if(state.syncInFlight)updateConnectionState('connecting','Updating…');else updateConnectionState('live',`Live · updated ${Math.max(0,Math.round(age/1000))}s ago`)}
function applySyncResponse(r,seq){if(seq&&seq<state.appliedSyncSequence)return;state.appliedSyncSequence=seq||state.appliedSyncSequence;if(r.serverTime){const server=new Date(r.serverTime);if(!isNaN(server))state.serverOffsetMs=server.getTime()-Date.now()}state.dataRevision=r.revision??state.dataRevision;state.lastSuccessfulSync=Date.now();const selectedId=state.selected&&state.selected.id;state.bookings=r.bookings||[];state.activity=r.activity||[];state.team=r.team||state.team;state.config=r.config||state.config;state.blocks=r.blocks||state.blocks;state.presence=r.presence||state.presence||[];if(selectedId)state.selected=state.bookings.find(b=>b.id===selectedId)||null;renderAll();renderPresence();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab(state.activeOrderTab||'details');refreshConnectionLabel()}
async function loadData(options={}){const silent=Boolean(options.silent),from=localDate(state.viewMode==='day'?state.day:state.weekStart),to=localDate(state.viewMode==='day'?state.day:addDays(state.weekStart,6));if(state.syncInFlight){state.syncQueued=true;return}state.syncInFlight=true;const seq=++state.syncSequence;if(!silent)setLoading(true,'Updating Trade Counter information…');refreshConnectionLabel();try{const r=await api('sync',{from,to,lastRevision:state.dataRevision||''});applySyncResponse(r,seq);state.lastSilentSync=Date.now()}catch(e){if(!silent)showToast(e.message,'error');refreshConnectionLabel()}finally{state.syncInFlight=false;if(!silent)setLoading(false);refreshConnectionLabel();if(state.syncQueued){state.syncQueued=false;setTimeout(()=>loadData({silent:true}),250)}}
function startLiveSync(){stopLiveSync();const interval=Math.max(20000,Number(CFG.SYNC_INTERVAL_MS||25000));state.liveSyncTimer=setInterval(()=>{if(!state.user)return;if(document.hidden&&Date.now()-state.lastSilentSync<60000)return;loadData({silent:true})},interval);clearInterval(state.connectionTimer);state.connectionTimer=setInterval(refreshConnectionLabel,5000)}
function stopLiveSync(){if(state.liveSyncTimer){clearInterval(state.liveSyncTimer);state.liveSyncTimer=null}if(state.connectionTimer){clearInterval(state.connectionTimer);state.connectionTimer=null}}
function notifications(){return state.bookings.map(b=>{if(isCollected(b))return null;if(isCustomerWaiting(b)&&b.pickStatus!=='Ready')return {type:'Customer waiting',severity:1,b,msg:`Immediate action: customer waiting while order is ${b.pickStatus||'Waiting'}`};if(b.pickStatus==='Problem')return {type:'Problem',severity:2,b,msg:'Order has a problem requiring action'};if(isLate(b))return {type:'Overdue',severity:3,b,msg:'Collection time has passed'};if(needsPickSoon(b))return {type:'Pick due',severity:4,b,msg:'Not ready within 30 minutes of collection'};if(b.pickStatus==='Cancelled')return {type:'Cancelled',severity:5,b,msg:'Booking is cancelled'};return null}).filter(Boolean).sort((a,b)=>a.severity-b.severity||String(a.b.collectionTime).localeCompare(String(b.b.collectionTime)))}
function openBooking(id){state.editing=id?state.bookings.find(x=>x.id===id):null;const b=state.editing||{collectionDate:localDate(operationalNow()),bookingType:'Advance Large Order',pickStatus:'Waiting',paymentStatus:'Payment Required',accountStatus:'Released',priority:'Normal',version:0};$('modalTitle').textContent=id?`Edit ${b.orderNumber}`:'New Booking';const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','orderValueIncVAT','notes'];fields.forEach(k=>{const el=$(k),key=k==='bookingId'?'id':k;if(el)el.value=b[key]??''});['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>$(k).checked=!!b[k]);updateTimeOptions();$('collectionTime').value=b.collectionTime||'';$('deleteBookingBtn').classList.toggle('hidden',!id||!state.user||state.user.role!=='Manager');$('bookingModal').classList.remove('hidden');resetBookingModalScroll();calcVat()}
async function saveBooking(e){e.preventDefault();if(!validWeekday($('collectionDate').value)){showToast('Collection dates must be Monday to Friday.','error');return}if($('collectionStatus').value==='Collected'&&$('pickStatus').value!=='Ready'){showToast('An order can only be marked Collected after it is Ready.','error');return}const fields=['bookingId','orderNumber','customer','bookingType','itemCount','collectionDate','collectionTime','assignedPicker','priority','paymentType','paymentStatus','accountStatus','pickStatus','collectionStatus','bookedBy','orderValueExVAT','notes'],b={};fields.forEach(k=>b[k==='bookingId'?'id':k]=$(k).value);['drillingRequired','parkwayItems','airPicks','osItems','paintedOrder','madeToMeasure'].forEach(k=>b[k]=$(k).checked);const oldIndex=state.bookings.findIndex(x=>x.id===b.id),old=oldIndex>=0?{...state.bookings[oldIndex]}:null;b.version=Number(old?.version||0);const temp={...(old||{}),...b,id:b.id||`temp-${Date.now()}`,orderValueIncVAT:Number(b.orderValueExVAT||0)*(1+Number(state.config.VAT_PERCENT||20)/100)};if(oldIndex>=0)state.bookings[oldIndex]=temp;else state.bookings.push(temp);if(state.selected&&state.selected.id===temp.id)state.selected=temp;$('bookingModal').classList.add('hidden');resetBookingModalScroll();renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');showToast('Saving booking…');try{const r=await api('save',{payload:JSON.stringify(b)});const idx=state.bookings.findIndex(x=>x.id===temp.id);if(idx>=0)state.bookings[idx]=r.booking;if(state.selected&&(state.selected.id===temp.id||state.selected.id===r.booking.id))state.selected=r.booking;state.dataRevision=r.revision??state.dataRevision;showToast('Booking saved successfully');renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');loadData({silent:true})}catch(err){if(oldIndex>=0)state.bookings[oldIndex]=old;else state.bookings=state.bookings.filter(x=>x.id!==temp.id);state.selected=old||state.selected;renderAll();showToast(`Booking was not saved: ${err.message}`,'error')}}
async function quickUpdate(id,changes){const idx=state.bookings.findIndex(b=>b.id===id);if(idx<0)return;const before={...state.bookings[idx]},proposed={...before,...changes};if(proposed.collectionStatus==='Collected'&&proposed.pickStatus!=='Ready'){showToast('Mark the order Ready before marking it Collected.','error');return}state.bookings[idx]=proposed;if(state.selected&&state.selected.id===id)state.selected=proposed;renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');try{const r=await api('quick',{id,changes:JSON.stringify({...changes,version:Number(before.version||0)})});state.bookings[idx]=r.booking;if(state.selected&&state.selected.id===id)state.selected=r.booking;state.dataRevision=r.revision??state.dataRevision;showToast('Order updated');renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details')}catch(e){state.bookings[idx]=before;if(state.selected&&state.selected.id===id)state.selected=before;renderAll();if(state.selected&&!$('orderPanel').classList.contains('hidden'))renderOrderTab('details');showToast(`Update failed: ${e.message}`,'error')}}
async function deleteBooking(){if(!state.editing||!state.user||state.user.role!=='Manager')return;const reason=prompt(`Enter the reason for permanently deleting ${state.editing.orderNumber}:`);if(reason===null)return;if(reason.trim().length<3){showToast('A deletion reason is required.','error');return}if(!confirm('Permanently delete this booking? This cannot be undone.'))return;try{await api('delete',{id:state.editing.id,reason:reason.trim()});$('bookingModal').classList.add('hidden');showToast('Booking permanently deleted');loadData({silent:true})}catch(e){showToast(e.message,'error')}}
$('deleteBookingBtn').onclick=deleteBooking;
const oldRenderReports=renderReports;
function renderReports(){oldRenderReports();const area=$('reportResults');if(!area||!state.reportData)return;const s=state.reportData.summary||{};const cards=area.querySelector('.report-cards');if(cards)cards.innerHTML=`<div><span>Bookings</span><strong>${Number(s.bookings||0)}</strong></div><div><span>Collected value</span><strong>${money(s.collectedValueIncVAT||0)}</strong></div><div><span>Expected value</span><strong>${money(s.outstandingValueIncVAT||0)}</strong></div><div><span>Cancelled value</span><strong>${money(s.cancelledValueIncVAT||0)}</strong></div><div><span>Average wait</span><strong>${Number(s.averageWaitMinutes||0)} min</strong></div><div><span>Average pick</span><strong>${Number(s.averagePickMinutes||0)} min</strong></div>`}
}

/* ===== v1.3.5 session, search and operational UX refinements ===== */
state.issuedAt=Number(state.issuedAt||0);state.expiresAt=Number(state.expiresAt||0);state.searchResults=[];state.searchQuery='';state.activeOrderTab=state.activeOrderTab||'details';
function session(){try{return JSON.parse(sessionStorage.getItem('apm_session')||'null')}catch(_){return null}}
function saveSession(){sessionStorage.setItem('apm_session',JSON.stringify({user:state.user,token:state.token,issuedAt:state.issuedAt,expiresAt:state.expiresAt}))}
function clearSession(){sessionStorage.removeItem('apm_session');state.user=null;state.token='';state.issuedAt=0;state.expiresAt=0}
function sessionExpired(){return !state.expiresAt||Date.now()>=Number(state.expiresAt)}
async function forceLogout(message='Your session has ended. Please sign in again.'){
  stopLiveSync();clearSession();$('app').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('loginError').textContent=message;$('loginKey').value='';setLoading(false);
}
function api(action,params={}){const url=CFG.API_URL;if(!url||url.includes('PASTE_YOUR'))return Promise.reject(new Error('The Apps Script URL has not been added to config.js.'));if(state.user&&action!=='login'&&sessionExpired()){forceLogout('Your 12-hour session has expired. Please sign in again.');return Promise.reject(new Error('Session expired.'))}return new Promise((resolve,reject)=>{const cb=`apm_${Date.now()}_${Math.random().toString(36).slice(2)}`,script=document.createElement('script');let done=false;const timeout=setTimeout(()=>finish(new Error('Request timed out.')),20000);function finish(err,data){if(done)return;done=true;clearTimeout(timeout);delete window[cb];script.remove();if(err&&/session|inactive|revoked|access/i.test(err.message||''))forceLogout(err.message);err?reject(err):resolve(data)}window[cb]=data=>data&&data.ok===false?finish(new Error(data.error||'Request failed')):finish(null,data);const q=new URLSearchParams({action,callback:cb,...params});if(state.user){q.set('user',state.user.name);q.set('token',state.token);q.set('issuedAt',String(state.issuedAt||0));q.set('sessionId',getSessionId());q.set('device',getDeviceLabel())}script.src=`${url}?${q}`;script.onerror=()=>finish(new Error('Could not contact Google Apps Script.'));document.body.appendChild(script)})}
async function login(e){e.preventDefault();$('loginError').textContent='';setLoading(true,'Signing you in…');try{const r=await api('login',{name:$('loginName').value.trim(),accessKey:$('loginKey').value});state.user=r.user;state.token=r.sessionToken;state.issuedAt=Number(r.issuedAt||Date.now());state.expiresAt=Number(r.expiresAt||state.issuedAt+12*60*60*1000);saveSession();await enterApp()}catch(err){$('loginError').textContent=err.message}finally{setLoading(false)}}
function restoreSession(){const s=session();if(!s||!s.user||!s.token||!s.issuedAt||!s.expiresAt||Date.now()>=Number(s.expiresAt)){clearSession();$('loginScreen').classList.remove('hidden');return false}state.user=s.user;state.token=s.token;state.issuedAt=Number(s.issuedAt);state.expiresAt=Number(s.expiresAt);enterApp();return true}
function closeTransientPanels(){state.selected=null;$('orderPanel').classList.add('hidden');$('notificationPanel').classList.add('hidden');$('filterPanel').classList.add('hidden')}
function showEmpty(message,detail=''){return `<div class="empty-state"><strong>${safe(message)}</strong>${detail?`<p>${safe(detail)}</p>`:''}</div>`}
function filtered(){const sf=$('statusFilter').value,pf=$('pickerFilter').value,pr=$('priorityFilter').value;return state.bookings.filter(b=>(!sf||displayStatus(b)===sf)&&(!pf||b.assignedPicker===pf)&&(!pr||b.priority===pr))}
async function runGlobalSearch(){const q=$('searchInput').value.trim();if(q.length<2){showToast('Enter at least 2 characters to search.','error');return}closeTransientPanels();setLoading(true,'Searching all live and archived bookings…');try{const r=await api('search',{q});state.searchResults=r.results||[];state.searchQuery=q;state.page='search';document.querySelectorAll('.sidebar [data-page]').forEach(b=>b.classList.remove('active'));$('pageTitle').textContent='Search Results';$('pageSubtitle').textContent=`All live and archived bookings matching “${q}”`;$('plannerControls').classList.add('hidden');$('stats').classList.add('hidden');renderSearchResults()}catch(e){showToast(e.message,'error')}finally{setLoading(false)}}
function renderSearchResults(){const rows=state.searchResults||[];$('pageBody').innerHTML=`<div class="search-results"><div class="search-results-head"><strong>${rows.length} result${rows.length===1?'':'s'}</strong><span>Search covers Bookings and Bookings Archive</span></div>${rows.length?rows.map(b=>`<button class="search-result" data-search-id="${safe(b.id)}"><div><strong>${safe(b.orderNumber)}</strong><span>${safe(b.customer)}</span></div><div><span>${safe(b.collectionDate)}${b.collectionTime?' · '+safe(b.collectionTime):''}</span><small>${safe(b.bookingType||'')} · ${safe(displayStatus(b))}</small></div></button>`).join(''):showEmpty('No matching bookings','Try a different order number, customer name, picker or sales team member.')}</div>`;document.querySelectorAll('[data-search-id]').forEach(x=>x.onclick=()=>openSearchResult(x.dataset.searchId))}
function openSearchResult(id){const b=(state.searchResults||[]).find(x=>x.id===id);if(!b)return;state.selected=b;$('orderPanelTitle').textContent=b.orderNumber||'Order';$('orderPanel').classList.remove('hidden');$('orderPanel').scrollTop=0;renderOrderTab('details')}
function setPage(p){closeTransientPanels();state.page=p;document.querySelectorAll('.sidebar [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));const titles={dashboard:['Dashboard','Today’s operational overview and team workload'],advance:['Advance Picks','View and manage timed large-order collections'],small:['Small Orders','Manage small orders and walk-in collections'],board:['Picking Board','Prioritise and progress all picking work'],reports:['Reports','Customer service, picking and sales performance'],settings:['Settings','Manage your profile and application settings']};$('pageTitle').textContent=titles[p][0];$('pageSubtitle').textContent=titles[p][1];$('plannerControls').classList.toggle('hidden',['dashboard','reports','settings'].includes(p));$('stats').classList.toggle('hidden',['settings','reports'].includes(p));if(p==='dashboard'||p==='board'){state.day=operationalNow();state.viewMode='day'}else if(p==='advance'||p==='small'){state.weekStart=startOfWeek(operationalNow());state.viewMode='week';resetPlannerFilters()}if(p==='settings'){openSettings();return}setLoading(true,'Opening '+titles[p][0]+'…');requestAnimationFrame(()=>{renderAll();setTimeout(()=>setLoading(false),80)});if(['dashboard','advance','small','board'].includes(p))loadData({silent:true})}
function sortAdvanceBoard(a,b){return String(a.collectionTime||'99:99').localeCompare(String(b.collectionTime||'99:99'))||String(a.orderNumber).localeCompare(String(b.orderNumber))}
function sortSmallBoard(a,b){const rank=x=>x.bookingType==='Walk in'?0:(x.collectionTime?1:2);return rank(a)-rank(b)||String(a.collectionTime||'99:99').localeCompare(String(b.collectionTime||'99:99'))||String(a.orderNumber).localeCompare(String(b.orderNumber))}
function renderBoard(){const all=filtered().filter(b=>state.viewMode==='week'||b.collectionDate===localDate(state.day));const renderSection=(title,items,sorter)=>`<div class="board-section"><h2>${title}</h2><div class="board">${PICK_STATUSES.map(s=>{const col=items.filter(b=>b.pickStatus===s).sort(sorter);return `<section class="board-col"><div class="board-head"><span>${s}</span><span>${col.length}</span></div><div class="board-list" data-status="${s}">${col.length?col.map(b=>card(b,{showTime:true})).join(''):showEmpty('No orders in this stage')}</div></section>`}).join('')}</div></div>`;$('pageBody').innerHTML=renderSection('Advance Picks',all.filter(b=>b.bookingType==='Advance Large Order'),sortAdvanceBoard)+renderSection('Small Orders / Walk ins',all.filter(b=>b.bookingType!=='Advance Large Order'),sortSmallBoard);wireCards()}
function renderSmallCalendar(){const days=visibleDays(),orders=filtered().filter(x=>['Small Order','Walk in'].includes(x.bookingType));$('pageBody').innerHTML=`<div class="small-calendar">${days.map(d=>{const date=localDate(d),col=orders.filter(x=>x.collectionDate===date).sort(sortSmallBoard);return `<section class="day-column" data-date="${date}"><h3>${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</h3>${col.length?col.map(x=>card(x,{showTime:true})).join(''):showEmpty('No small orders','Drag a booking here or add a new booking.')}</section>`}).join('')}</div>`;wireCards()}
function refreshConnectionLabel(){if(!state.user)return;const age=Date.now()-Number(state.lastSuccessfulSync||0),rounded=Math.max(0,Math.floor(age/5000)*5);if(!state.lastSuccessfulSync)updateConnectionState('connecting','Connecting…');else if(age>90000)updateConnectionState('offline',`Offline · last connected ${new Date(state.lastSuccessfulSync).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`);else if(state.syncInFlight)updateConnectionState('connecting','Updating…');else updateConnectionState('live',`Live · updated ${rounded}s ago`)}
function showToast(msg,type='success'){const t=$('toast');t.textContent=String(msg||'');t.classList.toggle('error',type==='error');t.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.add('hidden'),type==='error'?5000:3000)}
function renderTimedCalendar(){const days=visibleDays(),bookings=filtered().filter(b=>b.bookingType==='Advance Large Order'),current=currentTimeRowInfo(),todayVisible=days.some(d=>localDate(d)===current?.today);let html=`<div class="calendar-wrap ${state.viewMode==='day'?'day-view':''}"><div class="calendar-grid"><div class="cal-cell cal-head"></div>${days.map(d=>`<div class="cal-cell cal-head">${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>`).join('')}`;for(const time of timeSlots()){const currentRow=todayVisible&&current&&current.time===time,style=currentRow?` style="--current-offset:${current.offset}%"`:'';html+=`<div class="cal-cell time-cell ${currentRow?'current-time-cell':''}"${style}>${time}</div>`;for(const d of days){const date=localDate(d),block=isBlocked(date,time),slot=bookings.filter(b=>b.collectionDate===date&&normaliseTime(b.collectionTime)===time).sort(sortAdvanceBoard);html+=`<div class="cal-cell slot ${block?'blocked':''} ${currentRow?'current-time-cell':''}"${style} data-date="${date}" data-time="${time}">${block?safe(block.label||'Blocked'):(slot.length?slot.map(b=>card(b)).join(''):'')}</div>`}}html+='</div></div>';$('pageBody').innerHTML=html;wireCards()}
// Rebind controls to the v1.3.5 behaviours.
$('loginForm').onsubmit=login;$('logoutBtn').onclick=()=>forceLogout('You have signed out.');document.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>setPage(x.dataset.page));$('searchBtn').onclick=runGlobalSearch;$('searchInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();runGlobalSearch()}};$('searchInput').oninput=null;$('viewMode').onchange=()=>{closeTransientPanels();state.viewMode=$('viewMode').value;loadData()};$('prevBtn').onclick=()=>{closeTransientPanels();if(state.viewMode==='day')state.day=addDays(state.day,-1);else state.weekStart=addDays(state.weekStart,-7);loadData()};$('nextBtn').onclick=()=>{closeTransientPanels();if(state.viewMode==='day')state.day=addDays(state.day,1);else state.weekStart=addDays(state.weekStart,7);loadData()};$('todayBtn').onclick=()=>{closeTransientPanels();state.day=operationalNow();state.weekStart=startOfWeek(operationalNow());loadData()};$('refreshBtn').onclick=()=>{closeTransientPanels();loadData()};document.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>{const el=$(x.dataset.close);if(el)el.classList.add('hidden');if(x.dataset.close==='orderPanel')state.selected=null});
// Replace the earlier startup result with the expiry-aware session restore.
const restored=session();if(restored&&restored.user&&restored.token){state.user=restored.user;state.token=restored.token;state.issuedAt=Number(restored.issuedAt||0);state.expiresAt=Number(restored.expiresAt||0);if(sessionExpired())forceLogout('Your previous session has expired. Please sign in for today’s shift.')}
