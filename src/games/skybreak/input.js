// Keyboard, mouse, touch and gamepad, turned into one set of controls for the physics.
// Touch (2026-11-08): the stick appears wherever your left thumb lands on the left of the screen and goes home when you
// let go; pushed to its edge it sprints. JUMP, SWING (lit when a diamond is in reach), ROLL and RECOVER (held a moment)
// sit in a thumb arc on the right; dragging anywhere else looks around, and the camera can turn with you as you run (Settings).
const STICK_EDGE = .92;           // pushed this far (of its reach), the stick sprints
const FOLLOW_RATE = 1;            // radians a second the camera turns with you, stick fully sideways
const RECOVER_HOLD = 450;         // milliseconds RECOVER is held before it takes you back
export class Input {
  constructor(canvas,onPause,onRecover){
    this.canvas=canvas;this.keys=new Set();this.yaw=0;this.pitch=.34;this.distance=7.6;this.jumpPressed=false;this.grapplePressed=false;this.grappleReleased=false;this.lastJumpHeld=false;this.lastGrappleHeld=false;this.active=false;this.drag=false;this.touch={x:0,z:0};
    this.lookScale=1;this.follow=true;this.stickId=null;this.touchSprint=false;this.touchRoll=false;
    window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&this.active)e.preventDefault();if(!e.repeat){if(e.code==='Escape')onPause();if(e.code==='KeyR'&&this.active)onRecover();if(e.code==='Space')this.jumpPressed=true;if(e.code==='KeyE')this.grapplePressed=true;}this.keys.add(e.code);});
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(e.code==='KeyE')this.grappleReleased=true;});
    window.addEventListener('blur',()=>{this.clear();if(this.active)onPause(true);});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{if(!this.active)return;this.drag=true;this.dragId=e.pointerId;this.lastX=e.clientX;this.lastY=e.clientY;if(e.pointerType==='mouse'&&e.button===0)canvas.requestPointerLock?.()?.catch?.(()=>{});canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!this.active)return;if(this.drag&&e.pointerId!==this.dragId&&document.pointerLockElement!==canvas)return;if(document.pointerLockElement===canvas){this.yaw-=e.movementX*.003*this.lookScale;this.pitch=Math.max(-.15,Math.min(1.15,this.pitch+e.movementY*.003*this.lookScale));}else if(this.drag){const s=(e.pointerType==='mouse'?.005:.0058)*this.lookScale;this.yaw-=(e.clientX-this.lastX)*s;this.pitch=Math.max(-.15,Math.min(1.15,this.pitch+(e.clientY-this.lastY)*s));}this.lastX=e.clientX;this.lastY=e.clientY;});
    // Only the finger that started the look ends it: letting go of the stick or a button keeps the camera drag going.
    for(const name of ['pointerup','pointercancel'])window.addEventListener(name,e=>{if(e.pointerId===this.dragId||e.pointerType==='mouse')this.drag=false;});canvas.addEventListener('wheel',e=>{if(this.active){e.preventDefault();this.distance=Math.max(4,Math.min(12,this.distance+e.deltaY*.006));}},{passive:false});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.active){this.clear();onPause(true);}});
    let hadPointerLock=false;
    document.addEventListener('pointerlockchange',()=>{
      const locked=document.pointerLockElement===canvas;
      const lost=hadPointerLock&&!locked;
      hadPointerLock=locked;
      if(lost&&this.active){this.clear();onPause(true);}
    });
    // Safari's own pinch and double-tap zoom stay out of the game (its controls and canvas say touch-action: none too)
    for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,e=>e.preventDefault(),{passive:false});
    const controls=document.getElementById('touch-controls');controls?.addEventListener('contextmenu',e=>e.preventDefault());

    // The floating stick: it appears where the thumb lands in the zone, follows nothing else, goes home on release
    const zone=document.getElementById('touch-zone'),stick=document.querySelector('#touch-stick'),knob=stick.querySelector('i');
    let cx=0,cy=0;
    const reach=()=>stick.offsetWidth*.34||44;
    const place=e=>{
      const r=stick.offsetWidth/2||64,pad=8;
      cx=Math.max(r+pad,Math.min(innerWidth*.6-r,e.clientX));cy=Math.max(r+pad,Math.min(innerHeight-r-pad,e.clientY));
      stick.classList.add('float','live');stick.style.left=`${cx-r}px`;stick.style.top=`${cy-r}px`;
    };
    const move=e=>{
      const R=reach();let x=(e.clientX-cx)/R,z=-(e.clientY-cy)/R;const len=Math.hypot(x,z);
      if(len>1){x/=len;z/=len;}
      this.touch={x,z};this.touchSprint=len>=STICK_EDGE;
      stick.classList.toggle('sprint',this.touchSprint);
      knob.style.transform=`translate(${x*R}px,${-z*R}px)`;
    };
    const release=()=>{this.stickId=null;this.touch={x:0,z:0};this.touchSprint=false;if(knob?.style)knob.style.transform='';stick.classList?.remove('float','live','sprint');if(stick.style){stick.style.left='';stick.style.top='';}};
    this.releaseStick=release;
    zone?.addEventListener('pointerdown',e=>{if(this.stickId!==null&&this.stickId!==e.pointerId)return;e.preventDefault();this.stickId=e.pointerId;zone.setPointerCapture?.(e.pointerId);place(e);move(e);});
    zone?.addEventListener('pointermove',e=>{if(e.pointerId===this.stickId)move(e);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])zone?.addEventListener(name,e=>{if(e.pointerId===this.stickId)release();});

    // JUMP and SWING hold like Space and E; ROLL holds like Q (roll as you land)
    const hold=(id,on,off)=>{const b=document.getElementById(id);if(!b)return;
      b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);b.classList.add('down');on();});
      for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>{if(!b.classList.contains('down'))return;b.classList.remove('down');off();});};
    hold('touch-jump',()=>{this.keys.add('Space');this.jumpPressed=true;},()=>this.keys.delete('Space'));
    hold('touch-grapple',()=>{this.keys.add('KeyE');this.grapplePressed=true;},()=>{this.keys.delete('KeyE');this.grappleReleased=true;});
    hold('touch-roll',()=>{this.touchRoll=true;},()=>{this.touchRoll=false;});
    // RECOVER: held for a moment (its ring fills) so a stray thumb never throws a climb away
    let arm=0;const rec=document.getElementById('touch-recover');
    hold('touch-recover',()=>{rec.classList.add('arming');arm=setTimeout(()=>{arm=0;rec.classList.remove('arming');if(this.active)onRecover();},RECOVER_HOLD);},()=>{clearTimeout(arm);arm=0;rec.classList.remove('arming');});
  }
  clear(){this.keys.clear();this.jumpPressed=false;this.grapplePressed=false;this.grappleReleased=true;this.drag=false;this.touchRoll=false;this.releaseStick?.();for(const b of document.querySelectorAll?.('#touch-controls .down')||[])b.classList.remove('down');}
  sample(anchor,dt=0){
    let lx=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.touch.x;
    let lz=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)+this.touch.z;
    const pad=Array.from(navigator.getGamepads?.()||[]).find(gamepad=>gamepad&&gamepad.connected!==false);
    if(pad){
      lx+=Math.abs(pad.axes[0])>.15?pad.axes[0]:0;
      lz-=Math.abs(pad.axes[1])>.15?pad.axes[1]:0;
      this.yaw-=(Math.abs(pad.axes[2])>.15?pad.axes[2]:0)*.035*this.lookScale;
      this.pitch=Math.max(-.15,Math.min(1.15,this.pitch+(Math.abs(pad.axes[3])>.15?pad.axes[3]:0)*.025*this.lookScale));
    }
    // Camera follow (touch): running sideways turns the camera with you, gently (more the further the stick leans), never
    // while you're looking around yourself and never when you back up
    if(this.follow&&this.stickId!==null&&!this.drag&&dt>0&&this.touch.z>-.35){const side=this.touch.x;this.yaw-=side*Math.abs(side)*FOLLOW_RATE*this.lookScale*dt;}
    let x=Math.cos(this.yaw)*lx-Math.sin(this.yaw)*lz,z=-Math.sin(this.yaw)*lx-Math.cos(this.yaw)*lz;
    const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
    const jump=this.keys.has('Space')||!!pad?.buttons[0]?.pressed;
    const grapple=this.keys.has('KeyE')||!!pad?.buttons[5]?.pressed;
    // The physics controller consumes edges, not just held buttons. Aggregate
    // the devices so releasing a keyboard key cannot detach a held gamepad rope.
    const input={x,z,jump,
      jumpPressed:this.jumpPressed||jump&&!this.lastJumpHeld,
      roll:this.keys.has('KeyQ')||this.touchRoll||!!pad?.buttons[1]?.pressed,
      sprint:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||this.touchSprint||!!pad?.buttons[4]?.pressed,
      grapple,
      grapplePressed:grapple&&!this.lastGrappleHeld||this.grapplePressed&&(!this.lastGrappleHeld||this.grappleReleased),
      grappleReleased:!grapple&&(this.grappleReleased||this.lastGrappleHeld),
      anchor};
    this.lastJumpHeld=jump;this.lastGrappleHeld=grapple;
    this.jumpPressed=false;this.grapplePressed=false;this.grappleReleased=false;
    return input;
  }
}
