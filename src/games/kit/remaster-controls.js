import { el } from './shell.js';

const activationKeys = new Set(['Enter','Space']);
function setAttribute(node,name,value) {
  if (value == null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else if (node.getAttribute(name) !== String(value)) {
    node.setAttribute(name,String(value));
  }
}
function setLabel(node,value) {
  if (node.textContent !== value) node.textContent = value;
}

// Update the existing elements by action ID. A changing selected sleeve, meter,
// disabled action or caption should not drop keyboard focus or a captured finger.
export function createDock(send) {
  const node = el('section',{class:'rm-dock','aria-label':'Game controls'});
  const entries = new Map();
  let reconciling=false, pending=null;

  function end(entry, owner, stamp) {
    if (!entry.owners.delete(owner) || entry.owners.size) return;
    entry.input.classList.remove('is-held');
    send(entry.id,'up',undefined,stamp);
  }
  function clearEntry(entry,stamp) {
    if (!entry.owners.size) return;
    entry.owners.clear();
    entry.input.classList.remove('is-held');
    send(entry.id,'up',undefined,stamp);
  }
  function release(stamp=performance.now()) {
    for (const entry of entries.values()) clearEntry(entry,stamp);
  }
  function make(d) {
    const text=el('span');
    if (d.type==='range') {
      const input=el('input',{type:'range',name:d.id});
      input.addEventListener('input',e=>send(d.id,'input',input.valueAsNumber,e.timeStamp));
      return {id:d.id,type:'range',root:el('label','rm-fader',text,input),input,text,owners:new Set()};
    }
    const key=el('kbd');
    const input=el('button',{type:'button',class:'rm-pad','data-action':d.id},text,key);
    const entry={id:d.id,type:'button',root:input,input,text,key,owners:new Set()};
    function begin(owner,stamp) {
      if (input.disabled || entry.owners.has(owner)) return;
      entry.owners.add(owner);
      if (entry.owners.size===1) {
        input.classList.add('is-held');
        send(entry.id,'down',undefined,stamp);
      }
    }
    input.addEventListener('pointerdown',e=>{
      if (e.button!==0) return;
      input.setPointerCapture(e.pointerId);
      begin(e.pointerId,e.timeStamp);
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) {
      input.addEventListener(name,e=>{
        if (name!=='pointerup' && entry.owners.has(e.pointerId) && entry.owners.size===1) {
          send(entry.id,'cancel',undefined,e.timeStamp);
        }
        end(entry,e.pointerId,e.timeStamp);
      });
    }
    input.addEventListener('keydown',e=>{
      if (!activationKeys.has(e.code)) return;
      e.preventDefault();
      if (!e.repeat) begin(e.code,e.timeStamp);
    });
    input.addEventListener('keyup',e=>{
      if (activationKeys.has(e.code)) { e.preventDefault(); end(entry,e.code,e.timeStamp); }
    });
    input.addEventListener('blur',e=>{
      // Focusing another pad is normal with two fingers. A lost keyboard
      // focus ends its keypress; a captured pointer ends on up or cancel.
      for (const key of activationKeys) end(entry,key,e.timeStamp);
    });
    input.addEventListener('click',e=>{
      if (e.detail===0 && !e.pointerType) {
        begin('assistive-click',e.timeStamp);
        end(entry,'assistive-click',e.timeStamp);
      }
    });
    return entry;
  }
  function update(entry,d) {
    const input=entry.input;
    setLabel(entry.text,d.label);
    if (input.disabled!==Boolean(d.disabled)) {
      if (d.disabled) clearEntry(entry,performance.now());
      input.disabled=Boolean(d.disabled);
    }
    if (entry.type==='range') {
      setAttribute(input,'min',d.min); setAttribute(input,'max',d.max);
      setAttribute(input,'step',d.step??1);
      if (d.value!=null && input.valueAsNumber!==Number(d.value)) input.value=d.value;
    } else {
      setAttribute(input,'aria-pressed',d.pressed==null?null:Boolean(d.pressed));
      setLabel(entry.key,d.key||''); entry.key.hidden=!d.key;
    }
  }
  function reconcile(list) {
    const focused=document.activeElement;
    const oldIndex=[...node.children].findIndex(child=>child.contains(focused));
    const next=new Set(list.map(d=>d.id));
    for (const [id,entry] of entries) {
      if (!next.has(id)) { entries.delete(id); clearEntry(entry,performance.now()); entry.root.remove(); }
    }
    for (const [index,d] of list.entries()) {
      const type=d.type==='range'?'range':'button';
      let entry=entries.get(d.id);
      if (entry && entry.type!==type) {
        entries.delete(d.id); clearEntry(entry,performance.now()); entry.root.remove(); entry=null;
      }
      if (!entry) { entry=make(d); entries.set(d.id,entry); }
      update(entry,d);
      const before=node.children[index]||null;
      if (before!==entry.root) {
        if (node.moveBefore && entry.root.parentElement===node) node.moveBefore(entry.root,before);
        else node.insertBefore(entry.root,before);
      }
    }
    const stillEnabled=node.contains(focused)&&!focused.disabled;
    const active=document.activeElement;
    if (oldIndex>=0 && (!stillEnabled||active!==focused) && (active===focused||!node.contains(active))) {
      const enabled=list.map(d=>entries.get(d.id)?.input).filter(input=>input&&!input.disabled);
      const target=stillEnabled ? focused : enabled[Math.min(oldIndex,enabled.length-1)];
      (target || node.parentElement?.querySelector('canvas'))?.focus({preventScroll:true});
    }
  }
  function render(list=[]) {
    // Disabling a held action emits its release. If that release updates the
    // game again, reconcile the newest descriptors after the current pass.
    if (reconciling) { pending=list; return; }
    reconciling=true;
    try {
      let next=list;
      do { pending=null; reconcile(next); next=pending; } while (next);
    } finally { reconciling=false; }
  }
  return {node,render,release};
}
export function makeChoices(fields, selected) {
  const form = el('div', 'rm-choices');
  for (const field of fields) {
    if (!field.values?.length) continue;
    const select = el('select', { name: field.id },
      field.values.map(v => el('option', { value: v.id }, v.label)));
    select.value = selected[field.id] ?? field.values[0].id;
    selected[field.id] = select.value;
    select.addEventListener('change', () => { selected[field.id] = select.value; });
    form.append(el('label', null, el('span', null, field.label), select));
  }
  return form;
}
