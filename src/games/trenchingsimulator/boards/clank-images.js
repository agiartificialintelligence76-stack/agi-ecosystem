// One bounded loader per terminal. Images keep their stable proxy URL, so the browser and server
// can share successful responses; a transient gateway failure gets a few spaced retries.
export function createClankImageQueue({ concurrency = 6, timers = { set:(fn,ms)=>setTimeout(fn,ms), clear:(id)=>clearTimeout(id) },
  observe = typeof IntersectionObserver === 'function' ? IntersectionObserver : null } = {}) {
  const jobs=new Map(), waiting=[], scheduled=new Set();let running=0,dead=false;
  const observer=observe?new observe((entries)=>{
    for(const entry of entries){const job=jobs.get(entry.target);if(job&&entry.isIntersecting){observer.unobserve(job.img);job.visible=true;enqueue(job);}}
  },{rootMargin:'300px'}):null;
  const later=(fn,ms)=>{const id=timers.set(()=>{scheduled.delete(id);fn();},ms);scheduled.add(id);return id;};
  function enqueue(job){if(dead||job.done||job.queued)return;job.queued=true;waiting.push(job);pump();}
  function pump(){
    while(!dead&&running<concurrency&&waiting.length){
      const job=waiting.shift();job.queued=false;
      if(job.done||!job.img.isConnected){jobs.delete(job.img);continue;}
      running++;job.attempt++;job.active=true;
      let finished=false;
      const finish=(ok)=>{
        if(finished)return;finished=true;running--;job.active=false;
        timers.clear(job.timeout);scheduled.delete(job.timeout);
        job.img.removeEventListener('load',load);job.img.removeEventListener('error',error);
        if(ok){job.done=true;jobs.delete(job.img);job.onLoad?.();}
        else{
          job.onError?.();
          if(job.attempt<4&&!dead)later(()=>{if(job.img.isConnected)enqueue(job);else jobs.delete(job.img);},[2000,5000,15000][job.attempt-1]);
          else jobs.delete(job.img);
        }
        pump();
      };
      const load=()=>finish(true),error=()=>finish(false);
      job.abort=()=>finish(false);job.img.addEventListener('load',load);job.img.addEventListener('error',error);
      job.timeout=later(()=>{job.img.removeAttribute?.('src');finish(false);},28000);
      job.img.src=job.url;
    }
  }
  return {
    add(img,url,{onLoad,onError}={}){
      if(dead||!url||jobs.has(img))return;
      const job={img,url,onLoad,onError,attempt:0,queued:false,done:false};jobs.set(img,job);
      if(observer)observer.observe(img);else later(()=>enqueue(job),0);
    },
    destroy(){dead=true;observer?.disconnect();for(const id of scheduled)timers.clear(id);scheduled.clear();for(const job of jobs.values())if(job.active)job.abort?.();jobs.clear();waiting.length=0;},
    get state(){return {running,queued:waiting.length,tracked:jobs.size};},
  };
}
