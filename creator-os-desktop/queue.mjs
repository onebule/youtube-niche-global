// Sequential, restart-safe queue. A submission with an unknown outcome never
// retries automatically; provider-side work may already have started.
export const terminal = new Set(['completed','failed','cancelled']);
export class GenerationQueue {
 constructor({load,save,submit,refresh,onChange=()=>{}}){this.load=load;this.save=save;this.submit=submit;this.refresh=refresh;this.onChange=onChange;this.running=false;this.lock=false;this.items=load();for(const x of this.items)if(x.status==='submitting')x.status='unknown';}
 commit(){try{this.save(this.items)}catch(e){this.running=false;throw Error('队列未能保存，请释放浏览器存储空间后重试。',{cause:e})}this.onChange(this.items)}
 add(items){for(const item of items)this.items.push({...item,queueId:crypto.randomUUID(),status:'waiting',attempt:0});this.commit()}
 start(){this.running=true;return this.tick()}
 pause(){this.running=false;this.onChange(this.items)}
 async tick(){if(!this.running||this.lock)return;this.lock=true;try{
  const unknown=this.items.find(x=>x.status==='unknown');if(unknown){this.running=false;return}
  const active=this.items.find(x=>['submitting','queued','processing'].includes(x.status));
  if(active){if(active.remoteId){try{const result=await this.refresh(active);Object.assign(active,result);if(active.status==='failed')this.running=false;this.commit()}catch(e){active.lastError=e.message;this.commit()}}return}
  const next=this.items.find(x=>x.status==='waiting');if(!next){this.running=false;return}
  next.status='submitting';next.attempt++;next.requestId=crypto.randomUUID();next.startedAt=Date.now();this.commit();
  try{const result=await this.submit(next);if(!result.remoteId)throw Error('响应缺少任务编号，提交结果待确认。');Object.assign(next,result);this.commit()}catch(e){next.status=e.definite?'failed':'unknown';next.lastError=e.message;this.running=false;this.commit()}
 }finally{this.lock=false;this.onChange(this.items)}}
 retry(id){const x=this.items.find(x=>x.queueId===id);if(!x||x.status!=='failed')throw Error('只能重试已确认失败的任务。');x.status='waiting';x.remoteId=null;x.lastError=null;this.commit()}
 remove(id){const x=this.items.find(x=>x.queueId===id);if(!x||!['waiting','failed','completed','cancelled'].includes(x.status))throw Error('运行中或结果未确认的任务不能移除。');this.items=this.items.filter(x=>x.queueId!==id);this.commit()}
}
