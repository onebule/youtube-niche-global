module.exports = async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return response.status(503).json({ error: '服务端尚未配置 YouTube API Key。' });
  const { query = '', language = 'en', region = 'US' } = request.query;
  if (!String(query).trim()) return response.status(400).json({ error: '缺少赛道关键词。' });
  const search = new URLSearchParams({ part: 'snippet', q: String(query), type: 'video', order: 'date', maxResults: '50', relevanceLanguage: String(language).slice(0, 12), regionCode: String(region).slice(0, 2).toUpperCase(), key: apiKey });
  try {
    const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${search}`);
    const searchData = await searchResponse.json();
    if (!searchResponse.ok) return response.status(searchResponse.status).json({ error: searchData.error?.message || 'YouTube 搜索失败。' });
    const ids = searchData.items.map(item => item.id?.videoId).filter(Boolean);
    if (!ids.length) return response.status(404).json({ error: '没有找到可分析的公开视频。' });
    const videos = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: ids.join(','), key: apiKey });
    const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videos}`);
    const videoData = await videoResponse.json();
    if (!videoResponse.ok) return response.status(videoResponse.status).json({ error: videoData.error?.message || '读取视频数据失败。' });
    const channelIds = [...new Set(videoData.items.map(video => video.snippet.channelId))];
    const channelParams = new URLSearchParams({ part: 'statistics', id: channelIds.join(','), key: apiKey });
    const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`);
    const channelData = await channelResponse.json();
    const subscriberMap = new Map((channelData.items || []).map(channel => [channel.id, Number(channel.statistics?.subscriberCount || 0)]));
    const parseSeconds = value => { const match = String(value || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0; };
    const now = Date.now(), views = [], ages = [], channels = new Set(); let recent = 0;
    const opportunities = videoData.items.map(video => { const ageDays = Math.max(1, Math.floor((now - new Date(video.snippet.publishedAt).getTime()) / 86400000)); const viewCount = Number(video.statistics?.viewCount || 0); const subscribers = subscriberMap.get(video.snippet.channelId) || 0; const isShort = parseSeconds(video.contentDetails?.duration) <= 180; const breakoutRatio = subscribers ? viewCount / subscribers : 0; return { title: video.snippet.title, channelTitle: video.snippet.channelTitle, videoUrl: `https://www.youtube.com/watch?v=${video.id}`, thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || '', views: viewCount, subscribers, ageDays, format: isShort ? 'short' : 'long', breakoutRatio: Number(breakoutRatio.toFixed(2)) }; }).sort((a, b) => (b.breakoutRatio / Math.sqrt(b.ageDays)) - (a.breakoutRatio / Math.sqrt(a.ageDays)));
    opportunities.forEach(item => { views.push(item.views); ages.push(item.ageDays); channels.add(item.channelTitle); if (item.ageDays <= 90) recent += 1; });
    if (!views.length) return response.status(404).json({ error: '这个内容形式下没有足够的公开视频样本。' });
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] || 0;
    return response.status(200).json({ videoCount: views.length, medianViews: median(views), medianAgeDays: median(ages), recentShare: Number((recent / views.length).toFixed(2)), channelConcentration: Number((1 - channels.size / views.length).toFixed(2)), longOpportunities: opportunities.filter(item => item.format === 'long').slice(0, 10), shortOpportunities: opportunities.filter(item => item.format === 'short').slice(0, 10) });
  } catch { return response.status(502).json({ error: '无法连接到 YouTube API。' }); }
};
