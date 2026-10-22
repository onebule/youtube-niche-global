module.exports=async function librarySmoke(){
 const $=id=>document.getElementById(id);
 if(!$('editor')?.onsubmit)throw Error('Library module failed to initialize');
 const save=(name,content)=>{$('name').value=name;$('content').value=content;$('editor').requestSubmit()};
 save('桌面冒烟选题','内容');
 let library=JSON.parse(localStorage.getItem('creator-library'));
 if(library.items.length!==1)throw Error('Idea save failed');
 const taskButton=[...document.querySelectorAll('#list button')].find(b=>b.textContent==='创建制作任务');taskButton.click();taskButton.click();
 if(JSON.parse(localStorage.getItem('creator-tasks')).length!==1)throw Error('Task linkage duplicates');
 location.hash='characters';await new Promise(r=>setTimeout(r,30));save('主角','蓝色外套');
 location.hash='skills';await new Promise(r=>setTimeout(r,30));save('结构','开头提出问题');
 library=JSON.parse(localStorage.getItem('creator-library'));
 if(library.items.length!==3)throw Error('Library tab separation failed');
 $('search').value='不存在';$('search').dispatchEvent(new Event('input'));
 if(document.querySelectorAll('#list article').length!==0)throw Error('Library search failed');
 const backup=Workbench.backup();localStorage.removeItem('creator-library');Workbench.restore(backup);
 if(JSON.parse(localStorage.getItem('creator-library')).items.length!==3)throw Error('Library backup restore failed');
 return true;
};
