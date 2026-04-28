export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FaberJS DevTools</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Monaco','Menlo','Courier New',monospace;font-size:13px;background:#0d1117;color:#c9d1d9;height:100vh;display:flex;flex-direction:column}
header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-shrink:0}
.logo{color:#f78166;font-weight:bold;font-size:14px;letter-spacing:-0.5px}
.badge{background:#21262d;border:1px solid #30363d;border-radius:10px;padding:1px 8px;font-size:11px;color:#8b949e}
.refresh-info{margin-left:auto;display:flex;align-items:center;gap:8px;color:#8b949e;font-size:12px}
.dot{width:7px;height:7px;border-radius:50%;background:#3fb950;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
nav{background:#161b22;border-bottom:1px solid #30363d;padding:0 24px;display:flex;flex-shrink:0}
nav button{background:none;border:none;border-bottom:2px solid transparent;color:#8b949e;padding:10px 14px;cursor:pointer;font-size:13px;font-family:inherit;display:flex;align-items:center;gap:6px;transition:color 0.15s}
nav button:hover{color:#f0f6fc}
nav button.active{color:#f0f6fc;border-bottom-color:#f78166}
.panel{flex:1;overflow-y:auto;display:none}
.panel.active{display:block}
.empty{display:flex;align-items:center;justify-content:center;height:200px;color:#484f58;font-size:13px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:8px 16px;color:#484f58;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #21262d;position:sticky;top:0;background:#0d1117;z-index:1}
td{padding:8px 16px;border-bottom:1px solid #161b22;vertical-align:middle;line-height:1.5}
tr:hover td{background:#111820}
.method{display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:bold;min-width:42px;text-align:center}
.GET{background:#0d3319;color:#3fb950}
.POST{background:#0c2a6b;color:#58a6ff}
.PUT,.PATCH{background:#3a2600;color:#d29922}
.DELETE{background:#3e0f0f;color:#f85149}
.s2xx{color:#3fb950}
.s4xx{color:#d29922}
.s5xx{color:#f85149}
.dim{color:#8b949e}
.slow{color:#d29922}
.very-slow{color:#f85149}
.sql-cell{max-width:480px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#79c0ff}
.tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;background:#21262d;color:#8b949e}
.tag-req{background:#0c2a6b;color:#58a6ff}
</style>
</head>
<body>
<header>
  <span class="logo">&#9889; FaberJS DevTools</span>
  <span class="badge">local</span>
  <div class="refresh-info">
    <span class="dot"></span>
    <span id="last-refresh">connecting...</span>
  </div>
</header>
<nav>
  <button class="active" data-tab="requests" onclick="showTab('requests')">
    Requests <span class="badge" id="req-count">0</span>
  </button>
  <button data-tab="queries" onclick="showTab('queries')">
    Queries <span class="badge" id="qry-count">0</span>
  </button>
  <button data-tab="events" onclick="showTab('events')">
    Events <span class="badge" id="evt-count">0</span>
  </button>
</nav>
<div id="requests" class="panel active"></div>
<div id="queries" class="panel"></div>
<div id="events" class="panel"></div>
<script>
var activeTab='requests';
var state={requests:[],queries:[],events:[]};

function showTab(tab){
  activeTab=tab;
  document.querySelectorAll('nav button').forEach(function(b){b.classList.toggle('active',b.dataset.tab===tab)});
  document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('active',p.id===tab)});
  render();
}

function sc(s){return s>=500?'s5xx':s>=400?'s4xx':'s2xx'}
function dc(ms){return ms>1000?'very-slow':ms>500?'slow':''}
function qdc(ms){return ms>200?'very-slow':ms>100?'slow':''}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function ft(iso){try{return new Date(iso).toLocaleTimeString()}catch(e){return iso}}
function ms(n){return n<1000?n+'ms':(n/1000).toFixed(2)+'s'}

function renderRequests(){
  var d=state.requests;
  document.getElementById('req-count').textContent=d.length;
  if(!d.length){document.getElementById('requests').innerHTML='<div class="empty">No requests yet — make one to see it here</div>';return}
  var rows=d.map(function(r){
    return '<tr><td><span class="method '+esc(r.method)+'">'+esc(r.method)+'</span></td>'
      +'<td>'+esc(r.path)+'</td>'
      +'<td class="'+sc(r.status)+'">'+r.status+'</td>'
      +'<td class="'+dc(r.durationMs)+'">'+ms(r.durationMs)+'</td>'
      +'<td class="dim">'+r.queryCount+'</td>'
      +'<td class="dim">'+(r.memoryDeltaKb>0?'+':'')+r.memoryDeltaKb+'KB</td>'
      +'<td class="dim">'+ft(r.startedAt)+'</td></tr>';
  }).join('');
  document.getElementById('requests').innerHTML='<table><thead><tr><th>Method</th><th>Path</th><th>Status</th><th>Time</th><th>SQL</th><th>Memory</th><th>When</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function renderQueries(){
  var d=state.queries;
  document.getElementById('qry-count').textContent=d.length;
  if(!d.length){document.getElementById('queries').innerHTML='<div class="empty">No queries yet</div>';return}
  var rows=d.map(function(q){
    return '<tr><td><span class="sql-cell" title="'+esc(q.sql)+'">'+esc(q.sql)+'</span></td>'
      +'<td class="'+qdc(q.durationMs)+'">'+ms(q.durationMs)+'</td>'
      +'<td>'+(q.requestId?'<span class="tag tag-req">request</span>':'<span class="tag">background</span>')+'</td>'
      +'<td class="dim">'+ft(q.executedAt)+'</td></tr>';
  }).join('');
  document.getElementById('queries').innerHTML='<table><thead><tr><th>SQL</th><th>Time</th><th>Origin</th><th>When</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function renderEvents(){
  var d=state.events;
  document.getElementById('evt-count').textContent=d.length;
  if(!d.length){document.getElementById('events').innerHTML='<div class="empty">No events yet — dispatch one to see it here</div>';return}
  var rows=d.map(function(e){
    return '<tr><td>'+esc(e.eventType)+'</td>'
      +'<td class="dim">'+ms(e.durationMs)+'</td>'
      +'<td class="dim">'+ft(e.firedAt)+'</td></tr>';
  }).join('');
  document.getElementById('events').innerHTML='<table><thead><tr><th>Event</th><th>Duration</th><th>When</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function render(){
  if(activeTab==='requests')renderRequests();
  else if(activeTab==='queries')renderQueries();
  else if(activeTab==='events')renderEvents();
}

async function refresh(){
  try{
    var base=window.location.pathname.replace(/\\/$/,'');
    var r=await Promise.all([
      fetch(base+'/api/requests').then(function(r){return r.json()}),
      fetch(base+'/api/queries').then(function(r){return r.json()}),
      fetch(base+'/api/events').then(function(r){return r.json()}),
    ]);
    state={requests:r[0],queries:r[1],events:r[2]};
    document.getElementById('last-refresh').textContent=new Date().toLocaleTimeString();
    render();
  }catch(e){
    document.getElementById('last-refresh').textContent='error — retrying';
  }
}

refresh();
setInterval(refresh,3000);
</script>
</body>
</html>`;
