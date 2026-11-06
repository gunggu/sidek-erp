/**
 * SIDEK ERP aggregation-only update API for Cloudflare Workers.
 * Required: KV namespace DATA_CACHE, secrets:
 * GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, ADMIN_UPDATE_TOKEN
 * All 8 spreadsheets must grant Viewer to GOOGLE_SERVICE_ACCOUNT_EMAIL.
 * NO raw rows are returned to the browser or stored in KV.
 */
const SHEETS = [
  {key:"s0",group:"SMK",wave:"T0",id:"16DPDPQJ4c_iBQPW_UfIUTnMPP9wzWuSrQP2SfjTM1z4"},
  {key:"s1",group:"SMK",wave:"T1",id:"1fLMNuthylEPTPuq8xiwYYHmSbnOUxSsGFv52ajqxG7s"},
  {key:"s23",group:"SMK",wave:"T2–T3",id:"1vMHANn2Lue9dpooALPp12cYafqcab6FQmVyqwD94B4A"},
  {key:"s4",group:"SMK",wave:"T4",id:"1H8dTdYghX2lQyyWd1Kwh8qJxentWuBUFk4ynGB1N9RA"},
  {key:"u0",group:"UMKM",wave:"T0",id:"1oHXmVD5EueQjVUOMQ6Iw2vOyQ_dY1DzdMqeqTY6YFZQ"},
  {key:"u1",group:"UMKM",wave:"T1",id:"16buw2e2YonWgS06TO0g8GqpDgXvfU7anSPS45nV0zQg"},
  {key:"u23",group:"UMKM",wave:"T2–T3",id:"1UFbSo0lE4-bLGHIX-1MGRGNeHNF7MKwOJYs7zcCNyQw"},
  {key:"u4",group:"UMKM",wave:"T4",id:"126yevZ97QuW4RKJMGXyz9n6yTW44sA6QhrvgEOZeRlo"}
];
const REGIONS=["Yogyakarta","Surabaya","Lampung"];
function normalize(s){return String(s??"").normalize("NFKC").toLocaleLowerCase("id").replace(/[.,]/g,"").trim().replace(/\s+/g," ")}
function region(s){
 const t=normalize(s);
 if(t.includes("yogyakarta")||t.includes("sleman")||t.includes("godean"))return "Yogyakarta";
 if(t.includes("lampung")||t.includes("seputih"))return "Lampung";
 if(t.includes("surabaya"))return "Surabaya";
 return "Tidak terklasifikasi";
}
function safeInstitution(name){
 // Only recognized institution names may be published. Never publish arbitrary free-text.
 const s=normalize(name);
 if(s.includes("godean"))return "SMKN 1 Godean";
 if(s.includes("ypkk"))return "SMK YPKK 2 Sleman";
 if(s.includes("soetomo"))return "SMK Dr. Soetomo";
 if(s.includes("seputih"))return "SMKN 1 Seputih Surabaya";
 return null;
}
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
function fromPEM(pem){const cleaned=pem.replace(/\\n/g,"\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");const decoded=atob(cleaned);return Uint8Array.from(decoded,c=>c.charCodeAt(0));}
async function getToken(env){
 const now=Math.floor(Date.now()/1000);
 const header=encode(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const claims=encode(new TextEncoder().encode(JSON.stringify({
  iss:env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  scope:"https://www.googleapis.com/auth/spreadsheets.readonly",
  aud:"https://oauth2.googleapis.com/token",
  iat:now,exp:now+3000
 })));
 const key=await crypto.subtle.importKey("pkcs8",fromPEM(env.GOOGLE_PRIVATE_KEY),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const input=header+"."+claims;
 const sig=encode(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(input))));
 const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:input+"."+sig})});
 if(!res.ok)throw Error("Google OAuth gagal (HTTP "+res.status+"). Cek email/key service account.");
 const data=await res.json();if(!data.access_token)throw Error("Google tidak memberikan access token.");
 return data.access_token;
}
async function readSheet(s,token){
 const range="'Form Responses 1'!A:J";
 const url="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(s.id)+"/values/"+encodeURIComponent(range)+"?valueRenderOption=FORMATTED_VALUE";
 const res=await fetch(url,{headers:{Authorization:"Bearer "+token}});
 if(!res.ok)throw Error("Gagal membaca "+s.key+" (HTTP "+res.status+"). Pastikan service account diberi akses.");
 const d=await res.json();return d.values||[];
}
function aggregate(reads){
 const schools=new Map(), schoolRegions=new Map();
 const businessPerWave={u0:new Set(),u1:new Set(),u23:new Set(),u4:new Set()};
 const businessByRegion={};for(const r of REGIONS)businessByRegion[r]={u0:new Set(),u1:new Set(),u23:new Set(),u4:new Set()};
 const records=[];
 for(const {def,values} of reads){
  const header=values[0]||[];
  const schoolIndex=header.findIndex(x=>normalize(x).includes("instansi peserta"));
  const businessIndex=header.findIndex(x=>normalize(x).includes("nama usaha"));
  const locationIndex=header.findIndex(x=>normalize(x).includes("lokasi")&&normalize(x).includes("pelatihan"));
  const schoolRows={};const acceptedRows=(values.slice(1)).filter(row=>String(row[0]??"").trim()!=="");
  for(const row of acceptedRows){
   if(def.group==="SMK"){
    const school=safeInstitution(row[schoolIndex]);if(!school)continue;
    const count=schools.get(school)||{T0:0,T1:0,"T2–T3":0,T4:0};count[def.wave]++;schools.set(school,count);
    if(!schoolRegions.has(school)){schoolRegions.set(school,region(row[schoolIndex]))}
   }else{
    const bn=normalize(row[businessIndex]);if(!bn)continue;
    businessPerWave[def.key].add(bn);
    const r=region(row[locationIndex]);if(businessByRegion[r])businessByRegion[r][def.key].add(bn);
   }
  }
  records.push({group:def.group,wave:def.wave,key:def.key,now:acceptedRows.length});
 }
 const schoolUnits=[...schools.entries()].sort(([a],[b])=>a.localeCompare(b,"id")).map(([name,counts])=>({name,region:schoolRegions.get(name),counts:[counts.T0,counts.T1,counts["T2–T3"],counts.T4]}));
 const businessUnits=REGIONS.map(name=>({name,counts:["u0","u1","u23","u4"].map(k=>businessByRegion[name][k].size)}));
 return {version:1,updated_at:new Date().toISOString(),records,schoolUnits,businessUnits,
  businessUniqueByWave:["u0","u1","u23","u4"].map(k=>businessPerWave[k].size),
  schoolCount:schoolUnits.length,
  notes:"Agregat respons per wave; jumlah nama usaha unik memakai normalisasi sederhana, bukan verifikasi entitas lintas wave.",
  data_scope:"SMK dan UMKM; delapan spreadsheet; tanpa data identitas individu."};
}
function cors(req){
 const origin=req.headers.get("Origin")||"";
 const allowed=["https://gunggu.github.io","https://gunggu.my.id","https://sidekerp.gunggu.my.id"];
 return allowed.includes(origin)?origin:null;
}
function answer(request,data,status=200){
 const allow=cors(request);const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"};
 if(allow){headers["Access-Control-Allow-Origin"]=allow;headers["Access-Control-Allow-Headers"]="Authorization, Content-Type";headers["Access-Control-Allow-Methods"]="GET, POST, OPTIONS"}
 return new Response(JSON.stringify(data),{status,headers});
}
function tokenMatches(actual,expected){
 if(!actual||!expected)return false;
 const a=new TextEncoder().encode(actual),b=new TextEncoder().encode(expected);
 let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]??0)^(b[i]??0);
 return diff===0;
}
export default {async fetch(request,env){
 const pathname=new URL(request.url).pathname;
 if(!["/data","/refresh","/health"].includes(pathname))return answer(request,{error:"Not found"},404);
 if(request.method==="OPTIONS"){return cors(request)?answer(request,{ok:true}):answer(request,{error:"Origin tidak diizinkan"},403)}
 if(pathname==="/health"&&request.method==="GET")return answer(request,{ok:true,kv_configured:!!env.DATA_CACHE});
 if(pathname==="/data"&&request.method==="GET"){
  if(!env.DATA_CACHE)return answer(request,{error:"KV DATA_CACHE belum dikonfigurasi."},503);
  const value=await env.DATA_CACHE.get("sidek-aggregate-v1","json");
  return value?answer(request,value):answer(request,{error:"Snapshot belum tersedia. Lakukan refresh pertama."},404);
 }
 if(pathname==="/refresh"&&request.method==="POST"){
  const origin=request.headers.get("Origin");if(origin&&!cors(request))return answer(request,{error:"Origin tidak diizinkan"},403);
  const secret=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!tokenMatches(secret,env.ADMIN_UPDATE_TOKEN))return answer(request,{error:"Kunci admin tidak valid"},401);
  if(!env.DATA_CACHE||!env.GOOGLE_SERVICE_ACCOUNT_EMAIL||!env.GOOGLE_PRIVATE_KEY)return answer(request,{error:"Backend belum lengkap: KV atau kredensial service account belum dipasang."},503);
  try{
   const token=await getToken(env);
   const reads=await Promise.all(SHEETS.map(async def=>({def,values:await readSheet(def,token)})));
   // Publish ONLY after all eight Sheets have been fetched and parsed.
   const summary=aggregate(reads);
   await env.DATA_CACHE.put("sidek-aggregate-v1",JSON.stringify(summary));
   return answer(request,summary);
  }catch(e){return answer(request,{error:String(e.message||e)},502)}
 }
 return answer(request,{error:"Method tidak didukung"},405);
}};
