const MEM_SIZE = 256;
const PROG_START = 0x00, PROG_END = 0x57;
const STACK_START = 0x58, STACK_END = 0x5F;
const MISC_START = 0x60, MISC_END = 0x9F;
const VIDEO_START = 0xA0, VIDEO_END = 0xFF;
const SCREEN_START = 0xB8, SCREEN_END = 0xFF;

const OPS = {
  NOP:{code:0,type:'none'},
  LDA:{code:1,type:'addr'}, LDB:{code:2,type:'addr'}, LDC:{code:3,type:'addr'},
  ILDA:{code:4,type:'val'}, ILDB:{code:5,type:'val'}, ILDC:{code:6,type:'val'},
  WBA:{code:7,type:'addr'}, WBB:{code:8,type:'addr'},
  OUT:{code:9,type:'out'},
  ADD:{code:10,type:'alu'}, SUB:{code:11,type:'alu'},
  XOR:{code:12,type:'logic'}, OR:{code:13,type:'logic'}, AND:{code:14,type:'logic'},
  SHR:{code:15,type:'shift'}, ASHR:{code:16,type:'shift'}, SHL:{code:17,type:'shift'},
  SWPB:{code:18,type:'none'}, SWPC:{code:19,type:'none'}, SWPBC:{code:20,type:'none'},
  INC:{code:21,type:'incdec'}, DEC:{code:22,type:'incdec'},
  PUSH:{code:23,type:'push'}, POP:{code:24,type:'pop'},
  HLT:{code:25,type:'none'},
  JMP:{code:29,type:'jump',sub:0}, JZ:{code:29,type:'jump',sub:1},
  JNZ:{code:29,type:'jump',sub:2}, JC:{code:29,type:'jump',sub:3}, JNC:{code:29,type:'jump',sub:4},
  LOAD:{code:30,type:'addr_val'}
};

let mem = new Uint8Array(MEM_SIZE);
let A=0,B=0,C=0,PC=0,SP=STACK_START;
let ALU_REGA=0, ALU_REGB=0, ALU_OUT=0, OUT_REG=0;
let ZF=0, CF=0, halted=true;
let programEnd = 0;

class AsmError extends Error{ constructor(msg,line){ super(msg); this.line=line; } }

function num(tok, lineNo = 0){
  if(tok===undefined) return NaN;
  let neg=false, t=tok.trim();
  if(t[0]==='-'){neg=true; t=t.slice(1);}
  let v;
  if(/^0x[0-9a-f]+$/i.test(t)) {
    if(t.slice(2).length >= 3) throw new AsmError(`Hex value "${tok}" has 3 or more characters. Max 8-bit value is 0xFF.`, lineNo);
    v=parseInt(t,16);
  }
  else if(/^0b[01]+$/i.test(t)) {
    if(t.slice(2).length > 8) throw new AsmError(`Binary value "${tok}" exceeds 8 bits.`, lineNo);
    v=parseInt(t.slice(2),2);
  }
  else if(/^[0-9]+$/.test(t)) {
    v=parseInt(t,10);
  }
  else return NaN;
  
  if(neg) v=-v;
  if(v < 0 || v > 255) throw new AsmError(`Value "${tok}" out of 8-bit range (0-255).`, lineNo);
  return v;
}

function stripBrackets(tok){
  let t=tok.trim();
  if(t.startsWith('[') && t.endsWith(']')) t=t.slice(1,-1).trim();
  return t;
}

function resolveAddr(tok, labels, line){
  const inner = stripBrackets(tok);
  if(Object.prototype.hasOwnProperty.call(labels, inner)) return labels[inner];
  const v = num(inner, line);
  if(isNaN(v)) throw new AsmError(`unknown label or address "${tok}"`, line);
  if(v<0 || v>255) throw new AsmError(`address "${tok}" out of range 0-255`, line);
  return v;
}

function assemble(source){
  const rawLines = source.split('\n');
  const instrs = [];
  const labels = {};
  let pc = 0;

  for(let i=0;i<rawLines.length;i++){
    const lineNo = i+1;
    let line = rawLines[i].replace(/;.*/,'').replace(/\/\/.*/,'').trim();
    if(!line) continue;
    const lm = line.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if(lm){
      const lbl = lm[1];
      if(Object.prototype.hasOwnProperty.call(OPS, lbl.toUpperCase()))
        throw new AsmError(`label "${lbl}" collides with a mnemonic`, lineNo);
      labels[lbl] = pc;
      line = lm[2].trim();
      if(!line) continue;
    }
    const parts = line.split(/[\s,]+/).filter(Boolean);
    const mnemonic = parts[0].toUpperCase();
    if(!Object.prototype.hasOwnProperty.call(OPS, mnemonic))
      throw new AsmError(`unknown instruction "${parts[0]}"`, lineNo);
    
    let size = (mnemonic === 'LOAD') ? 3 : 2; 
    instrs.push({mnemonic, args: parts.slice(1), lineNo, address: pc, size});
    pc += size;
  }
  
  if(pc > (PROG_END - PROG_START + 1))
    throw new AsmError(`program too large: ${pc} bytes, program memory holds ${PROG_END-PROG_START+1} bytes`, 0);

  const bytes = new Uint8Array(MEM_SIZE);
  bytes.set(mem);
  for(let a=PROG_START; a<=PROG_END; a++) bytes[a]=0;

  for(const ins of instrs){
    const {mnemonic, args, lineNo} = ins;
    const op = OPS[mnemonic];
    let sub = op.sub || 0;
    let byte2 = 0;

    switch(op.type){
      case 'none': break;
      case 'addr': {
        if(args.length<1) throw new AsmError(`${mnemonic} requires an address operand`, lineNo);
        if(args[0].startsWith('*[')){ sub=1; byte2=resolveAddr(args[0].slice(1), labels, lineNo); }
        else { sub=0; byte2=resolveAddr(args[0], labels, lineNo); }
        break;
      }
      case 'val': {
        if(args.length<1) throw new AsmError(`${mnemonic} requires a value operand`, lineNo);
        const v = num(args[0], lineNo);
        if(isNaN(v)) throw new AsmError(`${mnemonic}: "${args[0]}" is not a valid value`, lineNo);
        byte2 = v;
        break;
      }
      case 'addr_val': { 
        if(args.length<2) throw new AsmError(`${mnemonic} requires an address and a value`, lineNo);
        if(args[0].startsWith('*[')){ sub=1; byte2=resolveAddr(args[0].slice(1), labels, lineNo); }
        else { sub=0; byte2=resolveAddr(args[0], labels, lineNo); }
        const v = num(args[1], lineNo);
        if(isNaN(v)) throw new AsmError(`${mnemonic}: "${args[1]}" is not a valid value`, lineNo);
        bytes[ins.address+2] = v & 0xFF; 
        break;
      }
      case 'out': {
        const r = (args[0]||'').toUpperCase();
        if(r==='A') sub=0; else if(r==='B') sub=1; else if(r==='C') sub=2;
        else throw new AsmError(`OUT expects A, B or C`, lineNo);
        break;
      }
      case 'alu': {
        const t = (args[0]||''), tu = t.toUpperCase();
        if(tu==='B') sub=0;
        else if(tu==='C') sub=1;
        else if(t.trim().startsWith('*[')){ sub=4; byte2=resolveAddr(t.slice(1), labels, lineNo); }
        else if(t.trim().startsWith('[')){ sub=2; byte2=resolveAddr(t,labels,lineNo); }
        else { const v=num(t, lineNo); if(isNaN(v)) throw new AsmError(`${mnemonic}: bad operand "${t}"`, lineNo); sub=3; byte2=v; }
        break;
      }
      case 'logic': {
        const t = (args[0]||''), tu = t.toUpperCase();
        if(tu==='A') sub=0;
        else if(tu==='C') sub=1;
        else if(t.trim().startsWith('*[')){ sub=4; byte2=resolveAddr(t.slice(1), labels, lineNo); }
        else if(t.trim().startsWith('[')){ sub=2; byte2=resolveAddr(t,labels,lineNo); }
        else { const v=num(t, lineNo); if(isNaN(v)) throw new AsmError(`${mnemonic}: bad operand "${t}"`, lineNo); sub=3; byte2=v; }
        break;
      }
      case 'shift': {
        const t=(args[0]||'');
        if(t.trim().startsWith('*[')){ sub=2; byte2=resolveAddr(t.slice(1), labels, lineNo); }
        else if(t.trim().startsWith('[')){ sub=1; byte2=resolveAddr(t,labels,lineNo); }
        else { const v=num(t, lineNo); if(isNaN(v)) throw new AsmError(`${mnemonic}: bad operand "${t}"`, lineNo); sub=0; byte2=v; }
        break;
      }
      case 'incdec': {
        const r0 = (args[0]||'').toUpperCase();
        if(args.length===1){
          if(r0==='A') sub=0; else if(r0==='B') sub=1; else if(r0==='C') sub=2;
          else throw new AsmError(`${mnemonic} expects A, B, C, or "C, value"`, lineNo);
        } else {
          if(r0!=='C') throw new AsmError(`${mnemonic} with two operands must target C`, lineNo);
          const t=args[1];
          if(t.trim().startsWith('*[')){ sub=6; byte2=resolveAddr(t.slice(1), labels, lineNo); }
          else if(t.trim().startsWith('[')){ sub=5; byte2=resolveAddr(t,labels,lineNo); }
          else { const v=num(t, lineNo); if(isNaN(v)) throw new AsmError(`${mnemonic}: bad operand "${t}"`, lineNo); sub=4; byte2=v; }
        }
        break;
      }
      case 'push': {
        const t=(args[0]||''), tu=t.toUpperCase();
        if(tu==='A') sub=2; else if(tu==='B') sub=3; else if(tu==='C') sub=4; else if(tu==='FLAG') sub=5;
        else if(t.trim().startsWith('*[')){ sub=6; byte2=resolveAddr(t.slice(1), labels, lineNo); }
        else if(t.trim().startsWith('[')){ sub=1; byte2=resolveAddr(t,labels,lineNo); }
        else { const v=num(t, lineNo); if(isNaN(v)) throw new AsmError(`PUSH: bad operand "${t}"`, lineNo); sub=0; byte2=v; }
        break;
      }
      case 'pop': {
        const t=(args[0]||''), tu=t.toUpperCase();
        if(tu==='A') sub=1; else if(tu==='B') sub=2; else if(tu==='C') sub=3;
        else if(t.trim().startsWith('*[')){ sub=4; byte2=resolveAddr(t.slice(1), labels, lineNo); }
        else if(t.trim().startsWith('[')){ sub=0; byte2=resolveAddr(t,labels,lineNo); }
        else throw new AsmError(`POP expects A, B, C, [address], or *[address]`, lineNo);
        break;
      }
      case 'jump': {
        if(args.length<1) throw new AsmError(`${mnemonic} requires a target label/address`, lineNo);
        byte2 = resolveAddr(args[0], labels, lineNo);
        break;
      }
    }
    const byte1 = ((op.code & 0x1F) << 3) | (sub & 0x7);
    bytes[ins.address] = byte1;
    bytes[ins.address+1] = byte2 & 0xFF;
  }
  return {bytes, labels, programEnd: pc};
}

function resetRegs(){
  A=0;B=0;C=0;PC=0;SP=STACK_START;
  ALU_REGA=0;ALU_REGB=0;ALU_OUT=0;OUT_REG=0;
  ZF=0;CF=0; halted=false;
}

function writeMem(addr, val){
  mem[addr & 0xFF] = val & 0xFF;
}

function cpuStep(){
  if(halted) return false;
  if(PC < PROG_START || PC > PROG_END - 1 || PC >= programEnd){
    halted = true; log(`PC=0x${hex2(PC)} left the program region — halted.`, 'info'); return false;
  }
  const byte1 = mem[PC], byte2 = mem[PC+1];
  const opcode = (byte1 >>> 3) & 0x1F;
  const sub = byte1 & 0x7;
  let nextPC = PC + 2;

  switch(opcode){
    case 0: break;
    case 1: A = sub === 1 ? mem[mem[byte2]] : mem[byte2]; break;
    case 2: B = sub === 1 ? mem[mem[byte2]] : mem[byte2]; break;
    case 3: C = sub === 1 ? mem[mem[byte2]] : mem[byte2]; break;
    case 4: A = byte2; break;
    case 5: B = byte2; break;
    case 6: C = byte2; break;
    case 7: writeMem(sub === 1 ? mem[byte2] : byte2, A); break;
    case 8: writeMem(sub === 1 ? mem[byte2] : byte2, B); break;
    case 9: OUT_REG = (sub===0?A:sub===1?B:C) & 0xFF; break;
    case 10: {
      ALU_REGA = A;
      const operand = sub===0?B : sub===1?C : sub===2?mem[byte2] : sub===4?mem[mem[byte2]] : byte2;
      ALU_REGB = operand;
      const raw = A + operand;
      CF = raw > 255 ? 1 : 0;
      const res = raw & 0xFF;
      ALU_OUT = res; A = res; ZF = (A===0)?1:0;
      break;
    }
    case 11: {
      ALU_REGA = A;
      const operand = sub===0?B : sub===1?C : sub===2?mem[byte2] : sub===4?mem[mem[byte2]] : byte2;
      ALU_REGB = operand;
      CF = (A < operand) ? 1 : 0;
      const res = (A - operand) & 0xFF;
      ALU_OUT = res; A = res; ZF = (A===0)?1:0;
      break;
    }
    case 12: {
      ALU_REGA = B;
      const operand = sub===0?A : sub===1?C : sub===2?mem[byte2] : sub===4?mem[mem[byte2]] : byte2;
      ALU_REGB = operand;
      const res = (B ^ operand) & 0xFF;
      ALU_OUT = res; B = res; ZF = (B===0)?1:0;
      break;
    }
    case 13: {
      ALU_REGA = B;
      const operand = sub===0?A : sub===1?C : sub===2?mem[byte2] : sub===4?mem[mem[byte2]] : byte2;
      ALU_REGB = operand;
      const res = (B | operand) & 0xFF;
      ALU_OUT = res; B = res; ZF = (B===0)?1:0;
      break;
    }
    case 14: {
      ALU_REGA = B;
      const operand = sub===0?A : sub===1?C : sub===2?mem[byte2] : sub===4?mem[mem[byte2]] : byte2;
      ALU_REGB = operand;
      const res = (B & operand) & 0xFF;
      ALU_OUT = res; B = res; ZF = (B===0)?1:0;
      break;
    }
    case 15: {
      const amt = sub===0?byte2 : sub===1?mem[byte2] : mem[mem[byte2]];
      const res = amt>=8 ? 0 : (C >>> amt) & 0xFF;
      ALU_OUT = res; C = res; ZF=(C===0)?1:0;
      break;
    }
    case 16: {
      const amt = sub===0?byte2 : sub===1?mem[byte2] : mem[mem[byte2]];
      const signedC = C>127 ? C-256 : C;
      const res = amt>=8 ? (signedC<0?0xFF:0x00) : (signedC >> amt) & 0xFF;
      ALU_OUT = res; C = res; ZF=(C===0)?1:0;
      break;
    }
    case 17: {
      const amt = sub===0?byte2 : sub===1?mem[byte2] : mem[mem[byte2]];
      const res = amt>=8 ? 0 : (C << amt) & 0xFF;
      ALU_OUT = res; C = res; ZF=(C===0)?1:0;
      break;
    }
    case 18: { const t=A; A=B; B=t; break; }
    case 19: { const t=A; A=C; C=t; break; }
    case 20: { const t=B; B=C; C=t; break; }
    case 21: {
      if(sub===0){A=(A+1)&0xFF; ZF=(A===0)?1:0;}
      else if(sub===1){B=(B+1)&0xFF; ZF=(B===0)?1:0;}
      else if(sub===2){C=(C+1)&0xFF; ZF=(C===0)?1:0;}
      else if(sub===4){C=(C+byte2)&0xFF; ZF=(C===0)?1:0;}
      else if(sub===5){C=(C+mem[byte2])&0xFF; ZF=(C===0)?1:0;}
      else if(sub===6){C=(C+mem[mem[byte2]])&0xFF; ZF=(C===0)?1:0;}
      break;
    }
    case 22: {
      if(sub===0){A=(A-1)&0xFF; ZF=(A===0)?1:0;}
      else if(sub===1){B=(B-1)&0xFF; ZF=(B===0)?1:0;}
      else if(sub===2){C=(C-1)&0xFF; ZF=(C===0)?1:0;}
      else if(sub===4){C=(C-byte2)&0xFF; ZF=(C===0)?1:0;}
      else if(sub===5){C=(C-mem[byte2])&0xFF; ZF=(C===0)?1:0;}
      else if(sub===6){C=(C-mem[mem[byte2]])&0xFF; ZF=(C===0)?1:0;}
      break;
    }
    case 23: {
      let val;
      if(sub===0) val=byte2;
      else if(sub===1) val=mem[byte2];
      else if(sub===2) val=A;
      else if(sub===3) val=B;
      else if(sub===4) val=C;
      else if(sub===5) val=((ZF<<1)|CF)&0xFF;
      else if(sub===6) val=mem[mem[byte2]];
      
      if(SP > STACK_END){ log('stack overflow — PUSH ignored', 'err'); }
      else { mem[SP]=val&0xFF; SP++; }
      break;
    }
    case 24: {
      if(SP <= STACK_START){ log('stack underflow — POP ignored', 'err'); }
      else {
        SP--; const val=mem[SP];
        if(sub===0) writeMem(byte2,val);
        else if(sub===1) A=val;
        else if(sub===2) B=val;
        else if(sub===3) C=val;
        else if(sub===4) writeMem(mem[byte2], val);
      }
      break;
    }
    case 25: halted = true; log(`HLT at 0x${hex2(PC)}`, 'info'); break;
    case 29: {
      if(sub===0) nextPC=byte2;
      else if(sub===1){ if(ZF===1) nextPC=byte2; }
      else if(sub===2){ if(ZF===0) nextPC=byte2; }
      else if(sub===3){ if(CF===1) nextPC=byte2; }
      else if(sub===4){ if(CF===0) nextPC=byte2; }
      break;
    }
    case 30: {
      if (sub === 1) writeMem(mem[byte2], mem[PC+2]); 
      else writeMem(byte2, mem[PC+2]);                
      nextPC = PC + 3; 
      break;
    }
    default: break;
  }
  PC = nextPC & 0xFF;
  return true;
}