let snapshot = null;
let runTimer = null;

function doAssemble(){
  stopRun();
  clearLog();
  try{
    const {bytes, programEnd:pe} = assemble(document.getElementById('editor').value);
    mem = bytes;
    programEnd = pe;
    snapshot = mem.slice();
    resetRegs();
    log(`assembled OK — ${pe} bytes of program (of ${PROG_END-PROG_START+1} available).`, 'ok');
    renderAll();
  }catch(e){
    if(e instanceof AsmError){
      log(`line ${e.line}: ${e.message}`, 'err');
    } else {
      log('assembler error: '+e.message, 'err');
      console.error(e);
    }
  }
}

function doStep(){
  if(!snapshot){ log('assemble first.', 'err'); return; }
  cpuStep();
  renderAll();
}

function stopRun(){
  if(runTimer){ clearInterval(runTimer); runTimer=null; }
  renderRegs();
}

function doRun(){
  if(!snapshot){ log('assemble first.', 'err'); return; }
  if(runTimer) return;
  const ms = +document.getElementById('speed').value;
  runTimer = setInterval(()=>{
    if(halted){ stopRun(); return; }
    cpuStep();
    renderAll();
  }, ms);
  renderRegs();
}

function doTurbo(){
  if(!snapshot){ log('assemble first.', 'err'); return; }
  stopRun();
  let steps=0;
  const MAX=200000;
  while(!halted && steps<MAX){ cpuStep(); steps++; }
  if(steps>=MAX) log('turbo run stopped after 200000 steps (no HLT reached).', 'err');
  else log(`turbo run finished in ${steps} steps.`, 'ok');
  renderAll();
}

function doReset(){
  stopRun();
  if(snapshot){ mem = snapshot.slice(); }
  resetRegs();
  clearLog();
  log('reset to last assembled state.', 'info');
  renderAll();
}

function doSave(){
  const text = document.getElementById('editor').value;
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'program.asm';
  document.body.appendChild(a); a.click(); a.remove();
}

function doLoad(){ document.getElementById('fileInput').click(); }

document.getElementById('btnAssemble').addEventListener('click', doAssemble);
document.getElementById('btnStep').addEventListener('click', doStep);
document.getElementById('btnRun').addEventListener('click', doRun);
document.getElementById('btnTurbo').addEventListener('click', doTurbo);
document.getElementById('btnPause').addEventListener('click', stopRun);
document.getElementById('btnReset').addEventListener('click', doReset);
document.getElementById('btnSave').addEventListener('click', doSave);
document.getElementById('btnLoad').addEventListener('click', doLoad);
document.getElementById('fileInput').addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{ document.getElementById('editor').value = reader.result; };
  reader.readAsText(f);
  e.target.value='';
});
document.getElementById('speed').addEventListener('input', (e)=>{
  document.getElementById('speedLabel').textContent = e.target.value+' ms/step';
  if(runTimer){ stopRun(); doRun(); }
});

const DEMO = `ILDA 0x00
ILDB 0x01
LOOP:
OUT A
ADD B
JC DONE
JMP LOOP
DONE:
ILDA 0xFF
WBA [0xB8]
WBA [0xB9]
WBA [0xBA]
HLT
`;

document.getElementById('editor').value = DEMO;
buildMemGrid();
buildRegGrid();
buildDigit(document.getElementById('digitHi'));
buildDigit(document.getElementById('digitLo'));
buildScreen();
resetRegs();
halted = true;
renderAll();
log('ready. edit the program on the left, then press Assemble.', 'info');
