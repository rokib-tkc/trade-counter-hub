const CONFIG = window.APP_CONFIG || {};
const STATUSES = ["Waiting","Picking","Ready","Customer Waiting","Collected","Problem","Late","Cancelled"];
const PAYMENT_TYPES = ["Account","Paid","Card on Collection","Cash on Collection","Proforma","Other"];
let state = {bookings:[], team:[], weekStart:startOfWeek(new Date()), activeView:"calendar", editing:null};

const $ = id => document.getElementById(id);
function startOfWeek(date){const d=new Date(date);const day=d.getDay()||7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day+1);return d}
function isoDate(d){return new Date(d).toISOString().slice(0,10)}
function localISODate(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function safe(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function slug(v){return String(v).replace(/\s+/g,"-")}
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),2600)}
function getConnection(){return {url:localStorage.getItem("ap_api_url")||CONFIG.API_URL||"",key:localStorage.getItem("ap_api_key")||CONFIG.API_KEY||""}}

// JSONP is used because it works reliably between a static GitHub Pages site and Apps Script.
function api(action, params={}){
  const {url,key}=getConnection();
  if(!url) return Promise.reject(new Error("Add the Apps Script URL in Settings first."));
  return new Promise((resolve,reject)=>{
    const callback=`ap_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script=document.createElement("script");
    const timeout=setTimeout(()=>cleanup(new Error("The request timed out.")),15000);
    function cleanup(err,data){clearTimeout(timeout);delete window[callback];script.remove();err?reject(err):resolve(data)}
    window[callback]=data=>data && data.ok===false?cleanup(new Error(data.error||"Request failed")):cleanup(null,data);
    const query=new URLSearchParams({action,key,callback,...params});
    script.src=`${url}?${query}`;script.onerror=()=>cleanup(new Error("Could not contact the Apps Script web app."));document.body.appendChild(script);
  });
}

async function loadData(){
  try{const from=localISODate(state.weekStart),to=localISODate(addDays(state.weekStart,6));const res=await api("list",{from,to});state.bookings=res.bookings||[];state.team=res.team||[];renderAll()}
  catch(e){showToast(e.message);renderAll()}
}
function renderAll(){renderWeekLabel();renderFilters();renderStats();renderCalendar();renderBoard();renderWorkload()}
function renderWeekLabel(){const end=addDays(state.weekStart,6);$("weekLabel").textContent=`${state.weekStart.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – ${end.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}`}
function filtered(){const q=$("searchInput").value.toLowerCase();const sf=$("statusFilter").value,pf=$("pickerFilter").value;return state.bookings.filter(b=>(!q||`${b.orderNumber} ${b.customer}`.toLowerCase().includes(q))&&(!sf||b.status===sf)&&(!pf||b.assignedPicker===pf))}
function renderFilters(){if($("statusFilter").options.length===1) STATUSES.forEach(x=>$("statusFilter").add(new Option(x,x)));const current=$("pickerFilter").value;$("pickerFilter").innerHTML='<option value="">All pickers</option>';state.team.filter(x=>x.active!==false).forEach(x=>$("pickerFilter").add(new Option(x.name,x.name)));$("pickerFilter").value=current}
function renderStats(){const b=filtered();const items=[["Collections this week",b.length],["Waiting to pick",b.filter(x=>x.status==="Waiting").length],["Being picked",b.filter(x=>x.status==="Picking").length],["Ready",b.filter(x=>x.status==="Ready").length],["Problems / late",b.filter(x=>["Problem","Late"].includes(x.status)).length]];$("stats").innerHTML=items.map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("")}
function timeSlots(){const out=[];for(let h=CONFIG.OPEN_HOUR||8;h<(CONFIG.CLOSE_HOUR||17);h++)for(let m=0;m<60;m+=(CONFIG.SLOT_MINUTES||30))out.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);return out}
function card(b){return `<article class="booking-card status-${slug(b.status)}" draggable="true" data-id="${safe(b.id)}"><strong>${safe(b.orderNumber)}</strong><span class="customer">${safe(b.customer)}</span><div class="meta"><span>${safe(b.orderSize||0)} items</span><span>${safe(b.status)}</span></div></article>`}
function renderCalendar(){const days=[0,1,2,3,4].map(i=>addDays(state.weekStart,i));let html='<div class="calendar"><div class="calendar-grid"><div class="cal-cell cal-head"></div>'+days.map(d=>`<div class="cal-cell cal-head">${d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</div>`).join("");for(const time of timeSlots()){html+=`<div class="cal-cell time-cell">${time}</div>`;for(const d of days){const date=localISODate(d);const cards=filtered().filter(b=>b.collectionDate===date&&b.collectionTime.slice(0,5)===time).map(card).join("");html+=`<div class="cal-cell slot" data-date="${date}" data-time="${time}">${cards}</div>`}}html+='</div></div>';$("calendarView").innerHTML=html;wireCards()}
function renderBoard(){const cols=["Waiting","Picking","Ready","Customer Waiting","Problem","Collected"];$("boardView").innerHTML=`<div class="board">${cols.map(s=>`<section class="board-col"><div class="board-head"><span>${s}</span><span>${filtered().filter(b=>b.status===s).length}</span></div><div class="board-list" data-status="${s}">${filtered().filter(b=>b.status===s).sort((a,b)=>`${a.collectionDate}${a.collectionTime}`.localeCompare(`${b.collectionDate}${b.collectionTime}`)).map(card).join("")}</div></section>`).join("")}</div>`;wireCards()}
function renderWorkload(){const active=state.team.filter(x=>x.active!==false);$("workloadView").innerHTML=`<div class="workload">${active.map(p=>{const jobs=filtered().filter(b=>b.assignedPicker===p.name&&!['Collected','Cancelled'].includes(b.status));const mins=jobs.reduce((a,b)=>a+Number(b.estimatedMinutes||0),0),pct=Math.min(100,Math.round(mins/480*100));return `<div class="person-card"><h3>${safe(p.name)}</h3><span>${jobs.length} active bookings · ${mins} estimated minutes</span><div class="progress"><div style="width:${pct}%"></div></div><small>${pct}% of an 8-hour day</small></div>`}).join("")}</div>`}
function wireCards(){document.querySelectorAll('.booking-card').forEach(el=>{el.onclick=()=>openBooking(el.dataset.id);el.ondragstart=e=>e.dataTransfer.setData('text/plain',el.dataset.id)});document.querySelectorAll('.slot').forEach(el=>{el.ondragover=e=>{e.preventDefault();el.classList.add('drag-over')};el.ondragleave=()=>el.classList.remove('drag-over');el.ondrop=async e=>{e.preventDefault();el.classList.remove('drag-over');await quickUpdate(e.dataTransfer.getData('text/plain'),{collectionDate:el.dataset.date,collectionTime:el.dataset.time})}});document.querySelectorAll('.board-list').forEach(el=>{el.ondragover=e=>e.preventDefault();el.ondrop=async e=>{e.preventDefault();await quickUpdate(e.dataTransfer.getData('text/plain'),{status:el.dataset.status})}})}
async function quickUpdate(id,changes){const b=state.bookings.find(x=>x.id===id);if(!b)return;Object.assign(b,changes);renderAll();try{await api("save",{payload:JSON.stringify(b)});showToast("Booking updated")}catch(e){showToast(e.message);loadData()}}
function openBooking(id){state.editing=id?state.bookings.find(x=>x.id===id):null;const b=state.editing||{collectionDate:localISODate(new Date()),collectionTime:"09:00",status:"Waiting",priority:"Normal",estimatedMinutes:30};$("modalTitle").textContent=id?`Edit ${b.orderNumber}`:"New booking";for(const key of ["bookingId","orderNumber","customer","collectionDate","collectionTime","orderSize","estimatedMinutes","paymentType","assignedPicker","status","priority","vehicleType","bookedBy","notes"])$(key).value=b[key==="bookingId"?"id":key]??"";$("deleteBtn").classList.toggle("hidden",!id);$("modal").classList.remove("hidden")}
function closeBooking(){$("modal").classList.add("hidden")}
async function saveForm(e){e.preventDefault();const fields=["bookingId","orderNumber","customer","collectionDate","collectionTime","orderSize","estimatedMinutes","paymentType","assignedPicker","status","priority","vehicleType","bookedBy","notes"];const b={};fields.forEach(k=>b[k==="bookingId"?"id":k]=$(k).value);try{await api("save",{payload:JSON.stringify(b)});closeBooking();showToast("Booking saved");loadData()}catch(err){showToast(err.message)}}
async function deleteBooking(){if(!state.editing||!confirm(`Delete ${state.editing.orderNumber}?`))return;try{await api("delete",{id:state.editing.id});closeBooking();showToast("Booking deleted");loadData()}catch(e){showToast(e.message)}}
function switchView(v){state.activeView=v;document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));$(`${v}View`).classList.remove('hidden');document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$("pageTitle").textContent=v==='calendar'?'Advance Pick Calendar':v==='board'?'Picking Board':'Team Workload'}
function initSelects(){PAYMENT_TYPES.forEach(x=>$("paymentType").add(new Option(x,x)));STATUSES.forEach(x=>$("status").add(new Option(x,x)))}
function refreshPickerSelect(){const val=$("assignedPicker").value;$("assignedPicker").innerHTML='<option value="">Unassigned</option>';state.team.filter(x=>x.active!==false).forEach(x=>$("assignedPicker").add(new Option(x.name,x.name)));$("assignedPicker").value=val}

initSelects();
$("newBookingBtn").onclick=()=>{refreshPickerSelect();openBooking()};$("closeModal").onclick=$("cancelBtn").onclick=closeBooking;$("bookingForm").onsubmit=saveForm;$("deleteBtn").onclick=deleteBooking;
$("prevWeekBtn").onclick=()=>{state.weekStart=addDays(state.weekStart,-7);loadData()};$("nextWeekBtn").onclick=()=>{state.weekStart=addDays(state.weekStart,7);loadData()};$("todayBtn").onclick=()=>{state.weekStart=startOfWeek(new Date());loadData()};$("refreshBtn").onclick=loadData;
[$("searchInput"),$("statusFilter"),$("pickerFilter")].forEach(x=>x.addEventListener(x.tagName==='INPUT'?'input':'change',renderAll));document.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>switchView(x.dataset.view));
$("openSettings").onclick=()=>{const c=getConnection();$("apiUrl").value=c.url;$("apiKey").value=c.key;$("settingsModal").classList.remove("hidden")};$("closeSettings").onclick=()=>$("settingsModal").classList.add("hidden");$("saveSettings").onclick=async()=>{localStorage.setItem("ap_api_url",$("apiUrl").value.trim());localStorage.setItem("ap_api_key",$("apiKey").value.trim());$("settingsModal").classList.add("hidden");await loadData()};
loadData().then(refreshPickerSelect);
