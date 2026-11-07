import express from "express";
import webpush from "web-push";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config();
const __dirname=path.dirname(fileURLToPath(import.meta.url)), app=express();
const PORT=process.env.PORT||3000, DATA=path.join(__dirname,"data"), DB=path.join(DATA,"state.json");
const INTERVAL=Math.max(60000,Number(process.env.CHECK_INTERVAL_MS||300000));
const SHOP_URL="https://itemshop.gg/api/v1/shop/fortnite", CATALOG_URL="https://fortnite-api.com/v2/cosmetics/br";
app.use(express.json({limit:"1mb"})); app.use(express.static(path.join(__dirname,"public")));
let state={subscriptions:{},previousShopKeys:[],previousShopDate:null}, catalogCache=new Map(), shopCache={at:0,data:null};
async function load(){await fs.mkdir(DATA,{recursive:true});try{state={...state,...JSON.parse(await fs.readFile(DB,"utf8"))}}catch{}}
async function save(){await fs.mkdir(DATA,{recursive:true});await fs.writeFile(DB,JSON.stringify(state,null,2))}
const norm=v=>String(v||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
async function shop(force=false){if(!force&&shopCache.data&&Date.now()-shopCache.at<60000)return shopCache.data;const r=await fetch(SHOP_URL);if(!r.ok)throw Error("Shop API "+r.status);shopCache={at:Date.now(),data:await r.json()};return shopCache.data}
async function catalog(lang="en"){lang=lang==="ar"?"ar":"en";const c=catalogCache.get(lang);if(c&&Date.now()-c.at<3600000)return c.data;const r=await fetch(CATALOG_URL+"?language="+lang);if(!r.ok)throw Error("Catalog API "+r.status);const data=await r.json();catalogCache.set(lang,{at:Date.now(),data});return data}
let pushReady=false;
if(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT){webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);pushReady=true}
app.get("/api/config",(_,res)=>res.json({pushEnabled:pushReady,vapidPublicKey:process.env.VAPID_PUBLIC_KEY||""}));
app.get("/api/shop",async(_,res)=>{try{const data=await shop();res.json({shop:data,attributionUrl:data?.meta?.attribution?.url||"https://itemshop.gg/fortnite",attributionText:"Data from itemshop.gg"})}catch{res.status(502).json({error:"تعذر تحميل المتجر حالياً."})}});
app.get("/api/catalog",async(req,res)=>{try{res.json(await catalog(req.query.language))}catch{res.status(502).json({error:"تعذر تحميل الكتالوج حالياً."})}});
app.post("/api/subscribe",async(req,res)=>{if(!pushReady)return res.status(503).json({error:"إشعارات الخلفية غير مفعّلة."});const {subscription,favorites=[],language="ar"}=req.body||{};if(!subscription?.endpoint||!subscription?.keys)return res.status(400).json({error:"اشتراك غير صالح."});state.subscriptions[subscription.endpoint]={subscription,favorites,language};await save();res.json({ok:true})});
app.post("/api/favorites",async(req,res)=>{const {endpoint,favorites=[],language="ar"}=req.body||{};if(!endpoint||!state.subscriptions[endpoint])return res.status(404).json({error:"الاشتراك غير موجود."});Object.assign(state.subscriptions[endpoint],{favorites,language});await save();res.json({ok:true})});
app.post("/api/unsubscribe",async(req,res)=>{const e=req.body?.endpoint;if(e&&state.subscriptions[e]){delete state.subscriptions[e];await save()}res.json({ok:true})});
async function monitor(){if(!pushReady)return;try{const data=await shop(true),items=(data?.data?.sections||[]).flatMap(s=>(s.items||[])),keys=items.map(x=>norm(x.id||x.itemKey||x.name)).filter(Boolean),date=data?.data?.shopDate||new Date().toISOString().slice(0,10);if(!state.previousShopDate){state.previousShopDate=date;state.previousShopKeys=keys;await save();return}if(date===state.previousShopDate&&JSON.stringify(keys)===JSON.stringify(state.previousShopKeys))return;const prev=new Set(state.previousShopKeys),fresh=items.filter(x=>!prev.has(norm(x.id||x.itemKey||x.name)));for(const [endpoint,record] of Object.entries(state.subscriptions)){const wanted=new Set((record.favorites||[]).map(x=>norm(x.id||x.name||x)));const matches=fresh.filter(x=>wanted.has(norm(x.id))||wanted.has(norm(x.itemKey))||wanted.has(norm(x.name)));if(!matches.length)continue;const names=matches.slice(0,4).map(x=>x.name).join(", "),ar=record.language==="ar";try{await webpush.sendNotification(record.subscription,JSON.stringify({title:ar?"عاد عنصر إلى متجر فورتنايت!":"A Fortnite item is back!",body:ar?"العنصر متوفر الآن: "+names:"Now in the shop: "+names,url:"/"}))}catch(e){if(e.statusCode===404||e.statusCode===410)delete state.subscriptions[endpoint]}}state.previousShopDate=date;state.previousShopKeys=keys;await save()}catch(e){console.error("Shop monitor:",e.message)}}
await load();if(pushReady){setTimeout(monitor,5000);setInterval(monitor,INTERVAL)}
app.get("*",(_,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("Fortnite Wishlist running on "+PORT));