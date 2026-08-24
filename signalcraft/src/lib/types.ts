export type Role = 'owner' | 'editor' | 'viewer';
export type IdeaStatus = '收集' | '验证' | '制作中' | '已发布' | '复盘';
export type VideoFormat = 'short' | 'long';
export interface User { id:string; name:string; email:string; role:Role; avatar?:string }
export interface Workspace { id:string; name:string; brandName:string; timezone:string }
export interface Channel { id:string; title:string; handle:string; url?:string; thumbnail?:string; subscribers:number; language:string; region:string; medianViews:number; health:number; tags:string[]; owner:string; lastSync:string }
export interface VideoSnapshot { capturedAt:string; views:number; likes:number; comments:number; subscribers?:number }
export interface Video { id:string; channelId:string; title:string; topic:string; language:string; region:string; format:VideoFormat; publishedAt:string; durationSeconds:number; thumbnail:string; sourceUrl?:string; risk:'low'|'medium'|'high'; snapshots:VideoSnapshot[]; tags:string[]; }
export interface Opportunity { videoId:string; opportunityScore:number; velocityScore:number; outlierScore:number; confidence:number; viewsPerHour:number; viewsPerSubscriber:number; growthRate:number; reasons:string[]; }
export interface WatchRule { id:string; name:string; type:'频道'|'关键词'|'赛道'|'对标组'; threshold:number; frequency:string; channel:string; paused:boolean }
export interface Alert { id:string; title:string; body:string; createdAt:string; read:boolean; sourceVideoId?:string }
export interface Collection { id:string; name:string; type:'对标组'|'收藏夹'; color:string; items:string[]; shared:boolean }
export interface Idea { id:string; title:string; sourceVideoId:string; angle:string; audience:string; hypothesis:string; owner:string; status:IdeaStatus; note:string; createdAt:string }
export interface Task { id:string; title:string; status:'待办'|'进行中'|'完成'; owner:string; due:string; source?:string }
export interface PromptTemplate { id:string; title:string; category:string; body:string; enabled:boolean; version:string }
export interface Tag { id:string; name:string; color:string }
export interface Comment { id:string; entityId:string; author:string; body:string; createdAt:string }
export interface ActivityEvent { id:string; type:string; actor:string; detail:string; createdAt:string }
export interface DataProvider { searchVideos(filters:Record<string,string>):Promise<Video[]>; getChannel(id:string):Promise<Channel | undefined>; refreshVideo(id:string):Promise<Video | undefined>; getSnapshots(videoId:string):Promise<VideoSnapshot[]>; createWatchRule(rule:Omit<WatchRule,'id'>):Promise<WatchRule>; }
