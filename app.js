/* === 🔄 Auto-Update & Versioning === */
(function(){
  try {
    const meta = document.querySelector('meta[name="app-version"]');
    const version = meta ? meta.content : null;
    const last = localStorage.getItem('aytoAppVersion');
    if (version && version !== last) {
      localStorage.setItem('aytoAppVersion', version);
      if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      location.reload(true);
    }
  } catch (e) { console.warn("Fehler beim Auto-Update:", e); }
})();

/* === 🛠 Globale Helfer & Daten-Management === */
const STORAGE_KEY_T = "aytoTeilnehmer";
let virtualMatches = []; // Speicher für den Simulator

function getT() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_T)) || {A:[], B:[]}; } catch(e) { return {A:[], B:[]}; } }
function saveT(data) { localStorage.setItem(STORAGE_KEY_T, JSON.stringify(data)); document.dispatchEvent(new Event("teilnehmerChanged")); }

function showOverlay(){
  const ov = document.getElementById('overlay');
  if(ov){ 
    ov.classList.add('show'); 
    const bar = ov.querySelector('.bar'); 
    const status = ov.querySelector('.status-text');
    if(bar) bar.style.width = "0%"; 
    if(status) status.textContent = "Berechnung läuft... (0%)";
  }
}
function hideOverlay(){
  const ov = document.getElementById('overlay'); if(ov) ov.classList.remove('show');
}

/* === 👥 Teilnehmer-Verwaltung === */
function createPersonUI(name, group, listId) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;
  const div = document.createElement("div");
  div.className = "row";
  div.innerHTML = `<input type="text" value="${name}" placeholder="Name" style="flex:1"><button class="danger small">✖</button>`;
  const inp = div.querySelector("input");
  inp.oninput = () => {
    const A = [...document.getElementById("listA").querySelectorAll("input")].map(i=>i.value.trim()).filter(Boolean);
    const B = [...document.getElementById("listB").querySelectorAll("input")].map(i=>i.value.trim()).filter(Boolean);
    saveT({A, B});
  };
  div.querySelector("button").onclick = () => { div.remove(); inp.oninput(); };
  listEl.appendChild(div);
}

/* === 🚀 Haupt-Initialisierung === */
document.addEventListener("DOMContentLoaded", () => {
  
/* --- 🌐 Navigation --- */
const nav = document.getElementById('nav');
const pages = document.querySelectorAll('.page');
if(nav){
  nav.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.getAttribute('data-target');
    pages.forEach(p=> p.classList.toggle('active', p.id===id));
    
    // NEU: Wenn die Nights/Orakel Seite geöffnet wird, Orakel rendern
    if(id === 'page-nights') {
      renderOrakel();
    }
    
    window.scrollTo({top:0, behavior:'smooth'});
  });
}


  /* --- 👥 Teilnehmer & Prefill --- */
  const listA = document.getElementById("listA"), listB = document.getElementById("listB");
  if(listA && listB) {
    const data = getT();
    data.A.forEach(n => createPersonUI(n, "A", "listA"));
    data.B.forEach(n => createPersonUI(n, "B", "listB"));

    document.getElementById("addA").onclick = () => createPersonUI("", "A", "listA");
    document.getElementById("addB").onclick = () => createPersonUI("", "B", "listB");

    const preBtn = document.getElementById("prefill");
    if(preBtn) {
      preBtn.onclick = () => {
        const A = ["Alexandra", "Christin", "Emma", "Francesca", "Janice", "Jenny", "Julia", "Marta", "Michelle", "Zoe"];
        const B = ["Bennett", "Brian", "Cansin", "Daymian", "Fabi", "Germain", "Johannes", "Marwin", "Raul", "Robin"];
        listA.innerHTML = ""; listB.innerHTML = "";
        A.forEach(n => createPersonUI(n, "A", "listA"));
        B.forEach(n => createPersonUI(n, "B", "listB"));
        saveT({A, B});
        preBtn.textContent = "✅ Staffel 2026 VIP geladen"; preBtn.disabled = true;
      };
    }
  }

/* --- 💞 Matchbox --- */
const tbA = document.getElementById("tbA"), 
      tbB = document.getElementById("tbB"), 
      tbList = document.getElementById("tbList");

if(tbA && tbB) {
  const refreshMBOptions = () => {
    const {A, B} = getT();
    tbA.innerHTML = '<option value="">— A auswählen —</option>' + A.map(n=>`<option>${n}</option>`).join("");
    tbB.innerHTML = '<option value="">— B auswählen —</option>' + B.map(n=>`<option>${n}</option>`).join("");
  };

  const renderMB = () => {
    const mb = JSON.parse(localStorage.getItem("aytoMatchbox") || "[]");
    tbList.innerHTML = mb.length ? "" : "<div class='small muted'>Noch keine Einträge</div>";
    
    mb.forEach((m, i) => {
      // Logik für die Anzeige (Text & CSS-Klasse)
      let tagClass = "";
      let fullText = "";

      if (m.type === "PM") {
        tagClass = "pm";
        fullText = "Perfect Match";
      } else if (m.type === "NM") {
        tagClass = "nm";
        fullText = "No Match";
      } else if (m.type === "SOLD") {
        tagClass = "sold";
        fullText = "Verkauft";
      } else {
        tagClass = "neutral";
        fullText = m.type;
      }

      const div = document.createElement("div"); 
      div.className = "row";
      // Wir nutzen hier das Flex-Layout für die saubere Trennung von Text und Button
      div.innerHTML = `
        <div style="flex:1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span><b>${m.A}</b> × <b>${m.B}</b></span>
          <span class="tag ${tagClass}">${fullText}</span>
        </div>
        <button class="danger small">✖</button>
      `;

      div.querySelector("button").onclick = () => { 
        mb.splice(i, 1); 
        localStorage.setItem("aytoMatchbox", JSON.stringify(mb)); 
        renderMB(); 
      };
      tbList.appendChild(div);
    });
  };

  document.getElementById("addTB").onclick = () => {
    if(!tbA.value || !tbB.value) return alert("Bitte A und B wählen");
    const mb = JSON.parse(localStorage.getItem("aytoMatchbox") || "[]");
    mb.push({
      A: tbA.value, 
      B: tbB.value, 
      type: document.getElementById("tbType").value
    });
    localStorage.setItem("aytoMatchbox", JSON.stringify(mb));
    renderMB();
  };

  document.addEventListener("teilnehmerChanged", refreshMBOptions);
  refreshMBOptions(); 
  renderMB();
}


  /* --- 🌙 Matching Nights --- */
  const addNightBtn = document.getElementById("addNight"), nightsList = document.getElementById("nights");
  if(addNightBtn) {
    const renderNights = () => {
      const nights = JSON.parse(localStorage.getItem("aytoMatchingNights") || "[]");
      nightsList.innerHTML = nights.length ? "" : "<div class='small muted'>Keine Matching Night angelegt</div>";
      nights.forEach((n, i) => {
        const div = document.createElement("div"); div.className="card stack";
        div.innerHTML = `<div class="row" style="justify-content:space-between"><strong>Night ${i+1}</strong><button class="danger small">✖</button></div>
          <div class="small muted">Lichter: ${n.lights}</div>
          <table style="width:100%;font-size:12px">${n.pairs.map(p=>`<tr><td>${p.A}</td><td>×</td><td>${p.B === 'keine' ? '<i>Kein Partner</i>' : p.B}</td></tr>`).join("")}</table>`;
        div.querySelector("button").onclick = () => { nights.splice(i,1); localStorage.setItem("aytoMatchingNights", JSON.stringify(nights)); renderNights(); };
        nightsList.appendChild(div);
      });
    };

    addNightBtn.onclick = () => {
      const {A, B} = getT(); if(!A.length || !B.length) return alert("Teilnehmer fehlen!");
      const ov = document.createElement("div"); ov.style="position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;display:flex;align-items:center;justify-content:center;padding:15px";
      const box = document.createElement("div"); box.className="card stack"; box.style="max-width:450px;width:100%;max-height:95vh;overflow-y:auto;background:#171a2b;padding:20px;border:1px solid #333";
      box.innerHTML = `<h3 style="margin-top:0">Matching Night</h3>`;
      const pairRows = [];
      const updateSelects = () => {
        const usedB = pairRows.map(r => r.sel.value).filter(v => v !== "keine");
        pairRows.forEach(row => {
          const current = row.sel.value;
          let html = `<option value="keine">Kein Partner</option>`;
          B.forEach(nameB => { if (!usedB.includes(nameB) || nameB === current) html += `<option value="${nameB}" ${nameB === current ? 'selected' : ''}>${nameB}</option>`; });
          row.sel.innerHTML = html;
        });
      };
      A.forEach(nameA => {
        const row = document.createElement("div"); row.style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px";
        row.innerHTML = `<span style="font-size:14px;font-weight:bold;flex:1">${nameA}</span>`;
        const sel = document.createElement("select"); sel.style="flex:1.5;padding:8px";
        sel.onchange = updateSelects; row.appendChild(sel); box.appendChild(row);
        pairRows.push({A: nameA, sel});
      });
      updateSelects();
      const lRow = document.createElement("div"); lRow.className="row"; lRow.style="margin-top:15px;padding-top:15px;border-top:1px solid #333";
      const lightSelect = document.createElement("select"); lightSelect.style="width:100px;padding:8px";
      for(let i=0; i <= A.length; i++) lightSelect.innerHTML += `<option value="${i}">${i}</option>`;
      lRow.innerHTML = `<span>Lichter:</span>`; lRow.appendChild(lightSelect); box.appendChild(lRow);
      const btnRow = document.createElement("div"); btnRow.className="row"; btnRow.style="margin-top:20px";
      const sBtn = document.createElement("button"); sBtn.className="primary"; sBtn.style="flex:1"; sBtn.textContent="Speichern";
      const cBtn = document.createElement("button"); cBtn.className="ghost"; cBtn.style="flex:1"; cBtn.textContent="Abbrechen";
      btnRow.appendChild(sBtn); btnRow.appendChild(cBtn); box.appendChild(btnRow); ov.appendChild(box); document.body.appendChild(ov);
      cBtn.onclick = () => ov.remove();
      sBtn.onclick = () => {
        const pairs = pairRows.map(r=>({A: r.A, B: r.sel.value}));
        const nights = JSON.parse(localStorage.getItem("aytoMatchingNights") || "[]");
        nights.push({pairs, lights: parseInt(lightSelect.value)});
        localStorage.setItem("aytoMatchingNights", JSON.stringify(nights));
        ov.remove(); renderNights();
      };
    };
    renderNights();
  }

  /* --- 💾 Daten-Sicherung --- */
  const exportBtn = document.getElementById("exportBtn"), importBtn = document.getElementById("importBtn"), importFile = document.getElementById("importFile"), resetBtn = document.getElementById("resetBtn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const data = { teilnehmer: getT(), matchbox: JSON.parse(localStorage.getItem("aytoMatchbox") || "[]"), nights: JSON.parse(localStorage.getItem("aytoMatchingNights") || "[]") };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `AYTO_Backup.json`; a.click();
    };
  }
  if (importBtn) {
    importBtn.onclick = () => importFile.click();
    importFile.onchange = (e) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imported = JSON.parse(ev.target.result);
        localStorage.setItem(STORAGE_KEY_T, JSON.stringify(imported.teilnehmer));
        localStorage.setItem("aytoMatchbox", JSON.stringify(imported.matchbox));
        localStorage.setItem("aytoMatchingNights", JSON.stringify(imported.nights));
        location.reload();
      };
      reader.readAsText(e.target.files[0]);
    };
  }
  if (resetBtn) resetBtn.onclick = () => { if (confirm("Alles löschen?")) { localStorage.clear(); location.reload(); } };

  initSolver();
});

/* === 🔮 Orakel-Logik === */
function renderOrakel() {
  const orakelBox = document.getElementById("orakelBox"); 
  const matrixContainer = document.getElementById("matrix");
  
  if (!orakelBox) return;

  if (!matrixContainer || !matrixContainer.innerHTML || matrixContainer.innerHTML.includes("display: none")) {
    orakelBox.innerHTML = `
      <div class="card stack" style="text-align:center; padding: 40px 20px;">
        <div style="font-size: 40px; margin-bottom: 10px;">🔮</div>
        <h3>Das Orakel schläft noch...</h3>
        <p class="small muted">Berechne zuerst die Ergebnisse im Home-Tab, damit ich die Daten analysieren kann!</p>
      </div>`;
    return;
  }

  let pairs = [];
  const rows = matrixContainer.querySelectorAll("tr");
  if(rows.length < 2) return;
  const headers = Array.from(rows[0].querySelectorAll("th")).map(th => th.innerText);

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td");
    const nameA = cells[0].innerText;
    for (let j = 1; j < cells.length; j++) {
      const nameB = headers[j];
      const val = cells[j].innerText;
      let prob = 0;
      if (val === "MATCH" || val === "FIXED") prob = 100;
      else if (val === "No Match") prob = 0;
      else prob = parseFloat(val.replace("%", ""));
      pairs.push({ nameA, nameB, prob });
    }
  }

  const topPairs = pairs.filter(p => p.prob > 0).sort((a, b) => b.prob - a.prob).slice(0, 5);
  const deadPairs = pairs.filter(p => p.prob === 0).slice(0, 12);

  let html = `<h2 style="margin-bottom:20px">🔮 Match-Orakel</h2>`;
  
  html += `
    <div class="card stack" style="border-top: 4px solid #ffd700;">
      <strong style="color:#ffd700; text-transform: uppercase; font-size: 12px;">🔥 Heißeste Tipps (Top 5)</strong>
      <div class="stack" style="margin-top:10px">
        ${topPairs.map((p, i) => `
          <div class="row oracle-card ${p.prob === 100 ? 'perfect-match' : ''}" 
               style="justify-content:space-between; background: rgba(52, 111, 255, 0.1); padding: 12px; border-radius: 10px; margin-bottom: 8px;">
            <span><span style="opacity:0.5; margin-right:8px;">#${i+1}</span> <b>${p.nameA} & ${p.nameB}</b></span>
            <span style="color:${p.prob === 100 ? '#ffd700' : '#346FFF'}; font-weight:bold">
              ${p.prob === 100 ? 'MATCH' : p.prob.toFixed(1) + '%'}
            </span>
          </div>
        `).join("")}
      </div>
    </div>`;

  html += `
    <div class="card stack" style="border-top: 4px solid #ff4f4f;">
      <strong style="color:#ff4f4f; text-transform: uppercase; font-size: 12px;">❄️ Kälter als Eis (0%)</strong>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top:10px">
        ${deadPairs.map(p => `
          <div style="font-size:11px; background: rgba(255,79,79,0.05); padding: 5px 8px; border-radius: 5px; color: #aaa;">
            ${p.nameA} × ${p.nameB}
          </div>
        `).join("")}
      </div>
    </div>`;

  orakelBox.innerHTML = html;
}


/* === 📊 Solver & Simulator === */
function toggleVirtualMatch(nameA, nameB) {
  const index = virtualMatches.findIndex(vm => vm.A === nameA && vm.B === nameB);
  if (index > -1) {
    virtualMatches.splice(index, 1);
  } else {
    virtualMatches = virtualMatches.filter(vm => vm.A !== nameA);
    virtualMatches.push({A: nameA, B: nameB, type: "PM"});
  }
  document.getElementById("solveBtn").click();
}

function initSolver() {
  const solveBtn = document.getElementById("solveBtn"), summaryBox = document.getElementById("summary"), matrixBox = document.getElementById("matrix");
  if (!solveBtn) return;

  const workerCode = `
    self.onmessage = function(e) {
      const { A, B, M, Nraw, startBIdx } = e.data;
      const idxA = Object.fromEntries(A.map((n,i)=>[n,i])), idxB = Object.fromEntries(B.map((n,i)=>[n,i]));
      const m = A.length, n = B.length;
      const forced = Array(m).fill(-1), forbidden = Array.from({length:m}, ()=>new Set());
      M.forEach(t => {
        if(!(t.A in idxA) || !(t.B in idxB)) return;
        const a = idxA[t.A], b = idxB[t.B];
        if(t.type === "PM") forced[a] = b;
        else if(t.type === "NM") forbidden[a].add(b);
      });
      const nights = (Nraw || []).map(nObj => ({
        pairs: (nObj.pairs || []).map(p => ({ aIdx: (p.A in idxA) ? idxA[p.A] : -1, bIdx: (p.B === "keine") ? -1 : ((p.B in idxB) ? idxB[p.B] : -2) })).filter(p => p.aIdx !== -1),
        beams: Number(nObj.lights)
      }));
      let total = 0n, counts = Array.from({length:m},()=>Array(n).fill(0n)), assign = Array(m).fill(-1), useCountB = new Array(n).fill(0), doubleManUsed = false;

      function dfs(aIdx) {
        for(const nt of nights) {
          let hits = 0, undecided = 0;
          for(const pair of nt.pairs) {
            if(pair.aIdx < aIdx) { if(assign[pair.aIdx] === pair.bIdx) hits++; }
            else { undecided++; }
          }
          if(hits > nt.beams || hits + undecided < nt.beams) return;
        }
        if(aIdx === m) {
          if(!doubleManUsed) return;
          total++;
          for(let i=0; i<m; i++) { if(assign[i] >= 0) counts[i][assign[i]]++; }
          return;
        }
        const forceB = forced[aIdx], start = (aIdx === 0) ? startBIdx : 0, end = (aIdx === 0) ? startBIdx : n - 1;
        for(let b = start; b <= end; b++) {
          if(forbidden[aIdx].has(b) || (forceB !== -1 && forceB !== b)) continue;
          const isSecond = (useCountB[b] === 1);
          if(useCountB[b] >= 2 || (isSecond && doubleManUsed)) continue;
          const prevDouble = doubleManUsed;
          if(isSecond) doubleManUsed = true;
          useCountB[b]++; assign[aIdx] = b;
          dfs(aIdx + 1);
          assign[aIdx] = -1; useCountB[b]--; doubleManUsed = prevDouble;
        }
      }
      dfs(0);
      self.postMessage({ total: total.toString(), counts: counts.map(r=>r.map(c=>c.toString())) });
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);

  solveBtn.onclick = () => {
    const {A, B} = getT(); if(A.length < 2) return alert("Daten unvollständig!");
    showOverlay();
    
    const bar = document.querySelector('#overlay .bar');
    const statusText = document.querySelector('#overlay .status-text');
    let startTime = Date.now();
    let duration = 3000;

    let animInterval = setInterval(() => {
      let elapsed = Date.now() - startTime;
      let progress = Math.min(Math.round((elapsed / duration) * 100), 99);
      if (bar) bar.style.width = progress + "%";
      if (statusText) statusText.textContent = `Berechnung läuft... (${progress}%)`;
    }, 30);

    const numWorkers = B.length;
    let completed = 0, finalTotal = 0n, finalCounts = Array.from({length:A.length},()=>Array(B.length).fill(0n));

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(workerUrl);
      worker.postMessage({
        A, B, startBIdx: i,
        M: [...JSON.parse(localStorage.getItem("aytoMatchbox")||"[]"), ...virtualMatches],
        Nraw: JSON.parse(localStorage.getItem("aytoMatchingNights")||"[]")
      });

      worker.onmessage = (e) => {
        finalTotal += BigInt(e.data.total);
        e.data.counts.forEach((row, rIdx) => { row.forEach((val, cIdx) => { finalCounts[rIdx][cIdx] += BigInt(val); }); });
        completed++;
        worker.terminate();

        if (completed === numWorkers) {
          let timeToWait = Math.max(0, duration - (Date.now() - startTime));
          setTimeout(() => {
            clearInterval(animInterval);
            if (bar) bar.style.width = "100%";
            if (statusText) statusText.textContent = `Berechnung läuft... (100%)`;
            setTimeout(() => { renderResults(finalTotal, finalCounts, A, B); hideOverlay(); }, 400);
          }, timeToWait);
        }
      };
    }
  };

  function renderResults(total, counts, A, B) {
    let summaryHtml = `<h3>Ergebnis ${virtualMatches.length ? '<span class="tag warning">Simulation</span>' : ''}</h3>
                       <div>${total === 0n ? "Keine Kombi gefunden" : total.toString() + " Kombinationen"}</div>`;
    if(virtualMatches.length) summaryHtml += `<button class="small ghost" onclick="virtualMatches=[];document.getElementById('solveBtn').click()">Simulation beenden</button>`;
    summaryBox.innerHTML = summaryHtml;

    let html = '<div class="ayto-table-container"><table class="ayto-table"><tr><th></th>';
    B.forEach(nameB => { html += `<th>${nameB}</th>`; });
    html += '</tr>';
    A.forEach((nameA, i) => {
      html += `<tr><td class="a-name">${nameA}</td>`;
      B.forEach((nameB, j) => {
        const count = counts[i][j];
        const p = total > 0n ? Number((count * 10000n) / total) / 100 : 0;
        const isVirtual = virtualMatches.find(vm => vm.A === nameA && vm.B === nameB);
        
        let style = "";
        let content = p.toFixed(2) + "%";

        if (isVirtual) {
          style = "background:#00ffaa;color:#000;font-weight:bold;cursor:pointer;border:2px solid #fff;";
          content = "FIXED";
        } else if (p >= 100) {
          style = "background:#ffd700;color:#000;font-weight:bold;text-align:center;";
          content = "MATCH";
        } else if (count === 0n) {
          style = "background:#2d334a;color:#444;font-size:10px;";
          content = "No Match";
        } else {
          const hue = 260 - (p * 2.5);
          style = `background:hsl(${hue},70%,25%);color:white;cursor:pointer;`;
        }

        html += `<td style="${style}" onclick="toggleVirtualMatch('${nameA}', '${nameB}')">${content}</td>`;
      });
      html += '</tr>';
    });
    matrixBox.innerHTML = html + "</table></div>";
    matrixBox.style.display = "block";
  }
}
