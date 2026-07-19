function log(msg, cls){
  const d = document.getElementById('log');
  const line = document.createElement('div');
  if(cls) line.className = cls;
  line.textContent = msg;
  d.appendChild(line);
  d.scrollTop = d.scrollHeight;
}
function clearLog(){ document.getElementById('log').innerHTML=''; }

function hex2(n){ return n.toString(16).toUpperCase().padStart(2,'0'); }

function regionClass(addr){
  if(addr>=SCREEN_START && addr<=SCREEN_END) return 'screen';
  if(addr>=VIDEO_START && addr<=VIDEO_END) return 'video';
  if(addr>=MISC_START && addr<=MISC_END) return 'misc';
  if(addr>=STACK_START && addr<=STACK_END) return 'stack';
  return 'prog';
}

const memCells = [];
function buildMemGrid(){
  const grid = document.getElementById('memgrid');
  grid.innerHTML = '';
  grid.appendChild(document.createElement('div'));
  for(let c=0;c<16;c++){
    const h=document.createElement('div'); h.className='hdr'; h.textContent=c.toString(16).toUpperCase();
    grid.appendChild(h);
  }
  for(let r=0;r<16;r++){
    const rh=document.createElement('div'); rh.className='rowhdr'; rh.textContent=(r*16).toString(16).toUpperCase().padStart(2,'0');
    grid.appendChild(rh);
    for(let c=0;c<16;c++){
      const addr=r*16+c;
      const cell=document.createElement('div');
      cell.className='cell '+regionClass(addr);
      cell.contentEditable='true';
      cell.spellcheck=false;
      cell.dataset.addr=addr;
      cell.textContent=hex2(mem[addr]);
      cell.addEventListener('focus', ()=>{ cell.textContent = hex2(mem[addr]); selectAll(cell); });
      cell.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); cell.blur(); }});
      cell.addEventListener('blur', ()=>{
        let v=parseInt(cell.textContent.trim(),16);
        if(isNaN(v)) v=mem[addr];
        v = ((v%256)+256)%256;
        mem[addr]=v;
        cell.textContent=hex2(v);
        renderScreen(); renderSevenSeg();
      });
      grid.appendChild(cell);
      memCells.push(cell);
    }
  }
}
function selectAll(el){
  const range=document.createRange(); range.selectNodeContents(el);
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
function renderMemGrid(){
  for(const cell of memCells){
    const addr = +cell.dataset.addr;
    if(document.activeElement===cell) continue;
    cell.textContent = hex2(mem[addr]);
    cell.classList.toggle('pc', addr===PC || addr===PC+1);
    cell.classList.toggle('sp', addr===SP);
  }
}

function buildRegGrid(){
  const names = [
    ['A','A'],['B','B'],['C','C'],
    ['ALU_REGA','ALU_REGA'],['ALU_REGB','ALU_REGB'],['ALU_OUT','ALU_OUT'],
    ['PC','PC'],['SP','SP'],['OUT_REG','OUT_REG'],
  ];
  const grid = document.getElementById('regGrid');
  grid.innerHTML='';
  for(const [id,label] of names){
    const box=document.createElement('div');
    box.className='reg-box'+((id==='PC'||id==='SP')?' '+id.toLowerCase():'');
    box.innerHTML = `<div class="name">${label}</div><div class="val" id="reg_${id}">00<small id="regd_${id}">0</small></div>`;
    grid.appendChild(box);
  }
  const flags=document.getElementById('flagsGrid');
  flags.innerHTML = `
    <div class="flag" id="flagZF"><span class="dot"></span>ZF</div>
    <div class="flag" id="flagCF"><span class="dot"></span>CF</div>
    <div class="flag" id="flagHalt"><span class="dot"></span>HALT</div>
  `;
}
function renderRegs(){
  const map = {A,B,C,ALU_REGA,ALU_REGB,ALU_OUT,PC,SP,OUT_REG};
  for(const k in map){
    const el=document.getElementById('reg_'+k);
    if(!el) continue;
    el.firstChild.textContent = '0x'+hex2(map[k]);
    document.getElementById('regd_'+k).textContent = map[k];
  }
  document.getElementById('flagZF').classList.toggle('on', ZF===1);
  document.getElementById('flagCF').classList.toggle('on', CF===1);
  document.getElementById('flagHalt').classList.toggle('on', halted===true);
  const led = document.getElementById('statusLed');
  const txt = document.getElementById('statusText');
  if(halted){ led.className='status-led halt'; txt.textContent='halted'; }
  else if(runTimer){ led.className='status-led run'; txt.textContent='running'; }
  else { led.className='status-led'; txt.textContent='idle'; }
}

const SEG_MAP = {
  0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',
  7:'abc',8:'abcdefg',9:'abcdfg',10:'abcefg',11:'fedcg',12:'afed',
  13:'bcdeg',14:'afged',15:'afge'
};
function buildDigit(el){
  el.innerHTML = ['a','b','c','d','e','f','g'].map(s=>`<div class="seg ${s}"></div>`).join('');
}
function setDigit(el, value){
  const segs = SEG_MAP[value] || '';
  for(const s of ['a','b','c','d','e','f','g']){
    el.querySelector('.'+s).classList.toggle('on', segs.includes(s));
  }
}
function renderSevenSeg(){
  setDigit(document.getElementById('digitHi'), (OUT_REG>>4)&0xF);
  setDigit(document.getElementById('digitLo'), OUT_REG&0xF);
}

const pxCells = [];
function buildScreen(){
  const scr = document.getElementById('screen');
  scr.innerHTML='';
  for(let i=0;i<576;i++){
    const d=document.createElement('div'); d.className='px';
    scr.appendChild(d); pxCells.push(d);
  }
}
function renderScreen(){
  for(let i=0;i<576;i++){
    const byteIdx = SCREEN_START + (i>>3);
    const bit = 7 - (i & 7);
    const on = (mem[byteIdx] >> bit) & 1;
    pxCells[i].classList.toggle('on', on===1);
  }
}

function renderAll(){
  renderRegs(); renderMemGrid(); renderSevenSeg(); renderScreen();
}
