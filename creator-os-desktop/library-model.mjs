export const kinds=['ideas','characters','skills'];
export const statuses=['待评估','已采用','已归档'];
export function validateLibrary(value){
 if(!value||value.version!==1||!Array.isArray(value.items)||value.items.length>2000)throw Error('资源库格式不正确，最多 2000 条');
 const ids=new Set();for(const x of value.items){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!kinds.includes(x.kind)||typeof x.name!=='string'||!x.name.trim()||x.name.length>200||typeof x.content!=='string'||x.content.length>30000||typeof x.tags!=='string'||x.tags.length>500||!statuses.includes(x.status))throw Error('资源条目不正确');ids.add(x.id)}
 return {version:1,items:value.items.map(x=>({id:x.id,kind:x.kind,name:x.name.trim(),content:x.content,tags:x.tags,status:x.status}))};
}
export function mergeLibrary(current,incoming){const a=validateLibrary(current),b=validateLibrary(incoming);const map=new Map(a.items.map(x=>[x.id,x]));for(const x of b.items){if(map.has(x.id)&&JSON.stringify(map.get(x.id))!==JSON.stringify(x))throw Error('同一条目存在不同版本，请先导出备份后手动处理');map.set(x.id,x)}return validateLibrary({version:1,items:[...map.values()]})}
export function promptFor(items){return items.map(x=>({ideas:'选题',characters:'角色设定',skills:'创作要求'}[x.kind])+'：'+x.name+'\n'+x.content).join('\n\n')}
