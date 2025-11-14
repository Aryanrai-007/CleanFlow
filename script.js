
const sections = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('.nav-btn');
const toastWrap = document.getElementById('toastWrap');

const STORAGE_KEY = 'cleanflow_v1_state';
const defaultState = {
  truck: { pct: 5, lat: 28.7041, lng: 77.1025, moving: false },
  collected: [], 
  subscribers: {} 
};

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState)); return structuredClone(defaultState); }
  try { return JSON.parse(raw); } catch(e){ localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState)); return structuredClone(defaultState); }
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }


let state = loadState();


navBtns.forEach(b=>{
  b.addEventListener('click',()=> {
    const tgt = b.dataset.target;
    showSection(tgt);
  });
});

function showSection(id){
  sections.forEach(s=>s.style.display = s.id === id ? '' : 'none');
}
showSection('citizen'); 


function toast(msg, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  toastWrap.appendChild(el);
  setTimeout(()=> el.style.opacity = '0.9', 10);
  setTimeout(()=> {
    el.style.opacity = '0';
    setTimeout(()=> el.remove(), 400);
  }, opts.time || 3000);
}


const truckMarker = document.getElementById('truckMarker');
const citizenArea = document.getElementById('citizen-area');
const subscribeBtn = document.getElementById('subscribeBtn');
const simulateApproachBtn = document.getElementById('simulateApproachBtn');
const citizenNotifications = document.getElementById('citizenNotifications');

function renderTruckPosition(){
  const pct = state.truck.pct;
  truckMarker.style.left = pct + '%';
}
renderTruckPosition();

subscribeBtn.addEventListener('click', ()=>{
  const a = citizenArea.value;
  state.subscribers[a] = true;
  saveState(state);
  toast(`Subscribed to ${a}`);
});

simulateApproachBtn.addEventListener('click', ()=>{

  const area = citizenArea.value;
  
  const map = { 'Sector A':20, 'Sector B':45, 'Sector C':70 };
  state.truck.pct = map[area] || 50;
  saveState(state);
  renderTruckPosition();
  
  const note = document.createElement('div');
  note.className = 'toast';
  note.textContent = `Truck is approaching ${area}`;
  citizenNotifications.prepend(note);
  setTimeout(()=> note.remove(), 4000);


  if(state.subscribers[area]) toast(`Alert: Truck near ${area}`);
});


const driverLat = document.getElementById('driver-lat');
const driverLng = document.getElementById('driver-lng');
const driverArea = document.getElementById('driver-area');
const markAreaBtn = document.getElementById('markAreaBtn');
const driverLog = document.getElementById('driverLog');
const startAutoBtn = document.getElementById('startAutoBtn');
const stopAutoBtn = document.getElementById('stopAutoBtn');
let autoInterval = null;

function addDriverLog(text){ const li = document.createElement('li'); li.textContent = `${new Date().toLocaleTimeString()} — ${text}`; driverLog.prepend(li); }

markAreaBtn.addEventListener('click', ()=>{
  const area = driverArea.value;
  const lat = Number(driverLat.value) || state.truck.lat;
  const lng = Number(driverLng.value) || state.truck.lng;
  const item = { id: Date.now().toString(), area, lat, lng, ts: Date.now(), by: 'Driver-1' };
  state.collected.push(item);
  saveState(state);
  addDriverLog(`Marked ${area} collected`);
  toast(`Marked ${area}`);
  
  renderAdmin();
});

startAutoBtn.addEventListener('click', ()=>{
  if(autoInterval) return;
  startAutoBtn.disabled = true;
  stopAutoBtn.disabled = false;
  state.truck.moving = true;
  saveState(state);
  addDriverLog('Auto route started');
  autoInterval = setInterval(()=> {
    
    state.truck.pct += 2.5;
    if(state.truck.pct > 95) state.truck.pct = 5;
    
    state.truck.lat += 0.0002;
    state.truck.lng += 0.0003;
    saveState(state);
    renderTruckPosition();
    
    if([18,20,43,45,68,70].some(v => Math.abs(state.truck.pct - v) < 1.2)){
      
      const nearest = state.truck.pct < 35 ? 'Sector A' : (state.truck.pct < 60 ? 'Sector B' : 'Sector C');
      
      const last = state.collected.length ? state.collected[state.collected.length-1] : null;
      if(!last || last.area !== nearest){
        const item = { id: Date.now().toString(), area: nearest, lat: state.truck.lat, lng: state.truck.lng, ts: Date.now(), by: 'Driver-1' };
        state.collected.push(item);
        saveState(state);
        addDriverLog(`Auto-marked ${nearest}`);
        toast(`Auto: ${nearest} collected`);
        renderAdmin();
      }
    }
  }, 1500);
});

stopAutoBtn.addEventListener('click', ()=>{
  if(!autoInterval) return;
  clearInterval(autoInterval);
  autoInterval = null;
  startAutoBtn.disabled = false;
  stopAutoBtn.disabled = true;
  state.truck.moving = false;
  saveState(state);
  addDriverLog('Auto route stopped');
});


const refreshAdmin = document.getElementById('refreshAdmin');
const exported = document.getElementById('exportJson');
const clearData = document.getElementById('clearData');
const adminTruckPos = document.getElementById('adminTruckPos');
const collectedTableBody = document.querySelector('#collectedTable tbody');
const analyticsDiv = document.getElementById('analytics');

function renderAdmin(){
  
  adminTruckPos.textContent = `Pct:${state.truck.pct.toFixed(1)}% | Lat:${state.truck.lat.toFixed(5)} | Lng:${state.truck.lng.toFixed(5)}`;
  
  collectedTableBody.innerHTML = '';
  const rows = [...state.collected].sort((a,b)=>b.ts-a.ts);
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.area}</td><td>${r.lat.toFixed(5)}</td><td>${r.lng.toFixed(5)}</td><td>${new Date(r.ts).toLocaleString()}</td><td>${r.by}</td>`;
    collectedTableBody.appendChild(tr);
  });
  
  const counts = rows.reduce((acc,cur)=>{
    acc[cur.area] = (acc[cur.area]||0)+1; return acc;
  }, {});
  analyticsDiv.innerHTML = Object.keys(counts).length ? Object.entries(counts).map(([a,c])=>`${a}: ${c}`).join(' • ') : 'No collections yet';
}

refreshAdmin.addEventListener('click', renderAdmin);

document.getElementById('exportJson').addEventListener('click', ()=>{
  const data = JSON.stringify(state.collected, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cleanflow_collected.json'; a.click();
  URL.revokeObjectURL(url);
});

clearData.addEventListener('click', ()=>{
  if(!confirm('Clear all collected records and subscribers?')) return;
  state.collected = []; state.subscribers = {};
  saveState(state);
  renderAdmin();
  toast('Data cleared');
});


renderAdmin();
renderTruckPosition();


window.addEventListener('storage', (e)=>{
  if(e.key === STORAGE_KEY){
    state = loadState();
    renderAdmin();
    renderTruckPosition();
  }
});

