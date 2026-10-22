module.exports=async function researchSmoke(){
 const $=id=>document.getElementById(id);
 if(!$('search-form')?.onsubmit)throw Error('Research module failed to initialize');
 const actualFetch=window.fetch;
 window.fetch=async(url)=>{if(!String(url).startsWith('/gateway/youtube-signals?'))throw Error('Unexpected request in research test');return new Response(JSON.stringify({longOpportunities:[{videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',title:'实测公开视频',channelId:'test-channel',channelTitle:'实测频道',views:1000,ageDays:2,subscribers:null,latestCapturedAt:'2026-10-22T12:00:00Z',baselineViews:700,baselineCapturedAt:'2026-10-21T12:00:00Z'}]}),{status:200,headers:{'content-type':'application/json'}})};
 try{
 $('search-form').requestSubmit();
 for(let i=0;i<100&&$('submit').disabled;i++)await new Promise(r=>setTimeout(r,20));
 if($('submit').disabled||document.querySelectorAll('#results tr').length!==1)throw Error('Research query failed');
 const actions=[...document.querySelectorAll('#results button')];
 actions.find(b=>b.textContent==='保存为选题').click();actions.find(b=>b.textContent==='保存为选题').click();
 if(JSON.parse(localStorage.getItem('creator-library')).items.filter(x=>x.id==='youtube-abcdefghijk').length!==1)throw Error('Research to idea linkage failed');
 actions.find(b=>b.textContent==='收藏对标频道').click();
 const d=JSON.parse(localStorage.getItem('creator-research'));
 if(d.channels.length!==1||!$('comparison').textContent.includes('实测频道'))throw Error('Competitor comparison failed');
 const backup=Workbench.backup();localStorage.removeItem('creator-research');Workbench.restore(backup);
 if(JSON.parse(localStorage.getItem('creator-research')).results.length!==1)throw Error('Research backup failed');
 window.fetch=async()=>new Response(JSON.stringify({error:'test quota exhausted'}),{status:429});
 $('search-form').requestSubmit();for(let i=0;i<100&&$('submit').disabled;i++)await new Promise(r=>setTimeout(r,20));
 if(!$('message').textContent.includes('test quota exhausted')||JSON.parse(localStorage.getItem('creator-research')).results.length!==1)throw Error('Failed queries overwrite existing evidence');
 return true;
 }finally{window.fetch=actualFetch}
};
