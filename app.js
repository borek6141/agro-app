
/* app.js — główna logika aplikacji (Agro-App PRO) */
let crops = [];
const cropListEl = () => document.getElementById('cropList');
const mainEl = () => document.getElementById('main');
const favsEl = () => document.getElementById('favs');

document.getElementById('today').innerText = new Date().toLocaleDateString('pl-PL');

/* PWA: beforeinstallprompt */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

/* Service Worker registration */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered', reg);
      document.getElementById('swStatus').innerText = ' (SW: zarejestrowany)';
    }).catch(err => {
      console.warn('SW error', err);
      document.getElementById('swStatus').innerText = ' (SW: błąd)';
    });
  });
}

/* Load data */
async function loadData(){
  try{
    const resp = await fetch('data/uprawy.json');
    if(!resp.ok) throw new Error('Nie można pobrać danych');
    const data = await resp.json();
    crops = data.crops || [];
  } catch(err){
    console.warn('Fallback:', err);
    crops = [{
      id:'pszenica',
      title:'Pszenica ozima',
      notes:'pH 6.0–7.2. Normy N: 140–200 kg/ha.',
      requirements:['Gleby I–IIIa','pH 6.0–7.2'],
      cultivation:['Orka lub uprawa uproszczona','Siew: wrzesień–październik'],
      fertilization: {N:'140-200',P:'60-90',K:'80-120'},
      protection: {weeds:'Herbicydy', diseases:'Septorioza', pests:'Mszyce'},
      schedule: {autumn:['Siew','Zaprawa'], spring:['N nawożenie','T1 fungicyd'], summer:['Zbiór']}
    }];
  }
  renderSidebar();
  const firstId = crops[0] && crops[0].id;
  if(firstId) openCrop(firstId);
}
loadData();

function renderSidebar(){
  const el = cropListEl();
  el.innerHTML = '';
  crops.forEach(c=>{
    const d = document.createElement('div');
    d.className = 'crop-item';
    d.innerHTML = `<strong>${c.title}</strong><div style="color:var(--muted);font-size:13px">${c.notes||''}</div>`;
    d.onclick = () => openCrop(c.id);
    el.appendChild(d);
  });
  renderFavs();
}

function renderFavs(){
  const favs = JSON.parse(localStorage.getItem('agro.favs')||'[]');
  const el = favsEl();
  el.innerHTML = '';
  if(!favs.length){ el.innerHTML = '<div style="color:var(--muted)">Brak ulubionych</div>'; return; }
  favs.forEach(id=>{
    const c = crops.find(x=>x.id===id);
    if(!c) return;
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.style.margin='4px';
    btn.textContent = c.title;
    btn.onclick = () => openCrop(c.id);
    el.appendChild(btn);
  });
}

function openCrop(id){
  const c = crops.find(x=>x.id===id);
  if(!c){ mainEl().innerHTML = '<div class="card"><em>Wybierz uprawę.</em></div>'; return; }
  const main = mainEl();
  main.innerHTML = '';
  const header = document.createElement('div'); header.className='card';
  header.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
    <div><h2>${c.title}</h2><div style="color:var(--muted)">${c.notes||''}</div></div>
    <div><button class="btn" onclick="toggleFav('${c.id}')">♥ Ulubione</button><br/><button class="btn small" style="margin-top:8px" onclick="openEditCrop('${c.id}')">Edytuj</button></div>
  </div>`;
  main.appendChild(header);

  const panels = [
    {title:'Wymagania glebowe i klimatyczne', content: arrToList(c.requirements)},
    {title:'Uprawa i technika', content: arrToList(c.cultivation)},
    {title:'Nawożenie (ogólne)', content: objToTable(c.fertilization)},
    {title:'Ochrona — chwasty / choroby / szkodniki', content: protectionToHtml(c.protection)},
    {title:'Harmonogram (miesiąc po miesiącu)', content: scheduleToTimeline(c.schedule)}
  ];
  panels.forEach(p=>{
    const acc = document.createElement('div'); acc.className='acc'; acc.textContent = p.title;
    const panel = document.createElement('div'); panel.className='panel'; panel.innerHTML = p.content;
    acc.onclick = ()=> panel.style.display = panel.style.display==='block' ? 'none' : 'block';
    main.appendChild(acc); main.appendChild(panel);
  });

  const tools = document.createElement('div'); tools.className='card';
  tools.innerHTML = `<h3>Narzędzia</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <label>Data siewu</label><input type="date" id="sowingDate"/>
        <label>Planowany plon (t/ha)</label><input type="number" id="targetYield" step="0.1" placeholder="np. 6.0"/>
        <div style="margin-top:8px"><button class="btn" onclick="genPlan('${c.id}')">Generuj plan nawożenia</button></div>
        <div id="planResult" style="margin-top:8px;color:var(--muted)"></div>
      </div>
      <div style="flex:1;min-width:220px">
        <label>Norma wysiewu</label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input id="mtz_local" type="number" placeholder="MTZ (g)"/>
          <input id="obs_local" type="number" placeholder="Obsada (szt/m²)"/>
          <input id="zd_local" type="number" placeholder="Zdolność (%)"/>
          <button class="btn" onclick="calcWysiewLocal()">Oblicz</button>
        </div>
        <div id="wynik_local" class="result"></div>
      </div>
    </div>`;
  main.appendChild(tools);

  const exportCard = document.createElement('div'); exportCard.className='card';
  exportCard.innerHTML = `<h4>Eksport / notatki</h4>
    <button class="btn" onclick="downloadCrop('${c.id}')">Pobierz JSON uprawy</button>
    <button class="btn" onclick="saveSnapshot('${c.id}')">Zapisz notatkę lokalnie</button>
    <div id="snapshotMsg" style="margin-top:8px;color:var(--muted)"></div>`;
  main.appendChild(exportCard);
}

/* helpers */
function arrToList(arr){ if(!arr) return '<em>Brak informacji</em>'; return '<ul>'+arr.map(i=>`<li>${i}</li>`).join('')+'</ul>' }
function objToTable(obj){ if(!obj) return '<em>Brak</em>'; let rows=''; for(const k in obj) rows+=`<tr><th style="width:35%">${k}</th><td>${obj[k]}</td></tr>`; return `<table>${rows}</table>` }
function protectionToHtml(p){ if(!p) return '<em>Brak</em>'; return `<strong>Chwasty:</strong> ${p.weeds||'-'}<br/><strong>Choroby:</strong> ${p.diseases||'-'}<br/><strong>Szkodniki:</strong> ${p.pests||'-'}` }

function scheduleToTimeline(s){
  const months=['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  let html='<div class="timeline">';
  for(let m=0;m<12;m++){
    let items=[];
    if(s.autumn && m>=8 && m<=10) items = items.concat(s.autumn);
    if(s.spring && m>=2 && m<=4) items = items.concat(s.spring);
    if(s.summer && m>=5 && m<=7) items = items.concat(s.summer);
    if(s.winter && (m>=11 || m<=1)) items = items.concat(s.winter);
    html += `<div class="tmonth"><h4>${months[m]}</h4>${items.map(i=>`<div class="titem">${i}</div>`).join('') || '<div style="color:var(--muted)">—</div>'}</div>`;
  }
  html += '</div>';
  return html;
}

/* Kalkulatory */
function calcWysiewLocal(){
  const mtz = Number(document.getElementById('mtz_local').value);
  const obs = Number(document.getElementById('obs_local').value);
  const zd = Number(document.getElementById('zd_local').value);
  if(!mtz || !obs || !zd){ document.getElementById('wynik_local').innerText = 'Wprowadź MTZ, obsadę i zdolność.'; return; }
  const wynik = (mtz * obs * 10) / (zd/100);
  document.getElementById('wynik_local').innerText = wynik.toFixed(1) + ' kg/ha';
}

function genPlan(cropId){
  const yieldTarget = Number(document.getElementById('targetYield').value) || 0;
  const sowDate = document.getElementById('sowingDate').value;
  const c = crops.find(x=>x.id===cropId);
  const out = document.getElementById('planResult');
  if(!c) return;
  let html='';
  if(!yieldTarget){
    html += '<div><strong>Rekomendacje ogólne:</strong></div>';
    html += objToTable(c.fertilization);
    html += '<div style="color:var(--muted);margin-top:6px">Podaj planowany plon (t/ha) aby policzyć dawki precyzyjnie.</div>';
  } else {
    const perT = {N:25,P:8,K:14};
    const N = perT.N * yieldTarget;
    const P = perT.P * yieldTarget;
    const K = perT.K * yieldTarget;
    html += `<div><strong>Plan nawożenia dla celu ${yieldTarget.toFixed(1)} t/ha</strong></div>`;
    html += `<table><tr><th>Składnik</th><th>Dawka (kg/ha)</th></tr>
      <tr><td>Azot (N)</td><td>${N.toFixed(0)}</td></tr>
      <tr><td>Fosfor (P₂O₅)</td><td>${P.toFixed(0)}</td></tr>
      <tr><td>Potas (K₂O)</td><td>${K.toFixed(0)}</td></tr>
      </table>`;
    html += `<div style="margin-top:8px;color:var(--muted)">Dawki azotu podziel na 2–3 aplikacje (przedsiewnie, krzewienie, strzelanie w źdźbło). Dostosuj do analizy gleby.</div>`;
  }
  if(sowDate) html += `<div style="margin-top:6px"><strong>Data siewu:</strong> ${new Date(sowDate).toLocaleDateString('pl-PL')}</div>`;
  out.innerHTML = html;
}

/* Import / Export JSON */
function exportJSON(){
  const data = {crops,meta:{exportedAt:(new Date()).toISOString()}};
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='agro-full-export.json'; a.click(); URL.revokeObjectURL(url);
}
function importJSON(){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange = e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev=>{
      try{
        const data = JSON.parse(ev.target.result);
        if(data.crops && Array.isArray(data.crops)){
          data.crops.forEach(c=>{
            if(crops.find(x=>x.id===c.id)) c.id = c.id + '_imp' + Math.floor(Math.random()*1000);
            crops.push(c);
          });
          renderSidebar();
          alert('Import zakończony.');
        } else alert('Nieprawidłowy format JSON.');
      } catch(err){ alert('Błąd odczytu: '+err.message) }
    };
    reader.readAsText(file);
  };
  inp.click();
}

/* Add / Edit crop */
function openAddCrop(){
  mainEl().innerHTML = `<div class="card"><h2>Dodaj uprawę</h2>
    <label>Nazwa</label><input id="new_title" placeholder="np. Gryka" />
    <label>Id (bez spacji)</label><input id="new_id" placeholder="np. gryka" />
    <label>Krótki opis</label><input id="new_notes" placeholder="np. wymagania" />
    <label>Wymagania (oddzielone średnikiem)</label><input id="new_req" placeholder="główne wymagania;..." />
    <label>Nawożenie (N:xx,P:yy,K:zz)</label><input id="new_fert" placeholder="N:120,P:60,K:80" />
    <div style="margin-top:10px"><button class="btn" onclick="addCrop()">Dodaj</button></div></div>`;
}
function addCrop(){
  const id = document.getElementById('new_id').value.trim();
  const title = document.getElementById('new_title').value.trim();
  if(!id || !title){ alert('Podaj id i nazwę'); return; }
  const notes = document.getElementById('new_notes').value.trim();
  const req = document.getElementById('new_req').value.split(';').map(s=>s.trim()).filter(Boolean);
  const fertRaw = document.getElementById('new_fert').value.trim();
  const fert = {};
  fertRaw.split(',').forEach(piece=>{
    const [k,v] = piece.split(':').map(s=>s && s.trim());
    if(k && v) fert[k]=v;
  });
  const newCrop = {id,title,notes,requirements:req,cultivation:[],fertilization:fert,protection:{},schedule:{}};
  crops.push(newCrop);
  renderSidebar();
  openCrop(id);
  alert('Dodano uprawę.');
}

function openEditCrop(id){
  const c = crops.find(x=>x.id===id); if(!c) return;
  mainEl().innerHTML = `<div class="card"><h2>Edytuj ${c.title}</h2>
    <label>Nazwa</label><input id="edit_title" value="${escapeHtml(c.title)}" />
    <label>Opis</label><input id="edit_notes" value="${escapeHtml(c.notes||'')}" />
    <label>Wymagania (średnik)</label><input id="edit_req" value="${(c.requirements||[]).join(';')}" />
    <label>Nawożenie (N:xx,P:yy,K:zz)</label><input id="edit_fert" value="${objToKv(c.fertilization)}" />
    <div style="margin-top:10px"><button class="btn" onclick="saveEdit('${c.id}')">Zapisz</button><button class="btn small" style="margin-left:8px" onclick="openCrop('${c.id}')">Anuluj</button></div></div>`;
}
function saveEdit(id){
  const c = crops.find(x=>x.id===id);
  if(!c) return;
  c.title = document.getElementById('edit_title').value.trim();
  c.notes = document.getElementById('edit_notes').value.trim();
  c.requirements = document.getElementById('edit_req').value.split(';').map(s=>s.trim()).filter(Boolean);
  c.fertilization = parseKv(document.getElementById('edit_fert').value);
  renderSidebar(); openCrop(id); alert('Zapisano zmiany.');
}

function objToKv(obj){ if(!obj) return ''; return Object.keys(obj).map(k=>`${k}:${obj[k]}`).join(',') }
function parseKv(str){ const out={}; str.split(',').forEach(p=>{ const [k,v]=p.split(':').map(s=>s && s.trim()); if(k && v) out[k]=v }); return out }
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

/* Favorites, export crop, snapshots */
function toggleFav(id){
  const favs = JSON.parse(localStorage.getItem('agro.favs')||'[]');
  const idx = favs.indexOf(id);
  if(idx===-1){ favs.push(id); localStorage.setItem('agro.favs',JSON.stringify(favs)); renderFavs(); alert('Dodano do ulubionych'); }
  else { favs.splice(idx,1); localStorage.setItem('agro.favs',JSON.stringify(favs)); renderFavs(); alert('Usunięto z ulubionych'); }
}
function downloadCrop(id){
  const c = crops.find(x=>x.id===id); if(!c) return;
  const blob = new Blob([JSON.stringify(c,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${c.id}.json`; a.click(); URL.revokeObjectURL(url);
}
function saveSnapshot(id){
  const note = prompt('Notatka do zapisu:');
  if(note===null) return;
  const snap = {id,note,date:(new Date()).toISOString()};
  const snaps = JSON.parse(localStorage.getItem('agro.snaps')||'[]'); snaps.push(snap); localStorage.setItem('agro.snaps',JSON.stringify(snaps));
  document.getElementById('snapshotMsg').innerText = 'Zapisano notatkę lokalnie.';
}

/* Search */
function doSearch(){
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  if(!q){ alert('Wpisz słowo kluczowe'); return; }
  const matches = crops.filter(c=> (c.title && c.title.toLowerCase().includes(q)) || (c.notes && c.notes.toLowerCase().includes(q)) || (c.requirements && c.requirements.join(' ').toLowerCase().includes(q)) || (c.protection && Object.values(c.protection).join(' ').toLowerCase().includes(q)) );
  if(!matches.length){ mainEl().innerHTML = `<div class="card"><em>Brak wyników dla "${q}"</em></div>`; return; }
  mainEl().innerHTML = `<div class="card"><h2>Wyniki wyszukiwania dla "${q}"</h2></div>`;
  matches.forEach(m=>{ const el = document.createElement('div'); el.className='card'; el.innerHTML = `<h3>${m.title}</h3><div style="color:var(--muted)">${m.notes||''}</div><div style="margin-top:8px"><button class="btn" onclick="openCrop('${m.id}')">Otwórz</button></div>`; mainEl().appendChild(el); });
}

/* load saved (optional) */
(function loadState(){
  const saved = localStorage.getItem('agro.crops');
  if(saved){ try{ const parsed=JSON.parse(saved); if(Array.isArray(parsed) && parsed.length){ /* optional restore */ } }catch(e){} }
})();
