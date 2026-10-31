export class Input {
  constructor(canvas,onPause,onRecover){
    this.canvas=canvas;this.keys=new Set();this.yaw=0;this.pitch=.34;this.distance=7.6;this.jumpPressed=false;this.grapplePressed=false;this.grappleReleased=false;this.lastJumpHeld=false;this.lastGrappleHeld=false;this.active=false;this.drag=false;this.touch={x:0,z:0};
    window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!e.repeat){if(e.code==='Escape')onPause();if(e.code==='KeyR'&&this.active)onRecover();if(e.code==='Space')this.jumpPressed=true;if(e.code==='KeyE')this.grapplePressed=true;}this.keys.add(e.code);});
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(e.code==='KeyE')this.grappleReleased=true;});
    window.addEventListener('blur',()=>{this.clear();if(this.active)onPause(true);});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{if(!this.active)return;this.drag=true;this.dragId=e.pointerId;this.lastX=e.clientX;this.lastY=e.clientY;if(e.pointerType==='mouse'&&e.button===0)canvas.requestPointerLock?.()?.catch?.(()=>{});canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!this.active)return;if(this.drag&&e.pointerId!==this.dragId&&document.pointerLockElement!==canvas)return;if(document.pointerLockElement===canvas){this.yaw-=e.movementX*.003;this.pitch=Math.max(-.15,Math.min(1.15,this.pitch+e.movementY*.003));}else if(this.drag){this.yaw-=(e.clientX-this.lastX)*.005;this.pitch=Math.max(-.15,Math.min(1.15,this.pitch+(e.clientY-this.lastY)*.005));}this.lastX=e.clientX;this.lastY=e.clientY;});
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
    const stick=document.querySelector('#touch-stick'),knob=stick.querySelector('i');
    const move=e=>{const r=stick.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/40,z=-(e.clientY-r.top-r.height/2)/40;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}this.touch={x,z};knob.style.transform=`translate(${x*30}px,${-z*30}px)`;};
    stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);move(e);});stick.addEventListener('pointermove',e=>{if(e.buttons)move(e);});for(const name of ['pointerup','pointercancel'])stick.addEventListener(name,()=>{this.touch={x:0,z:0};knob.style.transform='';});
    for(const [id,key]of [['touch-jump','Space'],['touch-grapple','KeyE']]){const b=document.getElementById(id);b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);this.keys.add(key);if(key==='Space')this.jumpPressed=true;else this.grapplePressed=true;});for(const event of ['pointerup','pointercancel'])b.addEventListener(event,()=>{this.keys.delete(key);if(key==='KeyE')this.grappleReleased=true;});}
    document.getElementById('touch-recover')?.addEventListener('pointerdown',e=>{e.preventDefault();if(this.active)onRecover();});
  }
  clear(){this.keys.clear();this.jumpPressed=false;this.grapplePressed=false;this.grappleReleased=true;this.drag=false;this.touch={x:0,z:0};}
  sample(anchor){
    let lx=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.touch.x;
    let lz=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)+this.touch.z;
    const pad=Array.from(navigator.getGamepads?.()||[]).find(gamepad=>gamepad&&gamepad.connected!==false);
    if(pad){
      lx+=Math.abs(pad.axes[0])>.15?pad.axes[0]:0;
      lz-=Math.abs(pad.axes[1])>.15?pad.axes[1]:0;
      this.yaw-=(Math.abs(pad.axes[2])>.15?pad.axes[2]:0)*.035;
      this.pitch=Math.max(-.15,Math.min(1.15,this.pitch+(Math.abs(pad.axes[3])>.15?pad.axes[3]:0)*.025));
    }
    let x=Math.cos(this.yaw)*lx-Math.sin(this.yaw)*lz,z=-Math.sin(this.yaw)*lx-Math.cos(this.yaw)*lz;
    const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
    const jump=this.keys.has('Space')||!!pad?.buttons[0]?.pressed;
    const grapple=this.keys.has('KeyE')||!!pad?.buttons[5]?.pressed;
    // The physics controller consumes edges, not just held buttons. Aggregate
    // the devices so releasing a keyboard key cannot detach a held gamepad rope.
    const input={x,z,jump,
      jumpPressed:this.jumpPressed||jump&&!this.lastJumpHeld,
      roll:this.keys.has('KeyQ')||!!pad?.buttons[1]?.pressed,
      sprint:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||!!pad?.buttons[4]?.pressed,
      grapple,
      grapplePressed:grapple&&!this.lastGrappleHeld||this.grapplePressed&&(!this.lastGrappleHeld||this.grappleReleased),
      grappleReleased:!grapple&&(this.grappleReleased||this.lastGrappleHeld),
      anchor};
    this.lastJumpHeld=jump;this.lastGrappleHeld=grapple;
    this.jumpPressed=false;this.grapplePressed=false;this.grappleReleased=false;
    return input;
  }
}
