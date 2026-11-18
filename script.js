/* =====================================================================
   OLGA ADMIN — لوحة تحكم أولغا
   ---------------------------------------------------------------------
   Data layer: Supabase. `DB.load()` reads every table into the in-memory
   state `S`; each action updates `S` and writes the same change to
   Supabase (products + product_variants + variant_costs, customers,
   orders, coupons, offers, push_campaigns, activity_log, app_settings
   [store · content · shams · perms], staff_profiles + user_roles).
   Sign-in uses Supabase Auth; access is enforced by the database rules.
   Bell notifications are kept per device (localStorage).
   ===================================================================== */
(()=>{'use strict';
const {SB_URL,SB_KEY}=window.OLGA_ADMIN_CONFIG;
const NOTIF_KEY='olga_admin_notifs_';
const DAY=864e5;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt0=n=>Math.round(n||0).toLocaleString('en-US');
const JD=n=>`<span class="num">${fmt(n)}</span> <small class="muted">د.أ</small>`;
const iso=d=>new Date(d).toISOString();
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return +d};
const fdate=d=>new Date(d).toLocaleDateString('ar-JO-u-nu-latn',{day:'numeric',month:'short',year:'numeric'});
const fdt=d=>new Date(d).toLocaleString('ar-JO-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const ftime=d=>new Date(d).toLocaleTimeString('ar-JO-u-nu-latn',{hour:'2-digit',minute:'2-digit'});
const ago=d=>{const s=(Date.now()-new Date(d))/1000;if(s<60)return 'الآن';if(s<3600)return `منذ ${Math.floor(s/60)} د`;if(s<86400)return `منذ ${Math.floor(s/3600)} س`;return `منذ ${Math.floor(s/86400)} يوم`};
/* account avatar: Olga logo for every account */
const avatar=(n,cls='')=>`<span class="av${cls?' '+cls:''}" role="img" title="${esc(n||'')}" aria-label="${esc(n||'')}"><svg viewBox="0 0 1260 726" aria-hidden="true" focusable="false"><use href="#olga-logo"/></svg></span>`;
const ini=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>(w.replace(/^ال(?=..)/,'')||w)[0]).join(' ');
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- constants ---------- */
const STATUS={new:{t:'جديد',c:'s-new'},processing:{t:'قيد التجهيز',c:'s-proc'},shipped:{t:'مشحون',c:'s-ship'},done:{t:'مكتمل',c:'s-done'},cancelled:{t:'ملغي',c:'s-cancel'}};
const FLOW=['new','processing','shipped','done'];
const PAY_T={cod:'الدفع عند الاستلام',card:'دفع إلكتروني (بطاقة)',cliq:'تحويل CliQ',wallet:'محفظة إلكترونية'};
const payT=p=>PAY_T[p]||PAY_T.cod;
const PAY_SHORT={cod:'عند الاستلام',card:'بطاقة',cliq:'CliQ',wallet:'محفظة'};
/* permanent order deletion is for the general manager (admin) only */
const isAdm=()=>!!ME&&ME.role==='admin';
/* map pin sent by the store checkout (saved inside the order notes) */
const mapOf=o=>{const m=String(o.notes||'').match(/https:\/\/maps\.google\.com\/\?q=-?[\d.]+,-?[\d.]+/);return m?m[0]:''};
const CHANNELS={web:'الموقع',ios:'تطبيق iOS',android:'تطبيق Android',whatsapp:'واتساب',shams:'محادثة شمس'};
const CH_COLOR={web:'#1F3A40',ios:'#66756F',android:'#6E8B3A',whatsapp:'#25A35A',shams:'#C6A13F'};
const CATS={body:'للأيدي والاستحمام',laundry:'غسيل الملابس',hammam:'الحمّام المغربي',sets:'المجموعات'};
const CITIES=['عمّان','إربد','الزرقاء','العقبة','السلط','مادبا','جرش','الكرك','المفرق','عجلون'];
const SKINS=['جافة','حساسة','دهنية','مختلطة','عادية'];
const SEGS={new:{t:'جديد',c:'g-new'},rep:{t:'متكرر',c:'g-rep'},vip:{t:'مميز',c:'g-vip'}};
const ROLES={admin:'المدير العام',accountant:'المحاسب',orders:'موظف الطلبات'};
const PERM_T={none:'بدون وصول',view:'عرض فقط',edit:'عرض وتعديل'};
const MODULES=[
 {id:'home',t:'الرئيسية',en:'Dashboard',ic:'grid'},
 {id:'orders',t:'الطلبات',en:'Orders',ic:'cart'},
 {id:'reports',t:'الأرباح والتقارير',en:'Profit & Reports',ic:'chart'},
 {id:'products',t:'المنتجات والمخزون',en:'Products & Stock',ic:'cube'},
 {id:'customers',t:'العملاء',en:'Customers · CRM',ic:'users'},
 {id:'marketing',t:'العروض والكوبونات',en:'Marketing',ic:'tag'},
 {id:'shams',t:'تقارير شمس',en:'Shams AI Insights',ic:'chat'},
 {id:'users',t:'المستخدمون والصلاحيات',en:'Users & Roles',ic:'lock'},
 {id:'settings',t:'الإعدادات',en:'Settings',ic:'gear'}
];

/* ---------- icons ---------- */
const ICONS={
grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
cart:'<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
chart:'<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-6"/>',
cube:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
tag:'<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
lock:'<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
trash:'<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
download:'<path d="M12 3v12m-5-5 5 5 5-5M4 21h16"/>',upload:'<path d="M12 21V9m-5 5 5-5 5 5M4 3h16"/>',
x:'<path d="M18 6 6 18M6 6l12 12"/>',check:'<path d="m5 12 5 5L20 7"/>',
star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',left:'<path d="m15 6-6 6 6 6"/>',
phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
wa:'<path d="M3.5 20.5 5 16.3A8.5 8.5 0 1 1 8 19.2z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.2-2.2l.8-1-1-2z"/>',
pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
truck:'<path d="M2 6h11v10H2zM13 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
logout:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
send:'<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4.5-4.5"/>',
refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
file:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
store:'<path d="M4 10v10h16V10M3 6l2-3h14l2 3v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M10 20v-5h4v5"/>',
cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
coin:'<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
userplus:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>',
mega:'<path d="M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6"/>',
image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
kanban:'<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
percent:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
mobile:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'
};
const ic=(n,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]||''}</svg>`;

/* ---------- state ---------- */
let S=null, ME=null, route='home';
const UI={homeRange:30,ordStatus:'all',ordQ:'',ordCh:'',ordCity:'',ordRange:'all',ordView:'table',ordLimit:25,repPeriod:'daily',prodCat:'all',prodQ:'',custSeg:'all',custQ:'',custSkin:'',custCity:'',custLimit:30,mkTab:'coupons',usrTab:'staff'};


/* ---------- Supabase data layer ---------- */
if(!window.supabase){document.addEventListener('DOMContentLoaded',()=>{const e=document.getElementById('loginErr');if(e)e.textContent='تعذّر تحميل مكتبة الاتصال بقاعدة البيانات — تحقق من الإنترنت ثم أعد تحميل الصفحة'});return}
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'olga-admin-auth'}});
const DEF_SET={storeName:'Olga · أولغا',whatsapp:'',storeUrl:'olga.html',deliveryAmman:2,deliveryOther:3,live:true,sound:true,autoNotify:true,email:''};
const DEF_CONTENT={bar:[],banners:[]};
const DEF_SHAMS={conversations:0,avgReply:0,satisfaction:0,syncedAt:null,questions:[],needs:[],recs:{},knowledge:'',faq:[],prices:null};
const DEF_PERMS={
 accountant:{home:'view',orders:'view',reports:'edit',products:'view',customers:'view',marketing:'none',shams:'view',users:'none',settings:'none'},
 orders:{home:'view',orders:'edit',reports:'none',products:'view',customers:'edit',marketing:'none',shams:'view',users:'none',settings:'none'}
};
const ROLE_RANK={admin:0,accountant:1,orders:2};
const MAP={
 prod:(p,V,costs)=>({id:p.id,name:p.name,en:p.name_en||'',cat:CATS[p.category]?p.category:'body',acc:p.accent||'#6E8B3A',badge:p.badge||'',cal:p.calligraphy||'',featured:!!p.featured,active:!!p.active,img:p.image_url||'',desc:p.description||'',sort:p.sort_order||0,
  variants:V.filter(v=>v.product_id===p.id).sort((a,b)=>(a.sort_order-b.sort_order)||a.sku.localeCompare(b.sku)).map(v=>({sku:v.sku,size:v.size||'',price:+v.price||0,cost:+(costs[v.sku]||0),stock:+v.stock||0,low:+v.low_stock||0}))}),
 cust:c=>({id:c.id,name:c.name,phone:c.phone||'',gender:c.gender||'',city:c.city||'',addresses:c.addresses&&c.addresses.length?c.addresses:[''],skin:c.skin||'عادية',interests:c.interests||[],source:c.source||'web',createdAt:c.created_at,notes:c.notes||''}),
 order:o=>({id:+o.id,date:o.created_at,cid:o.customer_id,name:o.name,phone:o.phone||'',city:o.city||'',address:o.address||'',channel:CHANNELS[o.channel]?o.channel:'web',
  items:(Array.isArray(o.items)?o.items:[]).map(i=>({sku:i.sku,pid:i.pid,name:i.name||'',size:i.size||'',qty:+i.qty||0,price:+i.price||0,cost:+i.cost||0})),
  subtotal:+o.subtotal||0,discount:+o.discount||0,coupon:o.coupon||'',delivery:+o.delivery||0,total:+o.total||0,payment:o.payment||'cod',status:STATUS[o.status]?o.status:'new',
  history:(Array.isArray(o.history)?o.history:[]).filter(h=>STATUS[h.s]),notes:o.notes||''}),
 coupon:c=>({code:c.code,type:c.type==='fixed'?'fixed':'pct',value:+c.value||0,min:+c.min_order||0,limit:+c.usage_limit||0,used:+c.used||0,expires:c.expires_at,active:!!c.active,desc:c.description||''}),
 offer:o=>({id:o.id,name:o.name,products:o.product_ids||[],pct:+o.pct||0,from:o.starts_at,to:o.ends_at,active:!!o.active}),
 push:x=>({id:x.id,title:x.title,body:x.body||'',audience:x.audience||'all',sent:x.sent_at,reach:+x.reach||0,opens:+x.opens||0}),
 log:l=>({at:l.at,who:l.who,msg:l.msg})
};
const chk=({data,error})=>{if(error)throw error;return data};
async function fetchAll(t,ord,asc=true){const out=[];for(let f=0;;f+=1000){const{data,error}=await sb.from(t).select('*').order(ord,{ascending:asc}).range(f,f+999);if(error)throw error;out.push(...data);if(data.length<1000)break}return out}
const maxStr=(a,b)=>!a?b:!b?a:(a>b?a:b);
function errMsg(e){const m=String(e&&(e.message||e.error_description||e)||'');
 if(/row-level security|permission denied|forbidden|42501/i.test(m+(e&&e.code||'')))return 'ليست لديك صلاحية لهذا الإجراء';
 if(/duplicate key|23505/i.test(m+(e&&e.code||'')))return 'هذا السجل موجود مسبقاً';
 if(/Failed to fetch|NetworkError/i.test(m))return 'تعذّر الاتصال بالخادم — تحقق من الإنترنت';
 return m||'خطأ غير معروف'}
let RS_T;function resync(){clearTimeout(RS_T);RS_T=setTimeout(async()=>{try{await DB.load();renderNav();soft();refreshDrawer()}catch(e){console.warn(e)}},400)}
/* run a write; on failure show the reason and reload the real data */
async function W(p,label){try{const{error}=await p;if(error)throw error;return true}catch(e){console.error(e);toast(label||'تعذّر حفظ التغيير',errMsg(e),{tone:'red',icon:'x'});resync();return false}}
const putSetting=(key,value)=>W(sb.from('app_settings').upsert({key,value}),'تعذّر حفظ الإعدادات');

const DB={
 async load(){
  const [P,V,C,Cu,O,Cp,Of,Pu,L,St,Sp,R]=await Promise.all([
   fetchAll('products','sort_order'),fetchAll('product_variants','sku'),fetchAll('variant_costs','sku'),
   fetchAll('customers','created_at'),fetchAll('orders','id'),fetchAll('coupons','created_at',false),
   fetchAll('offers','created_at',false),fetchAll('push_campaigns','sent_at',false),
   sb.from('activity_log').select('*').order('at',{ascending:false}).limit(400).then(chk),
   sb.from('app_settings').select('*').then(chk),
   fetchAll('staff_profiles','created_at'),fetchAll('user_roles','id')]);
  const costs={};C.forEach(c=>costs[c.sku]=c.cost);
  const set={};St.forEach(r=>set[r.key]=r.value||{});
  const perms=JSON.parse(JSON.stringify(DEF_PERMS));Object.entries(set.perms||{}).forEach(([r,m])=>{if(perms[r]&&m&&typeof m==='object')Object.assign(perms[r],m)});
  const roleOf=id=>R.filter(r=>r.user_id===id).map(r=>r.role).sort((a,b)=>ROLE_RANK[a]-ROLE_RANK[b])[0];
  const notifs=S&&S.notifs?S.notifs:[];
  S={products:P.map(p=>MAP.prod(p,V,costs)),customers:Cu.map(MAP.cust),orders:O.map(MAP.order),coupons:Cp.map(MAP.coupon),offers:Of.map(MAP.offer),pushes:Pu.map(MAP.push),
   content:{...DEF_CONTENT,...(set.content||{})},shams:{...DEF_SHAMS,...(set.shams||{})},perms,settings:{...DEF_SET,...(set.store||{})},
   staff:Sp.map(u=>({id:u.id,name:u.name,email:u.email,active:!!u.active,last:u.last_seen,role:roleOf(u.id)||'orders'})),
   log:L.map(MAP.log),notifs,
   _cur:O.reduce((m,o)=>maxStr(m,o.updated_at),''),_custCur:Cu.reduce((m,c)=>maxStr(m,c.created_at),'')};
  if(!Array.isArray(S.content.bar))S.content.bar=[];if(!Array.isArray(S.content.banners))S.content.banners=[];
  ['questions','needs','faq'].forEach(k=>{if(!Array.isArray(S.shams[k]))S.shams[k]=[]});if(!S.shams.recs||typeof S.shams.recs!=='object')S.shams.recs={};
  if(ME){const me=S.staff.find(u=>u.id===ME.id);if(me){me.role=ME.role;ME=me}}
 },
 /* only the bell notifications are kept on this device */
 save(){if(!ME||!S)return;try{localStorage.setItem(NOTIF_KEY+ME.id,JSON.stringify(S.notifs.slice(0,60)))}catch(e){}},
 loadNotifs(){try{S.notifs=JSON.parse(localStorage.getItem(NOTIF_KEY+ME.id)||'[]')}catch(e){S.notifs=[]}}
};

/* ---------- computed helpers ---------- */
const oSales=o=>o.subtotal-o.discount;
const oCost=o=>o.items.reduce((s,i)=>s+i.cost*i.qty,0);
const inRange=(f,t)=>S.orders.filter(o=>{const x=+new Date(o.date);return x>=f&&x<t});
function stats(list){let sales=0,cost=0,n=0;list.forEach(o=>{if(o.status==='cancelled')return;n++;sales+=oSales(o);cost+=oCost(o)});return{sales,cost,profit:sales-cost,orders:n,aov:n?sales/n:0,margin:sales?(sales-cost)/sales*100:0}}
const countNew=(f,t)=>S.customers.filter(c=>{const x=+new Date(c.createdAt);return x>=f&&x<t}).length;
const lowStock=()=>{const L=[];S.products.forEach(p=>{if(!p.active)return;p.variants.forEach(v=>{if(v.stock<=v.low)L.push({p,v})})});return L};
const findP=id=>S.products.find(p=>p.id===id);
const findC=id=>S.customers.find(c=>c.id===id);
const findO=id=>S.orders.find(o=>o.id==id);
const nextStatus=s=>{const i=FLOW.indexOf(s);return i>=0&&i<FLOW.length-1?FLOW[i+1]:null};
function custAgg(){const m={};S.orders.forEach(o=>{if(o.status==='cancelled')return;const x=m[o.cid]||(m[o.cid]={orders:0,spent:0,last:0,first:Infinity});x.orders++;x.spent+=oSales(o);const t=+new Date(o.date);x.last=Math.max(x.last,t);x.first=Math.min(x.first,t)});return m}
const segOf=st=>!st||st.orders<=1?'new':(st.orders>=5||st.spent>=45)?'vip':'rep';
const perm=m=>!ME?'none':ME.role==='admin'?'edit':((S.perms[ME.role]||{})[m]||'none');
const can=m=>perm(m)!=='none', canEdit=m=>perm(m)==='edit';
const pct=(a,b)=>b?((a-b)/b*100):(a?100:0);
function dayBuckets(n){const out=[];const t=sod(Date.now());for(let i=n-1;i>=0;i--){const f=t-i*DAY;const d=new Date(f);out.push({from:f,to:f+DAY,label:`${d.getDate()}/${d.getMonth()+1}`})}return out}
function periodBuckets(p){
 const t=sod(Date.now())+DAY;
 if(p==='daily')return dayBuckets(14);
 if(p==='weekly'){const out=[];for(let i=11;i>=0;i--){const to=t-i*7*DAY,f=to-7*DAY;const d=new Date(f);out.push({from:f,to,label:`${d.getDate()}/${d.getMonth()+1}`})}return out}
 const out=[];const n=new Date();for(let i=5;i>=0;i--){const f=new Date(n.getFullYear(),n.getMonth()-i,1),to=new Date(n.getFullYear(),n.getMonth()-i+1,1);out.push({from:+f,to:Math.min(+to,t),label:f.toLocaleDateString('ar-JO-u-nu-latn',{month:'short'})})}return out;
}

/* ---------- small UI builders ---------- */
const stChip=s=>`<span class="chip ${STATUS[s].c}">${STATUS[s].t}</span>`;
const chChip=c=>`<span class="ch" style="--c:${CH_COLOR[c]}"><i></i>${CHANNELS[c]}</span>`;
const segChip=s=>`<span class="chip ${SEGS[s].c}">${SEGS[s].t}</span>`;
const delta=(a,b,inv)=>{const p=pct(a,b);const up=p>=0;return `<span class="delta ${up!==!!inv?'':'down'}">${ic(up?'up':'down')}<span class="num">${Math.abs(p).toFixed(0)}%</span></span>`};
const ph=(en,title,sub,actions='')=>`<div class="ph rise"><div><span class="eyebrow en">${en}</span><h1>${title}</h1>${sub?`<p class="muted">${sub}</p>`:''}</div><div class="ph__a">${actions}</div></div>`;
const sel=(k,opts)=>`<select class="in" style="width:auto" data-ui="${k}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${String(UI[k])===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
const sw=(attrs,on)=>`<label class="sw"><input type="checkbox" ${attrs} ${on?'checked':''}><i></i></label>`;
const empty=(t,i='search')=>`<div class="empty">${ic(i)}<div>${t}</div></div>`;
const opt=(v,t,cur)=>`<option value="${esc(v)}" ${String(cur)===String(v)?'selected':''}>${esc(t)}</option>`;

/* ---------- charts (pure SVG) ---------- */
const CH={};let chartN=0;
function areaChart(series,labels,{h=280,money=true}={}){
 const id='c'+(++chartN),W=820,H=h,P={l:52,r:14,t:18,b:30};
 const max=Math.max(1,...series.flatMap(s=>s.values))*1.15;
 const n=labels.length,step=n>1?(W-P.l-P.r)/(n-1):0;
 const x=i=>P.l+i*step,y=v=>H-P.b-(v/max)*(H-P.t-P.b);
 let g='';
 for(let k=0;k<=4;k++){const v=max/4*k,yy=y(v);g+=`<line class="gl" x1="${P.l}" x2="${W-P.r}" y1="${yy}" y2="${yy}"/><text class="ax" x="${P.l-10}" y="${yy+4}" text-anchor="end">${fmt0(v)}</text>`}
 const every=Math.ceil(n/8);labels.forEach((l,i)=>{if((n-1-i)%every===0)g+=`<text class="ax" x="${x(i)}" y="${H-8}" text-anchor="middle">${esc(l)}</text>`});
 let defs='',paths='';
 series.forEach((s,si)=>{
  const pts=s.values.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line='M'+pts.join('L');
  if(s.area){defs+=`<linearGradient id="${id}g${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;paths+=`<path class="ar" d="${line}L${x(n-1)},${H-P.b}L${x(0)},${H-P.b}Z" fill="url(#${id}g${si})"/>`}
  paths+=`<path class="ln ${s.dash?'dash':''}" ${s.dash?'stroke-dasharray="5 6"':'pathLength="1"'} d="${line}" stroke="${s.color}" style="animation-delay:${si*.25}s"/>`;
 });
 const dots=series.map((s,si)=>`<circle class="dot" data-s="${si}" r="5" fill="#fff" stroke="${s.color}" stroke-width="2.5"/>`).join('');
 CH[id]={labels,series,W,H,P,step,x,y,money};
 return `<div class="chart" data-cid="${id}"><svg viewBox="0 0 ${W} ${H}" role="img"><defs>${defs}</defs>${g}${paths}<line class="guide" y1="${P.t}" y2="${H-P.b}"/>${dots}<rect x="${P.l}" y="0" width="${W-P.l-P.r}" height="${H}" fill="transparent"/></svg><div class="tip"></div></div>`;
}
function barChart(values,labels,color='#6E8B3A',{h=220}={}){
 const W=820,H=h,P={l:40,r:10,t:14,b:30},n=values.length,max=Math.max(1,...values)*1.15;
 const bw=(W-P.l-P.r)/n;let s='';
 for(let k=0;k<=3;k++){const v=max/3*k,yy=H-P.b-(v/max)*(H-P.t-P.b);s+=`<line class="gl" x1="${P.l}" x2="${W-P.r}" y1="${yy}" y2="${yy}"/><text class="ax" x="${P.l-8}" y="${yy+4}" text-anchor="end">${fmt0(v)}</text>`}
 values.forEach((v,i)=>{const hh=(v/max)*(H-P.t-P.b),xx=P.l+i*bw+bw*.22;s+=`<rect class="vbar" style="animation-delay:${i*40}ms" x="${xx}" y="${H-P.b-hh}" width="${bw*.56}" height="${hh}" rx="6" fill="${color}"><title>${esc(labels[i])}: ${fmt0(v)}</title></rect><text class="ax" x="${xx+bw*.28}" y="${H-8}" text-anchor="middle">${esc(labels[i])}</text>`});
 return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
}
function donut(data,center,sub){
 const tot=data.reduce((s,d)=>s+d.value,0)||1;let off=0;const R=70;
 const segs=data.map(d=>{const p=d.value/tot*100;const c=`<circle class="seg-c" r="${R}" cx="90" cy="90" fill="none" stroke="${d.color}" stroke-width="22" pathLength="100" stroke-dasharray="0 100" data-dash="${Math.max(0,p-.8)} ${100-Math.max(0,p-.8)}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(d.label)}</title></circle>`;off+=p;return c}).join('');
 return `<div class="donut-w"><svg class="donut" viewBox="0 0 180 180"><circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--cream-soft)" stroke-width="22"/>${segs}<text class="c1" x="90" y="92" text-anchor="middle">${center}</text><text class="c2" x="90" y="112" text-anchor="middle">${sub}</text></svg><div class="dl">${data.map(d=>`<div><i style="background:${d.color}"></i>${esc(d.label)}<b class="num">${(d.value/tot*100).toFixed(0)}%</b></div>`).join('')}</div></div>`;
}
function spark(vals,color){const n=vals.length,max=Math.max(1,...vals),min=Math.min(...vals);const pts=vals.map((v,i)=>`${(i/(n-1)*96).toFixed(1)},${(34-(v-min)/((max-min)||1)*30).toFixed(1)}`).join('L');return `<svg class="spark" viewBox="0 0 96 36" fill="none"><path d="M${pts}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
const bars=(rows,max,cls='')=>`<div class="bars ${cls}">${rows.map((r,i)=>`<div class="bar"><span>${r.label}</span><span class="t"><i style="--w:${max?(r.value/max*100).toFixed(1):0}%;${r.color?`--c:${r.color};`:''}animation-delay:${i*80}ms"></i></span><b class="num">${r.text??fmt0(r.value)}</b></div>`).join('')}</div>`;

function afterRender(root=document){
 $$('[data-count]',root).forEach(el=>{const to=+el.dataset.count,dec=+el.dataset.dec||0;const f=v=>v.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});if(RM){el.textContent=f(to);return}const t0=performance.now(),dur=1300;const st=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,4);el.textContent=f(to*e);if(p<1)requestAnimationFrame(st)};requestAnimationFrame(st)});
 requestAnimationFrame(()=>requestAnimationFrame(()=>$$('[data-dash]',root).forEach(c=>c.setAttribute('stroke-dasharray',c.dataset.dash))));
 $$('.chart[data-cid]',root).forEach(el=>{
  const c=CH[el.dataset.cid];if(!c||el._b)return;el._b=1;const svg=$('svg',el),tip=$('.tip',el),guide=$('.guide',el),dots=$$('.dot',el);
  svg.addEventListener('pointermove',e=>{const r=svg.getBoundingClientRect();const xr=(e.clientX-r.left)/r.width*c.W;let i=Math.round((xr-c.P.l)/(c.step||1));i=Math.max(0,Math.min(c.labels.length-1,i));const X=c.x(i);
   guide.setAttribute('x1',X);guide.setAttribute('x2',X);guide.style.opacity=1;let minY=c.H;
   dots.forEach(d=>{const s=c.series[+d.dataset.s];const Y=c.y(s.values[i]);minY=Math.min(minY,Y);d.setAttribute('cx',X);d.setAttribute('cy',Y);d.style.opacity=1});
   tip.innerHTML=`<b>${esc(c.labels[i])}</b>${c.series.map(s=>`<div><span style="color:${s.color}">●</span> ${esc(s.label)}: <span class="num">${c.money?fmt(s.values[i]):fmt0(s.values[i])}</span></div>`).join('')}`;
   tip.style.left=(X/c.W*100)+'%';tip.style.top=(minY/c.H*r.height)+'px';tip.style.opacity=1});
  svg.addEventListener('pointerleave',e=>{if(e.pointerType!=='mouse')return;guide.style.opacity=0;tip.style.opacity=0;dots.forEach(d=>d.style.opacity=0)});
  svg.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')svg.dispatchEvent(new PointerEvent('pointermove',e))});
 });
}
/* =====================================================================
   VIEWS
   ===================================================================== */
const VIEWS={};

/* ---------------- HOME ---------------- */
VIEWS.home=()=>{
 const R=UI.homeRange,now=Date.now(),end=sod(now)+DAY,from=end-R*DAY,pf=from-R*DAY;
 const curL=inRange(from,end),a=stats(curL),b=stats(inRange(pf,from));
 const nc=countNew(from,end),pnc=countNew(pf,from);
 const bk=dayBuckets(R),ser=bk.map(x=>stats(inRange(x.from,x.to)));
 const by={};curL.forEach(o=>{if(o.status==='cancelled')return;o.items.forEach(i=>by[i.pid]=(by[i.pid]||0)+i.price*i.qty)});
 const tot=Object.values(by).reduce((s,v)=>s+v,0);
 const dist=[['nabulsi','نابلسي','#6E8B3A'],['shea','الشيا','#8B5430'],['laurel','الغار','#4E7A32']].map(([id,l,c])=>({label:l,value:by[id]||0,color:c}));
 dist.push({label:'أخرى',value:Math.max(0,tot-dist.reduce((s,d)=>s+d.value,0)),color:'#C6A13F'});
 const chs=Object.keys(CHANNELS).map(k=>({label:CHANNELS[k],value:curL.filter(o=>o.channel===k&&o.status!=='cancelled').length,color:CH_COLOR[k]}));
 const chMax=Math.max(...chs.map(c=>c.value));
 const latest=[...S.orders].sort((x,y)=>new Date(y.date)-new Date(x.date)).slice(0,7);
 const low=lowStock();const hr=new Date().getHours();
 const kpi=(lbl,icon,val,dec,unit,cv,pv,d,cls,sp)=>`<div class="card kpi rise ${cls||''}" style="--d:${d}">${sp||''}<div class="lbl"><span class="ic">${ic(icon)}</span>${lbl}</div><div class="val"><span class="num" data-count="${val}" data-dec="${dec}">0</span>${unit?`<small>${unit}</small>`:''}</div><div class="foot">${delta(cv,pv)}<span>مقارنة بالفترة السابقة</span></div></div>`;
 return `
 ${ph('Olga Admin · Dashboard',`${hr<12?'صباح الخير':'مساء الخير'}، <b>${esc(ME.name.split(' ')[0])}</b>`,`هذه نظرة لحظية على أداء متجر <span class="it" style="color:var(--olive)">أولغا</span> — من الموقع والتطبيقين وواتساب ومحادثات شمس.`,
  `<div class="seg">${[7,30,90].map(d=>`<button class="${R===d?'on':''}" data-act="homeRange" data-v="${d}">آخر ${d} يوماً</button>`).join('')}</div>${canEdit('orders')?`<button class="btn btn--olive" data-act="newOrder">${ic('plus')}طلب جديد</button>`:''}`)}
 <div class="grid g4">
  ${kpi('المبيعات','cash',a.sales,2,'د.أ',a.sales,b.sales,0,'dark',spark(ser.map(s=>s.sales),'#E7D08A'))}
  ${kpi('صافي الأرباح','coin',a.profit,2,'د.أ',a.profit,b.profit,1,'',spark(ser.map(s=>s.profit),'#6E8B3A'))}
  ${kpi('الطلبات','cart',a.orders,0,'',a.orders,b.orders,2,'',spark(ser.map(s=>s.orders),'#2C4D54'))}
  ${kpi('عملاء جدد','userplus',nc,0,'',nc,pnc,3,'')}
 </div>
 <div class="grid g-main">
  <div class="card rise" style="--d:4"><div class="card__h"><h3>${ic('chart')}المبيعات والأرباح اليومية</h3><div class="legend"><span><i style="background:#6E8B3A"></i>المبيعات</span><span><i style="background:#C6A13F"></i>صافي الربح</span></div></div>
   ${areaChart([{label:'المبيعات',values:ser.map(s=>s.sales),color:'#6E8B3A',area:true},{label:'صافي الربح',values:ser.map(s=>s.profit),color:'#C6A13F',area:true}],bk.map(x=>x.label))}</div>
  <div class="card rise" style="--d:5"><div class="card__h"><h3>${ic('drop')}توزيع المبيعات</h3><span class="muted sm">حسب المنتج</span></div>
   ${donut(dist,fmt0(tot),'د.أ مبيعات')}
   <hr class="sep"><div class="row muted sm">${ic('star')} الأكثر مبيعاً: <b style="color:var(--ink);font-weight:500">${esc((findP(Object.entries(by).sort((x,y)=>y[1]-x[1])[0]?.[0])||{}).name||'—')}</b></div></div>
 </div>
 <div class="grid g-main">
  <div class="card rise" style="--d:6"><div class="card__h"><h3>${ic('cart')}أحدث الطلبات</h3>${can('orders')?`<a class="link" href="#/orders">عرض الكل ${ic('left')}</a>`:''}</div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الطلب</th><th>العميل</th><th>المصدر</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>
   ${latest.map(o=>`<tr class="click ${o._fresh?'new-row':''}" data-act="openOrder" data-id="${o.id}"><td><b class="num">#${o.id}</b><div class="muted sm">${ago(o.date)}</div></td><td>${esc(o.name)}<div class="muted sm">${o.city}</div></td><td>${chChip(o.channel)}</td><td>${JD(o.total)}</td><td>${stChip(o.status)}</td></tr>`).join('')}
   </tbody></table></div></div>
  <div class="stack">
   <div class="card rise" style="--d:7"><div class="card__h"><h3>${ic('alert')}تنبيهات المخزون</h3>${can('products')?`<a class="link" href="#/products">إدارة ${ic('left')}</a>`:''}</div>
    ${low.length?low.slice(0,5).map(({p,v})=>`<div class="q"><span class="n" style="background:var(--bad-soft);color:var(--bad)">!</span><div style="flex:1">${esc(p.name)} <span class="muted sm">· ${esc(v.size)}</span></div><b class="num" style="color:var(--bad)">${v.stock}</b></div>`).join(''):`<div class="alert ok" style="margin:0">${ic('check')}كل المنتجات بمخزون جيد</div>`}</div>
   <div class="card rise" style="--d:8"><div class="card__h"><h3>${ic('store')}الطلبات حسب القناة</h3></div>${bars(chs,chMax)}</div>
  </div>
 </div>
 <div class="grid g4">
  ${[['bell','طلبات لحظية','من الموقع والتطبيقين وواتساب في صندوق واحد','orders'],['coin','أرباح صافية','بعد خصم التكلفة لكل منتج وطلب','reports'],['download','تقارير جاهزة','يومية وشهرية قابلة للتصدير PDF و Excel','reports'],['db','قاعدة العملاء','كل عميل بسجله واهتماماته ونوع بشرته','customers']].map(([i,t,s,r],k)=>`<a class="feat rise" style="--d:${9+k}" href="#/${can(r)?r:'home'}"><span class="ic">${ic(i)}</span><div><b>${t}</b><small>${s}</small></div></a>`).join('')}
 </div>`;
};

/* ---------------- ORDERS ---------------- */
function filteredOrders(ignoreStatus){
 const q=UI.ordQ.trim().toLowerCase().replace('#','');
 let L=S.orders.filter(o=>(ignoreStatus||UI.ordStatus==='all'||o.status===UI.ordStatus)&&(!UI.ordCh||o.channel===UI.ordCh)&&(!UI.ordCity||o.city===UI.ordCity));
 if(UI.ordRange!=='all'){const d=+UI.ordRange;const f=d===1?sod(Date.now()):Date.now()-d*DAY;L=L.filter(o=>+new Date(o.date)>=f)}
 if(q)L=L.filter(o=>String(o.id).includes(q)||o.name.toLowerCase().includes(q)||o.phone.includes(q));
 return L.sort((a,b)=>new Date(b.date)-new Date(a.date));
}
function orderRow(o,E){const nx=nextStatus(o.status);return `<tr class="click ${o._fresh?'new-row':''}" data-act="openOrder" data-id="${o.id}"><td><b class="num">#${o.id}</b></td><td>${fdate(o.date)}<div class="muted sm num">${ftime(o.date)}</div></td><td><div class="who">${avatar(o.name,'')}<div>${esc(o.name)}<div class="muted sm num">${o.phone}</div></div></div></td><td>${o.city}</td><td>${chChip(o.channel)}</td><td class="num">${o.items.reduce((s,i)=>s+i.qty,0)}</td><td>${JD(o.total)}</td><td>${PAY_SHORT[o.payment]||PAY_SHORT.cod}</td><td>${stChip(o.status)}</td><td><div class="row-acts">${E&&nx?`<button class="btn btn--sm btn--ghost" data-act="advance" data-id="${o.id}">${ic('check')}${STATUS[nx].t}</button>`:''}${isAdm()?`<button class="ib ib--del" data-act="delOrder" data-id="${o.id}" title="حذف الطلب نهائياً" aria-label="حذف الطلب #${o.id} نهائياً">${ic('trash')}</button>`:''}</div></td></tr>`}
function ordersList(){
 const E=canEdit('orders');
 if(UI.ordView==='kanban'){
  const L=filteredOrders(true);const cols=[...FLOW,'cancelled'];
  return `<div class="kanban">${cols.map(s=>{const items=L.filter(o=>o.status===s);return `<div class="kcol" data-s="${s}"><h4>${stChip(s)}<span class="muted num">${items.length}</span></h4>${items.slice(0,25).map(o=>`<div class="kcard" ${E?'draggable="true"':''} data-id="${o.id}" data-act="openOrder"><div class="row"><b class="num">#${o.id}</b><span class="muted sm">${ago(o.date)}</span></div><div style="margin:6px 0 4px">${esc(o.name)} · <span class="muted">${o.city}</span></div><div class="row">${chChip(o.channel)}<b>${JD(o.total)}</b></div></div>`).join('')}${items.length>25?`<div class="muted sm" style="text-align:center">+${items.length-25} طلب آخر</div>`:''}</div>`}).join('')}</div>${E?'<p class="muted sm" style="margin-top:10px">اسحب البطاقة بين الأعمدة لتغيير مرحلة الطلب.</p>':''}`;
 }
 const L=filteredOrders();if(!L.length)return empty('لا توجد طلبات مطابقة','cart');
 const shown=L.slice(0,UI.ordLimit);
 return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الطلب</th><th>التاريخ</th><th>العميل</th><th>المدينة</th><th>المصدر</th><th>القطع</th><th>القيمة</th><th>الدفع</th><th>الحالة</th><th></th></tr></thead><tbody>${shown.map(o=>orderRow(o,E)).join('')}</tbody></table></div>
 <div class="more"><span>عرض <span class="num">${shown.length}</span> من <span class="num">${L.length}</span> طلب · إجمالي <b>${JD(L.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0))}</b></span>${L.length>shown.length?`<button class="btn btn--sm btn--ghost" data-act="ordMore">عرض المزيد</button>`:''}</div>`;
}
VIEWS.orders=()=>{
 const E=canEdit('orders');const cnt=s=>S.orders.filter(o=>s==='all'||o.status===s).length;
 const tabs=[['all','الكل'],...Object.entries(STATUS).map(([k,v])=>[k,v.t])];
 return `${ph('Orders','إدارة <b>الطلبات</b>','استقبال لحظي لطلبات الموقع والتطبيقين وواتساب ومحادثة شمس، مع تتبع المراحل والفواتير وإشعار العميل.',
  `<div class="seg">${[['table','list','جدول'],['kanban','kanban','لوحة المراحل']].map(([k,i,t])=>`<button class="${UI.ordView===k?'on':''}" data-act="ordView" data-v="${k}">${ic(i)}${t}</button>`).join('')}</div>
   <button class="btn btn--ghost" data-act="exportOrders">${ic('download')}تصدير Excel</button>${isAdm()&&S.orders.length?`<button class="btn btn--danger" data-act="delAllOrders">${ic('trash')}حذف جميع الطلبات</button>`:''}${E?`<button class="btn btn--olive" data-act="newOrder">${ic('plus')}طلب جديد</button>`:''}`)}
 <div class="card rise" style="--d:1">
  ${UI.ordView==='table'?`<div class="toolbar"><div class="seg">${tabs.map(([k,t])=>`<button class="${UI.ordStatus===k?'on':''}" data-act="ordStatus" data-v="${k}">${t} <span class="n num">${cnt(k)}</span></button>`).join('')}</div></div>`:''}
  <div class="toolbar">
   <label class="search">${ic('search')}<input class="in" data-ui="ordQ" value="${esc(UI.ordQ)}" placeholder="رقم الطلب، اسم العميل أو الهاتف"></label>
   ${sel('ordCh',[['','كل القنوات'],...Object.entries(CHANNELS)])}
   ${sel('ordCity',[['','كل المدن'],...CITIES.map(c=>[c,c])])}
   ${sel('ordRange',[['all','كل الفترات'],['1','اليوم'],['7','آخر 7 أيام'],['30','آخر 30 يوماً'],['90','آخر 90 يوماً']])}
  </div>
  <div id="ordList">${ordersList()}</div>
 </div>`;
};
function orderDrawer(o){
 const E=canEdit('orders'),R=can('reports');const c=findC(o.cid);const idx=FLOW.indexOf(o.status);
 const head=`<div style="flex:1"><span class="eyebrow en">Order</span><h3 class="num">#${o.id}</h3></div>${stChip(o.status)}`;
 const body=`
 ${o.status==='cancelled'?`<div class="alert">${ic('x')}<b>تم إلغاء هذا الطلب</b> وأُعيدت الكميات إلى المخزون.</div>`:`<div class="steps">${FLOW.map((s,i)=>`<div class="step ${i<=idx?'on':''}"><b>${i<idx?ic('check'):i+1}</b>${STATUS[s].t}</div>`).join('')}</div>`}
 <div class="blk"><h4>${ic('file')}تفاصيل الطلب</h4><dl class="kv"><dt>التاريخ</dt><dd>${fdt(o.date)}</dd><dt>المصدر</dt><dd>${chChip(o.channel)}</dd><dt>الدفع</dt><dd>${payT(o.payment)}</dd>${o.coupon?`<dt>كوبون</dt><dd><span class="code">${esc(o.coupon)}</span></dd>`:''}</dl></div>
 <div class="blk"><h4>${ic('users')}العميل</h4><div class="box"><div class="who" style="margin-bottom:12px">${avatar(o.name,'dk')}<div style="flex:1"><b style="font-weight:500;color:var(--ink)">${esc(o.name)}</b><div class="muted sm num">${o.phone}</div></div>${c&&can('customers')?`<button class="btn btn--sm btn--ghost" data-act="openCust" data-id="${c.id}">الملف</button>`:''}</div>
  <div class="row muted sm">${ic('pin')}${esc(o.address||o.city)}</div>
  <div class="row" style="margin-top:12px"><a class="btn btn--sm btn--ghost" href="tel:${o.phone}">${ic('phone')}اتصال</a><a class="btn btn--sm btn--ghost" target="_blank" rel="noopener" href="https://wa.me/962${o.phone.replace(/^0/,'')}">${ic('wa')}واتساب</a>${mapOf(o)?`<a class="btn btn--sm btn--ghost" target="_blank" rel="noopener" href="${esc(mapOf(o))}">${ic('pin')}الموقع على الخريطة</a>`:''}</div></div></div>
 <div class="blk"><h4>${ic('cube')}المنتجات</h4><div class="box"><div class="lines">${o.items.map(i=>`<div><span>${esc(i.name)} <span class="muted sm">· ${esc(i.size)} × <span class="num">${i.qty}</span></span></span><span>${JD(i.price*i.qty)}</span></div>`).join('')}</div><hr class="sep"><div class="lines">
  <div><span class="muted">المجموع الفرعي</span><span>${JD(o.subtotal)}</span></div>${o.discount?`<div><span class="muted">الخصم</span><span style="color:var(--bad)">− ${JD(o.discount)}</span></div>`:''}<div><span class="muted">التوصيل</span><span>${JD(o.delivery)}</span></div><div class="tot"><span>الإجمالي</span><span>${JD(o.total)}</span></div>
  ${R?`<div><span class="muted">التكلفة</span><span>${JD(oCost(o))}</span></div><div><span class="muted">صافي الربح</span><b style="color:var(--ok)">${JD(oSales(o)-oCost(o))}</b></div>`:''}</div></div></div>
 <div class="blk"><h4>${ic('clock')}سجل المراحل</h4><div class="tl">${[...o.history].reverse().map(h=>`<div><b style="font-weight:500">${STATUS[h.s].t}</b> <span class="muted sm">· ${fdt(h.at)} · ${esc(h.by||'')}</span></div>`).join('')}</div></div>
 <div class="blk"><h4>${ic('edit')}ملاحظات داخلية</h4><textarea class="in" id="oNotes" ${E?'':'disabled'} placeholder="ملاحظات للفريق حول هذا الطلب…">${esc(o.notes)}</textarea>${E?`<button class="btn btn--sm btn--cream" style="margin-top:8px" data-act="saveNotes" data-id="${o.id}">حفظ الملاحظة</button>`:''}</div>`;
 const nx=nextStatus(o.status);
 const foot=`${E&&nx?`<button class="btn btn--olive" data-act="advance" data-id="${o.id}">${ic('check')}نقل إلى: ${STATUS[nx].t}</button>`:''}
  <button class="btn btn--ghost btn--sm" data-act="printInvoice" data-id="${o.id}">${ic('print')}الفاتورة</button>
  <button class="btn btn--ghost btn--sm" data-act="printLabel" data-id="${o.id}">${ic('truck')}بوليصة الشحن</button>
  <button class="btn btn--ghost btn--sm" data-act="notifyCust" data-id="${o.id}">${ic('wa')}إشعار العميل</button>
  ${E&&!['done','cancelled'].includes(o.status)?`<button class="btn btn--danger btn--sm" data-act="cancelOrder" data-id="${o.id}">${ic('x')}إلغاء</button>`:''}
  ${isAdm()?`<button class="btn btn--danger btn--sm" data-act="delOrder" data-id="${o.id}">${ic('trash')}حذف نهائي</button>`:''}`;
 openDrawer(head,body,foot,{type:'order',id:o.id});
}

/* ---------------- REPORTS ---------------- */
function repData(){
 const bk=periodBuckets(UI.repPeriod);const from=bk[0].from,to=bk[bk.length-1].to,span=to-from;
 const cur=inRange(from,to),prev=inRange(from-span,from);
 const ser=bk.map(x=>stats(inRange(x.from,x.to)));
 const prevSer=bk.map(x=>stats(inRange(x.from-span,x.to-span)));
 const prod={};cur.forEach(o=>{if(o.status==='cancelled')return;o.items.forEach(i=>{const k=i.sku;const p=prod[k]||(prod[k]={name:i.name,size:i.size,qty:0,rev:0,cost:0});p.qty+=i.qty;p.rev+=i.price*i.qty;p.cost+=i.cost*i.qty})});
 const prods=Object.values(prod).map(p=>({...p,profit:p.rev-p.cost,margin:p.rev?(p.rev-p.cost)/p.rev*100:0})).sort((a,b)=>b.rev-a.rev);
 const city={};cur.forEach(o=>{if(o.status==='cancelled')return;const c=city[o.city]||(city[o.city]={orders:0,sales:0});c.orders++;c.sales+=oSales(o)});
 const cities=Object.entries(city).map(([k,v])=>({city:k,...v})).sort((a,b)=>b.sales-a.sales);
 const chan=Object.keys(CHANNELS).map(k=>{const L=cur.filter(o=>o.channel===k);const s=stats(L);return{k,name:CHANNELS[k],...s}});
 return{bk,from,to,cur,a:stats(cur),b:stats(prev),ser,prevSer,prods,cities,chan};
}
VIEWS.reports=()=>{
 const D=repData(),a=D.a,b=D.b;const E=canEdit('reports');
 const PL={daily:'آخر 14 يوماً',weekly:'آخر 12 أسبوعاً',monthly:'آخر 6 أشهر'};
 const k=(t,i,v,dec,u,cv,pv,d,inv)=>`<div class="card kpi rise" style="--d:${d}"><div class="lbl"><span class="ic">${ic(i)}</span>${t}</div><div class="val"><span class="num" data-count="${v}" data-dec="${dec}">0</span>${u?`<small>${u}</small>`:''}</div><div class="foot">${delta(cv,pv,inv)}<span>مقابل الفترة السابقة</span></div></div>`;
 const maxP=Math.max(1,...D.prods.map(p=>p.profit));const topProfit=[...D.prods].sort((x,y)=>y.profit-x.profit)[0];
 const totC=D.cities.reduce((s,c)=>s+c.sales,0)||1;
 return `${ph('Profit & Reports','الأرباح <b>والتقارير</b>','المبيعات وصافي الأرباح بعد التكلفة، المنتجات الأكثر مبيعاً وربحاً، ومقارنة الفترات وتقارير المدن والقنوات.',
  `<div class="seg">${Object.entries({daily:'يومي',weekly:'أسبوعي',monthly:'شهري'}).map(([p,t])=>`<button class="${UI.repPeriod===p?'on':''}" data-act="repPeriod" data-v="${p}">${t}</button>`).join('')}</div>
   <button class="btn btn--ghost" data-act="repPDF">${ic('file')}PDF</button><button class="btn btn--olive" data-act="repExcel">${ic('download')}Excel</button>`)}
 <div class="grid g4">
  ${k('المبيعات','cash',a.sales,2,'د.أ',a.sales,b.sales,0)}
  ${k('صافي الربح بعد التكلفة','coin',a.profit,2,'د.أ',a.profit,b.profit,1)}
  ${k('هامش الربح','percent',a.margin,1,'%',a.margin,b.margin,2)}
  ${k('متوسط قيمة الطلب','cart',a.aov,2,'د.أ',a.aov,b.aov,3)}
 </div>
 <div class="card rise" style="--d:4;margin-bottom:18px"><div class="card__h"><h3>${ic('chart')}المبيعات والأرباح — ${PL[UI.repPeriod]}</h3><div class="legend"><span><i style="background:#6E8B3A"></i>المبيعات</span><span><i style="background:#C6A13F"></i>صافي الربح</span><span><i style="background:#2C4D54"></i>مبيعات الفترة السابقة</span></div></div>
  ${areaChart([{label:'المبيعات',values:D.ser.map(s=>s.sales),color:'#6E8B3A',area:true},{label:'صافي الربح',values:D.ser.map(s=>s.profit),color:'#C6A13F',area:true},{label:'الفترة السابقة',values:D.prevSer.map(s=>s.sales),color:'#2C4D54',dash:true}],D.bk.map(x=>x.label),{h:300})}
  <div class="grid g4" style="margin:18px 0 0">${[['الطلبات',fmt0(a.orders),delta(a.orders,b.orders)],['التكلفة',fmt(a.cost)+' د.أ',delta(a.cost,b.cost,true)],['الطلبات الملغاة',fmt0(D.cur.filter(o=>o.status==='cancelled').length),''],['الأعلى ربحاً',esc(topProfit?topProfit.name+' · '+topProfit.size:'—'),'']].map(([t,v,d])=>`<div class="feat" style="padding:14px"><div><small>${t}</small><b class="num" style="font-size:16px">${v}</b>${d}</div></div>`).join('')}</div>
 </div>
 <div class="card rise" style="--d:5;margin-bottom:18px"><div class="card__h"><h3>${ic('star')}المنتجات الأكثر مبيعاً وربحاً</h3><span class="muted sm">${PL[UI.repPeriod]}</span></div>
  ${D.prods.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>المنتج</th><th>الحجم</th><th>الكمية</th><th>المبيعات</th><th>التكلفة</th><th>صافي الربح</th><th>الهامش</th><th style="min-width:140px">مساهمة الربح</th></tr></thead><tbody>
  ${D.prods.map((p,i)=>`<tr><td class="num muted">${i+1}</td><td><b style="font-weight:500">${esc(p.name)}</b></td><td>${esc(p.size)}</td><td class="num">${p.qty}</td><td>${JD(p.rev)}</td><td>${JD(p.cost)}</td><td><b style="color:var(--ok)">${JD(p.profit)}</b></td><td class="num">${p.margin.toFixed(0)}%</td><td><div class="bar" style="grid-template-columns:1fr"><span class="t"><i style="--w:${(p.profit/maxP*100).toFixed(0)}%"></i></span></div></td></tr>`).join('')}
  </tbody></table></div>`:empty('لا توجد مبيعات في هذه الفترة','chart')}</div>
 <div class="grid g2">
  <div class="card rise" style="--d:6"><div class="card__h"><h3>${ic('pin')}تقرير المدن</h3></div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المدينة</th><th>الطلبات</th><th>المبيعات</th><th style="min-width:120px">الحصة</th></tr></thead><tbody>${D.cities.map(c=>`<tr><td>${c.city}</td><td class="num">${c.orders}</td><td>${JD(c.sales)}</td><td><div class="bar" style="grid-template-columns:1fr auto"><span class="t"><i style="--w:${(c.sales/totC*100).toFixed(0)}%"></i></span><b class="num sm">${(c.sales/totC*100).toFixed(0)}%</b></div></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card rise" style="--d:7"><div class="card__h"><h3>${ic('store')}تقرير القنوات والمنصات</h3></div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>القناة</th><th>الطلبات</th><th>المبيعات</th><th>الربح</th><th>متوسط الطلب</th></tr></thead><tbody>${D.chan.map(c=>`<tr><td>${chChip(c.k)}</td><td class="num">${c.orders}</td><td>${JD(c.sales)}</td><td>${JD(c.profit)}</td><td>${JD(c.aov)}</td></tr>`).join('')}</tbody></table></div>
   <div style="margin-top:16px">${barChart(D.chan.map(c=>c.sales),D.chan.map(c=>c.name),'#6E8B3A',{h:200})}</div></div>
 </div>`;
};

/* ---------------- PRODUCTS ---------------- */
function prodList(){
 const E=canEdit('products');const q=UI.prodQ.trim().toLowerCase();
 const L=S.products.filter(p=>(UI.prodCat==='all'||(UI.prodCat==='featured'?p.featured:p.cat===UI.prodCat))&&(!q||p.name.toLowerCase().includes(q)||p.en.toLowerCase().includes(q)));
 if(!L.length)return empty('لا توجد منتجات','cube');
 return `<div class="pgrid">${L.map((p,k)=>{const tot=p.variants.reduce((s,v)=>s+v.stock,0);return `<div class="card pcard rise ${p.active?'':'off'}" style="--acc:${p.acc};--d:${k}">
  <div class="pcard__top"><span class="pcard__cal">${esc(p.cal)}</span><div class="row" style="flex-wrap:nowrap;align-items:flex-start">
   ${p.img?`<img class="pcard__img" src="${esc(p.img)}" alt="">`:`<span class="pcard__img">${ic('drop')}</span>`}
   <div style="flex:1;min-width:0"><span class="cat">${CATS[p.cat]} · <span style="color:${p.acc}">${esc(p.badge)}</span></span><h3>${esc(p.name)}</h3><span class="muted sm" dir="ltr">${esc(p.en)}</span></div>
   ${E?`<button class="ib sm ${p.featured?'on':''}" data-act="togFeat" data-id="${p.id}" title="منتج مميز">${ic('star')}</button>`:p.featured?`<span class="ib sm on">${ic('star')}</span>`:''}
  </div></div>
  ${p.variants.map(v=>{const low=v.stock<=v.low;const m=v.price?((v.price-v.cost)/v.price*100):0;return `<div class="vrow"><div class="meta"><b>${esc(v.size)}</b> <span class="muted sm">· ${fmt(v.price)} د.أ · تكلفة ${fmt(v.cost)} · هامش <span class="num">${m.toFixed(0)}%</span></span>${low?` <span class="chip s-cancel" style="margin-inline-start:4px">مخزون منخفض</span>`:''}</div>
   ${E?`<span class="qty ${low?'low':''}"><button data-act="stk" data-sku="${v.sku}" data-d="-1" aria-label="إنقاص">${ic('minus')}</button><input type="number" min="0" value="${v.stock}" data-chg="stockSet" data-sku="${v.sku}" aria-label="المخزون"><button data-act="stk" data-sku="${v.sku}" data-d="1" aria-label="زيادة">${ic('plus')}</button></span>`:`<b class="num">${v.stock}</b>`}
   <span class="stockbar ${low?'low':''}"><i style="--w:${Math.min(100,v.stock/Math.max(v.low*5,1)*100).toFixed(0)}%"></i></span></div>`}).join('')}
  <div class="pcard__f"><span class="muted sm">إجمالي المخزون: <b class="num" style="color:var(--ink)">${tot}</b></span><span class="sp"></span>${E?`${sw(`data-chg="togActive" data-id="${p.id}" aria-label="ظاهر في المتجر"`,p.active)}<button class="btn btn--sm btn--ghost" data-act="editProd" data-id="${p.id}">${ic('edit')}تعديل</button>`:''}</div>
 </div>`}).join('')}</div>`;
}
VIEWS.products=()=>{
 const E=canEdit('products'),low=lowStock();
 const cats=[['all','الكل'],...Object.entries(CATS),['featured','المميزة']];
 const inv=S.products.reduce((s,p)=>s+p.variants.reduce((a,v)=>a+v.stock*v.cost,0),0);
 const units=S.products.reduce((s,p)=>s+p.variants.reduce((a,v)=>a+v.stock,0),0);
 return `${ph('Products & Inventory','المنتجات <b>والمخزون</b>','أضف وعدّل المنتجات والأحجام والأسعار والصور، وتابع الكميات مع تنبيه تلقائي عند انخفاض المخزون.',E?`<button class="btn btn--olive" data-act="editProd">${ic('plus')}منتج جديد</button>`:'')}
 ${low.length?`<div class="alert rise">${ic('alert')}<div style="flex:1"><b>تنبيه مخزون منخفض:</b> ${low.map(({p,v})=>`${esc(p.name)} (${esc(v.size)}: <span class="num">${v.stock}</span>)`).join('، ')}</div></div>`:''}
 <div class="grid g4">${[['cube','المنتجات النشطة',S.products.filter(p=>p.active).length,0,''],['list','الأحجام والأصناف',S.products.reduce((s,p)=>s+p.variants.length,0),0,''],['box','وحدات في المخزون',units,0,''],['coin','قيمة المخزون (تكلفة)',inv,2,'د.أ']].map(([i,t,v,d,u],k)=>`<div class="card kpi rise" style="--d:${k}"><div class="lbl"><span class="ic">${ic(i==='box'?'cube':i)}</span>${t}</div><div class="val"><span class="num" data-count="${v}" data-dec="${d}">0</span>${u?`<small>${u}</small>`:''}</div></div>`).join('')}</div>
 <div class="toolbar rise"><div class="seg">${cats.map(([k,t])=>`<button class="${UI.prodCat===k?'on':''}" data-act="prodCat" data-v="${k}">${t}</button>`).join('')}</div><label class="search">${ic('search')}<input class="in" data-ui="prodQ" value="${esc(UI.prodQ)}" placeholder="ابحث عن منتج"></label></div>
 <div id="prodList">${prodList()}</div>`;
};
function prodModal(id){
 const p=id?findP(id):{id:'',name:'',en:'',cat:'body',acc:'#6E8B3A',badge:'',cal:'',featured:false,active:true,img:'',desc:'',variants:[{sku:'',size:'',price:0,cost:0,stock:0,low:10}]};
 const vrow=v=>`<div class="vedit" data-v><label class="vf"><small>الحجم</small><input class="in" name="size" value="${esc(v.size)}" placeholder="الحجم"></label><label class="vf"><small>SKU</small><input class="in" name="sku" value="${esc(v.sku)}" placeholder="SKU" dir="ltr"></label><label class="vf"><small>السعر</small><input class="in" name="price" type="number" step="0.05" min="0" value="${v.price}" placeholder="السعر"></label><label class="vf"><small>التكلفة</small><input class="in" name="cost" type="number" step="0.05" min="0" value="${v.cost}" placeholder="التكلفة"></label><label class="vf"><small>المخزون</small><input class="in" name="stock" type="number" min="0" value="${v.stock}" placeholder="المخزون"></label><label class="vf"><small>حد التنبيه</small><input class="in" name="low" type="number" min="0" value="${v.low}" placeholder="حد التنبيه"></label><button class="ib sm" data-act="rmRow" type="button" aria-label="حذف الحجم">${ic('trash')}</button></div>`;
 window.__vrow=vrow;
 openModal(id?'تعديل منتج':'منتج جديد',`<form class="form c2" id="prodForm">
  <label class="field"><span>اسم المنتج (عربي)</span><input class="in" name="name" required value="${esc(p.name)}"></label>
  <label class="field"><span>اسم المنتج (English)</span><input class="in" name="en" dir="ltr" value="${esc(p.en)}"></label>
  <label class="field"><span>التصنيف</span><select class="in" name="cat">${Object.entries(CATS).map(([k,t])=>opt(k,t,p.cat)).join('')}</select></label>
  <label class="field"><span>الشارة</span><input class="in" name="badge" value="${esc(p.badge)}" placeholder="مثال: الأصلي"></label>
  <label class="field"><span>الكلمة الخطية (Aref Ruqaa)</span><input class="in" name="cal" value="${esc(p.cal)}"></label>
  <label class="field"><span>لون المنتج</span><input class="in" name="acc" type="color" value="${esc(p.acc)}" style="padding:4px 8px"></label>
  <label class="field span2"><span>رابط الصورة</span><input class="in" name="img" dir="ltr" value="${esc(p.img)}" placeholder="https://…"></label>
  <label class="field span2"><span>الوصف</span><textarea class="in" name="desc">${esc(p.desc)}</textarea></label>
  <div class="span2"><div class="vedit h"><span>الحجم</span><span>SKU</span><span>السعر</span><span>التكلفة</span><span>المخزون</span><span>حد التنبيه</span><span></span></div><div id="vrows">${p.variants.map(vrow).join('')}</div><button type="button" class="btn btn--sm btn--cream" data-act="addVRow">${ic('plus')}إضافة حجم</button></div>
  <div class="span2 row"><label class="chk"><input type="checkbox" name="featured" ${p.featured?'checked':''}>منتج مميز</label><label class="chk"><input type="checkbox" name="active" ${p.active?'checked':''}>ظاهر في المتجر</label></div>
 </form>`,`<button class="btn btn--olive" data-act="saveProd" data-id="${esc(p.id)}">${ic('check')}حفظ</button>${id?`<button class="btn btn--danger" data-act="delProd" data-id="${p.id}">${ic('trash')}حذف</button>`:''}<button class="btn btn--ghost" data-act="closeAll">إلغاء</button>`);
}

/* ---------------- CUSTOMERS ---------------- */
function custFiltered(){const ag=custAgg();const q=UI.custQ.trim().toLowerCase();
 return S.customers.map(c=>({c,st:ag[c.id],seg:segOf(ag[c.id])})).filter(x=>(UI.custSeg==='all'||x.seg===UI.custSeg)&&(!UI.custSkin||x.c.skin===UI.custSkin)&&(!UI.custCity||x.c.city===UI.custCity)&&(!q||x.c.name.toLowerCase().includes(q)||x.c.phone.includes(q))).sort((a,b)=>(b.st?.spent||0)-(a.st?.spent||0))}
function custList(){const L=custFiltered();if(!L.length)return empty('لا يوجد عملاء مطابقون','users');const shown=L.slice(0,UI.custLimit);
 return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>العميل</th><th>المدينة</th><th>نوع البشرة</th><th>الطلبات</th><th>قيمة العميل</th><th>آخر طلب</th><th>الشريحة</th></tr></thead><tbody>${shown.map(({c,st,seg})=>`<tr class="click" data-act="openCust" data-id="${c.id}"><td><div class="who">${avatar(c.name,'')}<div>${esc(c.name)}<div class="muted sm num">${c.phone}</div></div></div></td><td>${c.city}</td><td>${c.skin}</td><td class="num">${st?.orders||0}</td><td>${JD(st?.spent||0)}</td><td>${st?ago(st.last):'—'}</td><td>${segChip(seg)}</td></tr>`).join('')}</tbody></table></div>
 <div class="more"><span>عرض <span class="num">${shown.length}</span> من <span class="num">${L.length}</span> عميل</span>${L.length>shown.length?`<button class="btn btn--sm btn--ghost" data-act="custMore">عرض المزيد</button>`:''}</div>`}
VIEWS.customers=()=>{
 const E=canEdit('customers');const ag=custAgg();const all=S.customers.map(c=>({c,st:ag[c.id],seg:segOf(ag[c.id])}));
 const seg=s=>all.filter(x=>s==='all'||x.seg===s);const avg=L=>L.length?L.reduce((s,x)=>s+(x.st?.spent||0),0)/L.length:0;
 const skins=SKINS.map((s,i)=>({label:s,value:S.customers.filter(c=>c.skin===s).length,color:['#C6A13F','#8B5430','#4E7A32','#2C4D54','#A9B98F'][i]}));
 return `${ph('Customers · CRM','قاعدة بيانات <b>عملاء</b> <span class="it">أولغا</span>','ملف لكل عميل: بيانات التواصل والعناوين وسجل المشتريات، ونوع البشرة والاهتمامات المستخلصة من محادثات شمس.',
  `<button class="btn btn--ghost" data-act="exportCust">${ic('download')}تصدير</button>${E?`<button class="btn btn--olive" data-act="custModal">${ic('userplus')}عميل جديد</button>`:''}`)}
 <div class="grid g4">${[['all','كل العملاء','users'],['new','عملاء جدد','userplus'],['rep','عملاء متكررون','refresh'],['vip','عملاء مميزون','star']].map(([k,t,i],n)=>`<button class="card kpi rise" style="--d:${n};text-align:start;${UI.custSeg===k?'box-shadow:0 0 0 2px var(--olive),var(--shadow-2)':''}" data-act="custSeg" data-v="${k}"><div class="lbl"><span class="ic">${ic(i)}</span>${t}</div><div class="val"><span class="num" data-count="${seg(k).length}">0</span></div><div class="foot">متوسط القيمة <b class="num" style="color:var(--ink)">${fmt(avg(seg(k)))}</b> د.أ</div></button>`).join('')}</div>
 <div class="grid g-main">
  <div class="card rise" style="--d:4"><div class="toolbar"><label class="search">${ic('search')}<input class="in" data-ui="custQ" value="${esc(UI.custQ)}" placeholder="الاسم أو رقم الهاتف"></label>${sel('custCity',[['','كل المدن'],...CITIES.map(c=>[c,c])])}${sel('custSkin',[['','كل أنواع البشرة'],...SKINS.map(s=>[s,s])])}</div><div id="custList">${custList()}</div></div>
  <div class="stack"><div class="card rise" style="--d:5"><div class="card__h"><h3>${ic('drop')}أنواع البشرة</h3><span class="muted sm">من محادثات شمس</span></div>${donut(skins,S.customers.length,'عميل')}</div>
   <div class="card rise" style="--d:6"><div class="card__h"><h3>${ic('pin')}العملاء حسب المدينة</h3></div>${(()=>{const r=CITIES.map(c=>({label:c,value:S.customers.filter(x=>x.city===c).length})).filter(x=>x.value).sort((a,b)=>b.value-a.value).slice(0,6);return bars(r,Math.max(...r.map(x=>x.value)))})()}</div></div>
 </div>`;
};
function custDrawer(c){
 const E=canEdit('customers');const ag=custAgg()[c.id];const seg=segOf(ag);
 const orders=S.orders.filter(o=>o.cid===c.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
 const head=`${avatar(c.name,'lg dk')}<div style="flex:1"><h3>${esc(c.name)}</h3><div class="row">${segChip(seg)}<span class="muted sm">عميل منذ ${fdate(c.createdAt)}</span></div></div>`;
 const body=`<div class="grid g3" style="margin-bottom:22px">${[['الطلبات',fmt0(ag?.orders||0)],['قيمة العميل',fmt(ag?.spent||0)],['متوسط الطلب',fmt(ag?ag.spent/ag.orders:0)]].map(([t,v])=>`<div class="feat" style="padding:14px;display:block"><small>${t}</small><b class="num" style="font-size:18px">${v}</b></div>`).join('')}</div>
 <div class="blk"><h4>${ic('phone')}التواصل والعناوين</h4><div class="box"><dl class="kv"><dt>الهاتف</dt><dd class="num" style="text-align:start">${c.phone}</dd><dt>المدينة</dt><dd>${c.city}</dd><dt>المصدر</dt><dd>${CHANNELS[c.source]||'—'}</dd></dl><hr class="sep">${c.addresses.map(a=>`<div class="row muted sm">${ic('pin')}${esc(a)}</div>`).join('')}
  <div class="row" style="margin-top:12px"><a class="btn btn--sm btn--ghost" href="tel:${c.phone}">${ic('phone')}اتصال</a><a class="btn btn--sm btn--ghost" target="_blank" rel="noopener" href="https://wa.me/962${c.phone.replace(/^0/,'')}">${ic('wa')}واتساب</a></div></div></div>
 <div class="blk"><h4>${ic('chat')}نوع البشرة والاهتمامات <span class="chip plain" style="background:var(--cream);color:var(--gold-deep)">مستخلصة من محادثات شمس</span></h4><div class="box"><div class="row" style="margin-bottom:10px"><span class="muted">نوع البشرة:</span><b style="font-weight:500">${c.skin}</b></div><div class="tagl">${c.interests.map(i=>`<span class="chip plain g-rep">${esc(i)}</span>`).join('')}</div></div></div>
 <div class="blk"><h4>${ic('cart')}سجل المشتريات</h4>${orders.length?`<div class="box" style="padding:6px 14px"><div class="lines">${orders.map(o=>`<div style="cursor:pointer" data-act="openOrder" data-id="${o.id}"><span><b class="num">#${o.id}</b> <span class="muted sm">· ${fdate(o.date)} · ${o.items.map(i=>esc(i.name)).join('، ')}</span></span><span class="row" style="flex-wrap:nowrap">${JD(o.total)}${stChip(o.status)}</span></div>`).join('')}</div></div>`:empty('لا توجد مشتريات بعد','cart')}</div>
 <div class="blk"><h4>${ic('edit')}ملاحظات</h4><textarea class="in" id="cNotes" ${E?'':'disabled'} placeholder="تفضيلات العميل، مناسبات، ملاحظات خاصة…">${esc(c.notes)}</textarea></div>`;
 const foot=E?`<button class="btn btn--olive" data-act="saveCustNotes" data-id="${c.id}">${ic('check')}حفظ الملاحظات</button><button class="btn btn--ghost" data-act="custModal" data-id="${c.id}">${ic('edit')}تعديل البيانات</button>`:'';
 openDrawer(head,body,foot,{type:'cust',id:c.id});
}
function custModal(id){const c=id?findC(id):{name:'',phone:'',city:'عمّان',addresses:[''],skin:'عادية',interests:[],notes:''};
 openModal(id?'تعديل بيانات العميل':'عميل جديد',`<form class="form c2" id="custForm">
 <label class="field"><span>الاسم الكامل</span><input class="in" name="name" required value="${esc(c.name)}"></label>
 <label class="field"><span>رقم الهاتف</span><input class="in" name="phone" required dir="ltr" value="${esc(c.phone)}" placeholder="07XXXXXXXX"></label>
 <label class="field"><span>المدينة</span><select class="in" name="city">${CITIES.map(x=>opt(x,x,c.city)).join('')}</select></label>
 <label class="field"><span>نوع البشرة</span><select class="in" name="skin">${SKINS.map(x=>opt(x,x,c.skin)).join('')}</select></label>
 <label class="field span2"><span>العنوان</span><input class="in" name="address" value="${esc(c.addresses[0]||'')}"></label>
 <label class="field span2"><span>الاهتمامات (افصل بفاصلة)</span><input class="in" name="interests" value="${esc(c.interests.join('، '))}"></label></form>`,
 `<button class="btn btn--olive" data-act="saveCust" data-id="${id||''}">${ic('check')}حفظ</button><button class="btn btn--ghost" data-act="closeAll">إلغاء</button>`)}

/* ---------------- MARKETING ---------------- */
VIEWS.marketing=()=>{
 const E=canEdit('marketing');const T=UI.mkTab;
 const tabs=[['coupons','tag','أكواد الخصم'],['offers','gift','العروض الموسمية'],['push','mega','إشعارات التطبيق'],['content','image','المحتوى والبنرات']];
 let inner='';
 if(T==='coupons'){
  inner=`<div class="card rise"><div class="card__h"><h3>${ic('tag')}أكواد الخصم</h3>${E?`<button class="btn btn--sm btn--olive" data-act="couponModal">${ic('plus')}كود جديد</button>`:''}</div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الكود</th><th>الوصف</th><th>الخصم</th><th>حد أدنى</th><th style="min-width:150px">الاستخدام</th><th>ينتهي</th><th>فعّال</th><th></th></tr></thead><tbody>
  ${S.coupons.map((c,i)=>{const exp=c.expires&&+new Date(c.expires)<Date.now();return `<tr><td><span class="code">${esc(c.code)}</span></td><td>${esc(c.desc)}</td><td class="num">${c.type==='pct'?c.value+'%':fmt(c.value)+' د.أ'}</td><td class="num">${c.min?fmt(c.min):'—'}</td><td><div class="bar" style="grid-template-columns:1fr auto"><span class="t"><i style="--w:${c.limit?Math.min(100,c.used/c.limit*100).toFixed(0):0}%"></i></span><b class="num sm">${c.used}/${c.limit}</b></div></td><td>${exp?'<span class="chip s-cancel">منتهي</span>':c.expires?fdate(c.expires):'بلا انتهاء'}</td><td>${E?sw(`data-chg="togCoupon" data-i="${i}"`,c.active):c.active?'نعم':'لا'}</td><td>${E?`<button class="ib sm" data-act="couponModal" data-i="${i}">${ic('edit')}</button><button class="ib sm" data-act="delCoupon" data-i="${i}">${ic('trash')}</button>`:''}</td></tr>`}).join('')}</tbody></table></div></div>`;
 }else if(T==='offers'){
  inner=`<div class="card rise"><div class="card__h"><h3>${ic('gift')}العروض الموسمية وأسعار المجموعات الخاصة</h3>${E?`<button class="btn btn--sm btn--olive" data-act="offerModal">${ic('plus')}عرض جديد</button>`:''}</div>
  <div class="grid g3" style="margin:0">${S.offers.map((o,i)=>{const now=Date.now(),live=o.active&&(!o.from||+new Date(o.from)<=now)&&(!o.to||+new Date(o.to)>=now);return `<div class="feat" style="display:block;${live?'background:var(--sage-soft)':''}"><div class="row"><span class="chip ${live?'s-done':o.active?'s-new':'s-cancel'}">${live?'يعمل الآن':o.active?'مجدول':'متوقف'}</span><span class="sp"></span><b class="num" style="font-size:22px;color:var(--olive-deep)">-${o.pct}%</b></div><b style="margin-top:10px">${esc(o.name)}</b><small>${o.from?fdate(o.from):'—'} — ${o.to?fdate(o.to):'—'}</small><div class="tagl" style="margin-top:10px">${o.products.slice(0,4).map(id=>`<span class="chip plain">${esc(findP(id)?.name||id)}</span>`).join('')}${o.products.length>4?`<span class="chip plain">+${o.products.length-4}</span>`:''}</div>${E?`<div class="row" style="margin-top:14px">${sw(`data-chg="togOffer" data-i="${i}"`,o.active)}<span class="sp"></span><button class="btn btn--sm btn--ghost" data-act="offerModal" data-i="${i}">${ic('edit')}تعديل</button><button class="ib sm" data-act="delOffer" data-i="${i}">${ic('trash')}</button></div>`:''}</div>`}).join('')}</div></div>`;
 }else if(T==='push'){
  inner=`<div class="grid g-main"><div class="card rise"><div class="card__h"><h3>${ic('mega')}إرسال إشعار لمستخدمي التطبيق</h3><span class="muted sm">Android & iOS</span></div>
   <form class="form" id="pushForm"><label class="field"><span>عنوان الإشعار</span><input class="in" name="title" maxlength="60" data-live="push" value="عرض جديد من أولغا 🌿"></label>
   <label class="field"><span>نص الإشعار</span><textarea class="in" name="body" maxlength="180" data-live="push">خصم 15% على ثنائي الشيا — لفترة محدودة. اطلبي الآن!</textarea></label>
   <label class="field"><span>الجمهور المستهدف</span><select class="in" name="audience">${[['all','كل مستخدمي التطبيق'],['vip','العملاء المميزون'],['inactive','لم يطلبوا منذ 30 يوماً'],['ios','مستخدمو iOS'],['android','مستخدمو Android']].map(([v,t])=>opt(v,t,'all')).join('')}</select></label>
   ${E?`<button type="button" class="btn btn--olive" data-act="sendPush">${ic('send')}حفظ في سجل الإشعارات</button><p class="muted sm">الإرسال الفعلي لهواتف العملاء يحتاج ربط تطبيق أولغا بخدمة الإشعارات.</p>`:''}</form>
   <hr class="sep"><div class="card__h"><h3>سجل الإشعارات</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الإشعار</th><th>الجمهور</th><th>الوصول</th><th>نسبة الفتح</th><th>التاريخ</th></tr></thead><tbody>${S.pushes.map(x=>`<tr><td><b style="font-weight:500">${esc(x.title)}</b><div class="muted sm" style="white-space:normal;max-width:280px">${esc(x.body)}</div></td><td>${({all:'الكل',vip:'المميزون',inactive:'غير النشطين',ios:'iOS',android:'Android'})[x.audience]||x.audience}</td><td class="num">${x.reach?fmt0(x.reach):'—'}</td><td class="num">${x.reach?(x.opens/x.reach*100).toFixed(0)+'%':'—'}</td><td>${fdate(x.sent)}</td></tr>`).join('')}</tbody></table></div></div>
   <div class="card rise" style="--d:1"><div class="card__h"><h3>${ic('mobile')}معاينة على الهاتف</h3></div><div class="phone"><div class="clock num">${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div><div class="date">${new Date().toLocaleDateString('ar-JO-u-nu-latn',{weekday:'long',day:'numeric',month:'long'})}</div><div class="pnote" id="pnote"><div class="row"><span class="app-ic"><svg viewBox="0 0 1260 726"><use href="#olga-logo"/></svg></span><span class="muted sm">أولغا · الآن</span></div><b id="pnT">عرض جديد من أولغا 🌿</b><div id="pnB">خصم 15% على ثنائي الشيا — لفترة محدودة. اطلبي الآن!</div></div></div></div></div>`;
 }else{
  const C=S.content;
  inner=`<div class="grid g2"><div class="card rise"><div class="card__h"><h3>${ic('mega')}الشريط العلوي للمتجر</h3></div><div class="barprev" style="margin-bottom:16px"><i></i><span id="barPrev">${esc(C.bar[0]||'')}</span></div>
   <form class="form" id="barForm">${[0,1,2].map(i=>`<label class="field"><span>الرسالة ${i+1}</span><input class="in" name="bar${i}" value="${esc(C.bar[i]||'')}" ${E?'':'disabled'}></label>`).join('')}${E?`<button type="button" class="btn btn--olive" data-act="saveBar">${ic('check')}حفظ ونشر</button>`:''}</form></div>
   <div class="card rise" style="--d:1"><div class="card__h"><h3>${ic('image')}بنرات الواجهة</h3>${E?`<button class="btn btn--sm btn--olive" data-act="bannerModal">${ic('plus')}بنر جديد</button>`:''}</div>
   ${C.banners.length?'':empty('لا توجد بنرات بعد','image')}${C.banners.map((b,i)=>`<div style="margin-bottom:14px"><div class="hero-prev" style="${b.active?'':'filter:grayscale(.8);opacity:.6'}"><span class="eyebrow en" style="color:var(--gold-soft)">Banner ${i+1}</span><h4>${esc(b.title)}</h4><p>${esc(b.sub)}</p><span><span class="btn btn--sm btn--olive">${esc(b.cta)}</span></span></div>${E?`<div class="row" style="margin-top:8px">${sw(`data-chg="togBanner" data-i="${i}"`,b.active)}<span class="muted sm">${b.active?'ظاهر في المتجر':'مخفي'}</span><span class="sp"></span><button class="btn btn--sm btn--ghost" data-act="bannerModal" data-i="${i}">${ic('edit')}تعديل</button><button class="ib sm" data-act="delBanner" data-i="${i}">${ic('trash')}</button></div>`:''}</div>`).join('')}</div></div>`;
 }
 return `${ph('Marketing & Offers','التسويق <b>والعروض</b>','أكواد خصم وعروض موسمية وأسعار خاصة للمجموعات، إشعارات العروض لمستخدمي التطبيق، وإدارة محتوى الواجهة والبنرات بدون مبرمج.')}
 <div class="tabs rise">${tabs.map(([k,i,t])=>`<button class="${T===k?'on':''}" data-act="mkTab" data-v="${k}">${ic(i)}${t}</button>`).join('')}</div>${inner}`;
};

/* ---------------- SHAMS ---------------- */
VIEWS.shams=()=>{
 const E=canEdit('shams');const sh=S.shams;
 const so=S.orders.filter(o=>o.channel==='shams'&&o.status!=='cancelled');
 const conv=sh.conversations?so.length/sh.conversations*100:0;const qMax=Math.max(1,...sh.questions.map(q=>q.n));
 const recs=S.products.map(p=>{const n=so.filter(o=>o.items.some(i=>i.pid===p.id)).length;const r=sh.recs[p.id]||0;return{p,r,n,c:r?n/r*100:0}}).sort((a,b)=>b.r-a.r);
 const needs=sh.needs.map((x,i)=>({label:x.t,value:x.n,color:['#C6A13F','#8B5430','#6E8B3A','#2C4D54','#7C1D2B'][i%5]}));
 return `${ph('Shams AI · Business Insights','ذكاء الأعمال من <span class="it">«شمس»</span>','أكثر أسئلة العملاء واحتياجاتهم، المنتجات التي ترشّحها شمس ونسبة تحويلها إلى طلبات، وتحديث معلوماتها وأسعارها من هنا مباشرة.')}
 <div class="shams-hd rise"><span class="orb">${ic('spark')}</span><div style="flex:1"><h2>«شمس» تعمل الآن <span class="it">على مدار الساعة</span></h2><p>آخر مزامنة للأسعار والمعلومات: ${sh.syncedAt?fdt(sh.syncedAt):'لم تتم بعد'}</p></div><span class="live"><i></i><span>متصلة</span></span></div>
 <div class="grid g4">${[['chat','المحادثات (90 يوماً)',sh.conversations,0,''],['percent','نسبة التحويل إلى طلبات',conv,1,'%'],['cart','طلبات عبر شمس',so.length,0,''],['clock','متوسط زمن الرد',sh.avgReply,1,'ث']].map(([i,t,v,d,u],k)=>`<div class="card kpi rise" style="--d:${k}"><div class="lbl"><span class="ic">${ic(i)}</span>${t}</div><div class="val"><span class="num" data-count="${v}" data-dec="${d}">0</span>${u?`<small>${u}</small>`:''}</div></div>`).join('')}</div>
 <div class="grid g-main">
  <div class="card rise" style="--d:4"><div class="card__h"><h3>${ic('chat')}أكثر أسئلة العملاء تكراراً</h3></div>${sh.questions.length?bars(sh.questions.map(q=>({label:`<span style="white-space:normal">${esc(q.q)}</span>`,value:q.n,color:'var(--grad-oil)'})),qMax,'wide'):empty('لا توجد بيانات أسئلة بعد','chat')}</div>
  <div class="card rise" style="--d:5"><div class="card__h"><h3>${ic('drop')}احتياجات العملاء</h3></div>${needs.length?donut(needs,sh.needs.reduce((s,x)=>s+x.n,0)+'%','من المحادثات'):empty('لا توجد بيانات احتياجات بعد','drop')}</div>
 </div>
 <div class="card rise" style="--d:6;margin-bottom:18px"><div class="card__h"><h3>${ic('star')}المنتجات التي ترشّحها شمس ونسبة التحويل</h3></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المنتج</th><th>مرات الترشيح</th><th>طلبات ناتجة</th><th style="min-width:180px">نسبة التحويل</th></tr></thead><tbody>${recs.map(x=>`<tr><td><b style="font-weight:500">${esc(x.p.name)}</b></td><td class="num">${x.r}</td><td class="num">${x.n}</td><td><div class="bar" style="grid-template-columns:1fr auto"><span class="t"><i style="--w:${Math.min(100,x.c*5).toFixed(0)}%;--c:var(--grad-oil)"></i></span><b class="num sm">${x.c.toFixed(1)}%</b></div></td></tr>`).join('')}</tbody></table></div></div>
 <div class="grid g2">
  <div class="card rise" style="--d:7"><div class="card__h"><h3>${ic('edit')}معلومات شمس</h3></div><textarea class="in" id="shKnow" style="min-height:170px" ${E?'':'disabled'}>${esc(sh.knowledge)}</textarea>
   <div class="card__h" style="margin:18px 0 10px"><h3>الأسئلة الشائعة</h3>${E?`<button class="btn btn--sm btn--cream" data-act="addFaq">${ic('plus')}سؤال</button>`:''}</div>
   <div id="faqList">${sh.faq.map((f,i)=>`<div class="box" style="margin-bottom:10px" data-faq><input class="in" value="${esc(f.q)}" data-k="q" placeholder="السؤال" ${E?'':'disabled'} style="margin-bottom:8px"><textarea class="in" data-k="a" style="min-height:64px" placeholder="الجواب" ${E?'':'disabled'}>${esc(f.a)}</textarea>${E?`<button class="btn btn--sm btn--danger" style="margin-top:8px" data-act="rmFaq">${ic('trash')}حذف</button>`:''}</div>`).join('')}</div>
   ${E?`<button class="btn btn--olive" data-act="saveShams">${ic('check')}حفظ معلومات شمس</button>`:''}</div>
  <div class="card rise" style="--d:8"><div class="card__h"><h3>${ic('refresh')}الأسعار التي تعرفها شمس</h3>${E?`<button class="btn btn--sm btn--olive" data-act="syncShams">${ic('refresh')}مزامنة مع المتجر</button>`:''}</div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المنتج</th><th>الحجم</th><th>السعر في المتجر</th><th>لدى شمس</th></tr></thead><tbody>${S.products.flatMap(p=>p.variants.map(v=>{const k=(sh.prices||{})[v.sku];const diff=k!==undefined&&k!==v.price;return `<tr><td>${esc(p.name)}</td><td>${esc(v.size)}</td><td>${JD(v.price)}</td><td>${k===undefined?'<span class="chip s-new">غير متزامن</span>':diff?`<span class="chip s-cancel">${fmt(k)}</span>`:`<span class="chip s-done">${fmt(k)}</span>`}</td></tr>`})).join('')}</tbody></table></div></div>
 </div>`;
};

/* ---------------- USERS ---------------- */
VIEWS.users=()=>{
 const E=canEdit('users');const T=UI.usrTab;
 const tabs=[['staff','users','الحسابات'],['perms','shield','الصلاحيات'],['log','clock','سجل العمليات']];
 let inner='';
 if(T==='staff')inner=`<div class="card rise"><div class="card__h"><h3>${ic('users')}حسابات الفريق</h3>${E?`<button class="btn btn--sm btn--olive" data-act="staffModal">${ic('userplus')}حساب جديد</button>`:''}</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>آخر نشاط</th><th>الحالة</th><th></th></tr></thead><tbody>${S.staff.map(u=>`<tr><td><div class="who">${avatar(u.name,u.role==='admin'?'dk':'')}${esc(u.name)}${u.id===ME.id?' <span class="chip plain">أنت</span>':''}</div></td><td dir="ltr" style="text-align:end">${esc(u.email)}</td><td>${ROLES[u.role]}</td><td>${u.last?ago(u.last):'—'}</td><td>${u.active?'<span class="chip s-done">فعّال</span>':'<span class="chip s-cancel">موقوف</span>'}</td><td>${E?`<button class="ib sm" data-act="staffModal" data-id="${u.id}">${ic('edit')}</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`;
 else if(T==='perms')inner=`<div class="card rise"><div class="card__h"><h3>${ic('shield')}مصفوفة الصلاحيات</h3><span class="muted sm">المدير العام يملك كل الصلاحيات دائماً</span></div><div class="tbl-wrap"><table class="tbl matrix"><thead><tr><th>القسم</th><th>${ROLES.admin}</th><th>${ROLES.accountant}</th><th>${ROLES.orders}</th></tr></thead><tbody>${MODULES.map(m=>`<tr><td>${ic(m.ic)} ${m.t}</td><td><span class="chip s-done">${PERM_T.edit}</span></td>${['accountant','orders'].map(r=>`<td>${E?`<select class="in" data-chg="perm" data-r="${r}" data-m="${m.id}">${Object.entries(PERM_T).map(([k,t])=>opt(k,t,S.perms[r][m.id]||'none')).join('')}</select>`:PERM_T[S.perms[r][m.id]||'none']}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
 else inner=`<div class="card rise"><div class="card__h"><h3>${ic('clock')}سجل كامل بالعمليات</h3><button class="btn btn--sm btn--ghost" data-act="exportLog">${ic('download')}تصدير</button></div><div class="tl" style="margin-top:6px">${S.log.length?'':empty('لا توجد عمليات مسجلة بعد','clock')}${S.log.slice(0,80).map(l=>`<div><b style="font-weight:500">${esc(l.who)}</b> — ${esc(l.msg)} <div class="muted sm">${fdt(l.at)}</div></div>`).join('')}</div></div>`;
 return `${ph('Users & Permissions','المستخدمون <b>والصلاحيات</b>','حسابات منفصلة للمدير والمحاسب وموظف الطلبات، لكل منها صلاحيات محددة وسجل كامل بالعمليات.')}<div class="tabs rise">${tabs.map(([k,i,t])=>`<button class="${T===k?'on':''}" data-act="usrTab" data-v="${k}">${ic(i)}${t}</button>`).join('')}</div>${inner}`;
};

/* ---------------- SETTINGS ---------------- */
VIEWS.settings=()=>{
 const st=S.settings;const E=canEdit('settings');
 return `${ph('Settings','الإعدادات','بيانات المتجر والتوصيل والتنبيهات والنسخ الاحتياطي.')}
 <div class="grid g2">
  <div class="card rise"><div class="card__h"><h3>${ic('store')}بيانات المتجر</h3></div><form class="form c2" id="setForm">
   <label class="field"><span>اسم المتجر</span><input class="in" name="storeName" value="${esc(st.storeName)}"></label>
   <label class="field"><span>رقم واتساب الطلبات</span><input class="in" name="whatsapp" dir="ltr" value="${esc(st.whatsapp)}"></label>
   <label class="field"><span>البريد الإلكتروني</span><input class="in" name="email" dir="ltr" value="${esc(st.email)}"></label>
   <label class="field"><span>رابط المتجر</span><input class="in" name="storeUrl" dir="ltr" value="${esc(st.storeUrl)}"></label>
   <label class="field"><span>التوصيل داخل عمّان (د.أ)</span><input class="in" name="deliveryAmman" type="number" step="0.5" value="${st.deliveryAmman}"></label>
   <label class="field"><span>التوصيل للمحافظات (د.أ)</span><input class="in" name="deliveryOther" type="number" step="0.5" value="${st.deliveryOther}"></label>
   ${E?`<div class="span2"><button type="button" class="btn btn--olive" data-act="saveSettings">${ic('check')}حفظ الإعدادات</button></div>`:''}</form></div>
  <div class="stack">
   <div class="card rise" style="--d:1"><div class="card__h"><h3>${ic('bell')}التنبيهات</h3></div>
    <div class="swl"><div><b>استقبال الطلبات اللحظي</b><small>تحديث تلقائي كل 20 ثانية لعرض الطلبات الجديدة فور وصولها</small></div>${sw('data-chg="setFlag" data-k="live"',st.live)}</div>
    <div class="swl"><div><b>صوت التنبيه</b><small>نغمة قصيرة عند وصول طلب جديد</small></div>${sw('data-chg="setFlag" data-k="sound"',st.sound)}</div>
    <div class="swl" style="border:0"><div><b>إشعار العميل تلقائياً</b><small>عند تغيير مرحلة الطلب</small></div>${sw('data-chg="setFlag" data-k="autoNotify"',st.autoNotify)}</div></div>
   <div class="card rise" style="--d:2"><div class="card__h"><h3>${ic('db')}البيانات والنسخ الاحتياطي</h3></div><p class="muted sm" style="margin-bottom:14px">كل البيانات محفوظة في قاعدة بيانات Supabase ومتزامنة بين كل الأجهزة والموظفين.</p>
    <div class="row"><button class="btn btn--sm btn--ghost" data-act="backup">${ic('download')}نسخة احتياطية</button><button class="btn btn--sm btn--ghost" data-act="reloadData">${ic('refresh')}تحديث البيانات</button></div></div>
  </div>
 </div>`;
};
/* =====================================================================
   SHELL · ACTIONS · BOOT
   ===================================================================== */
let DR=null;
function render(){
 const r=(location.hash.replace(/^#\/?/,'')||'home').split('?')[0];
 route=MODULES.some(m=>m.id===r&&can(m.id))?r:(MODULES.find(m=>can(m.id))||{id:'home'}).id;
 const m=MODULES.find(x=>x.id===route);
 $('#pgTitle').textContent=m.t;$('#pgEyebrow').textContent=m.en;document.title=`${m.t} — لوحة تحكم أولغا`;
 renderNav();
 const v=$('#view');v.innerHTML=VIEWS[route]();v.classList.remove('swap');void v.offsetWidth;v.classList.add('swap');
 afterRender(v);
}
function soft(){ // re-render current view without jumping, unless the user is typing in it
 const a=document.activeElement;if(a&&$('#view').contains(a)&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;
 const y=scrollY;const v=$('#view');v.innerHTML=VIEWS[route]();afterRender(v);v.querySelectorAll('.rise').forEach(e=>e.style.animation='none');scrollTo(0,y);
}
function renderNav(){
 const nN=S.orders.filter(o=>o.status==='new').length,lN=lowStock().length;
 $('#nav').innerHTML=MODULES.filter(m=>can(m.id)).map(m=>`<a href="#/${m.id}" class="${route===m.id?'on':''}">${ic(m.ic)}<span>${m.t}</span>${m.id==='orders'&&nN?`<em class="badge">${nN}</em>`:''}${m.id==='products'&&lN?`<em class="badge red">${lN}</em>`:''}</a>`).join('');
 const BN=['home','orders','products','customers'],SHORT={home:'الرئيسية',orders:'الطلبات',reports:'التقارير',products:'المنتجات',customers:'العملاء',marketing:'العروض',shams:'شمس',users:'الفريق',settings:'الإعدادات'};
 const al=MODULES.filter(m=>can(m.id)),pick=[...BN.map(id=>al.find(m=>m.id===id)).filter(Boolean),...al.filter(m=>!BN.includes(m.id))].slice(0,4);
 $('#bnav').innerHTML=pick.map(m=>`<a href="#/${m.id}" class="${route===m.id?'on':''}" ${route===m.id?'aria-current="page"':''}>${ic(m.ic)}<span>${SHORT[m.id]||m.t}</span>${m.id==='orders'&&nN?`<em>${nN}</em>`:''}${m.id==='products'&&lN?`<em class="red">${lN}</em>`:''}</a>`).join('')+(al.length>pick.length?`<button type="button" data-act="navToggle" class="${pick.some(m=>m.id===route)?'':'on'}"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg><span>المزيد</span></button>`:'');
 const un=S.notifs.filter(n=>!n.read).length,b=$('#bellN');b.textContent=un;b.classList.toggle('hide',!un);
 $('#livePill').classList.toggle('off',!S.settings.live);
 $('#storeLink').href=S.settings.storeUrl||'olga.html';
}
function openDrawer(head,body,foot,ctx){const d=$('#drawer');d.innerHTML=`<div class="drawer__h">${head}<button class="ib" data-act="closeAll" aria-label="إغلاق">${ic('x')}</button></div><div class="drawer__b">${body}</div>${foot?`<div class="drawer__f">${foot}</div>`:''}`;d.classList.add('on');$('#scrim').classList.add('on');DR=ctx||null;afterRender(d)}
function openModal(title,body,foot){$('#modalBox').innerHTML=`<div class="modal__h"><h3>${title}</h3><button class="ib" data-act="closeModal" aria-label="إغلاق">${ic('x')}</button></div><div class="modal__b">${body}</div>${foot?`<div class="modal__f">${foot}</div>`:''}`;$('#modal').classList.add('on');$('#scrim').classList.add('on');setTimeout(()=>$('#modalBox input,#modalBox select')?.focus(),300)}
function closeModal(){$('#modal').classList.remove('on');if(!$('#drawer').classList.contains('on')&&!$('#app').classList.contains('nav-open'))$('#scrim').classList.remove('on')}
function closeAll(){$('#drawer').classList.remove('on');$('#modal').classList.remove('on');$('#scrim').classList.remove('on');$('#app').classList.remove('nav-open');DR=null;$$('.pop').forEach(p=>p.classList.remove('on'))}
function refreshDrawer(){if(!DR||!$('#drawer').classList.contains('on'))return;const sc=$('.drawer__b')?.scrollTop||0;if(DR.type==='order'){const o=findO(DR.id);o&&orderDrawer(o)}else if(DR.type==='cust'){const c=findC(DR.id);c&&custDrawer(c)}const b=$('.drawer__b');if(b)b.scrollTop=sc}
function toast(title,sub='',o={}){const el=document.createElement('div');el.className='toast '+(o.tone||'');el.innerHTML=`<span class="ic">${ic(o.icon||'check')}</span><div style="flex:1;min-width:0"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>${o.act?`<button class="btn btn--sm btn--light">${o.label||'عرض'}</button>`:''}`;const kill=()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)};if(o.act)el.querySelector('button').onclick=()=>{o.act();kill()};$('#toasts').appendChild(el);setTimeout(kill,o.act?7000:3600)}
function log(msg){const who=ME?ME.name:'النظام';S.log.unshift({at:iso(Date.now()),who,msg});S.log=S.log.slice(0,400);if(ME)sb.from('activity_log').insert({who,msg}).then(r=>{if(r.error)console.warn(r.error)})}
function notify(type,text,ref){S.notifs.unshift({id:Date.now()+Math.random(),at:iso(Date.now()),type,text,ref,read:false});S.notifs=S.notifs.slice(0,60);const b=$('#bellN');b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')}
let AC;function chime(){if(!S.settings.sound)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const t=AC.currentTime;[880,1318.5].forEach((f,i)=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;const s=t+i*.14;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.16,s+.02);g.gain.exponentialRampToValueAtTime(.001,s+.5);o.connect(g).connect(AC.destination);o.start(s);o.stop(s+.55)})}catch(e){}}
const save=()=>{DB.save();renderNav()};

/* ---------- order operations ---------- */
const lowSet=()=>new Set(lowStock().map(x=>x.v.sku));
async function createOrder({cid,name,phone,city,address,channel,payment,items,coupon,notes}){
 let c=cid?findC(cid):null;
 if(!c){
  const{data,error}=await sb.from('customers').insert({name:name.trim(),phone:phone.trim(),city,addresses:[address||city],source:channel}).select().single();
  if(error){toast('تعذّر حفظ العميل',errMsg(error),{tone:'red',icon:'x'});return null}
  c=MAP.cust(data);S.customers.push(c);
 }
 const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);let discount=0,code='';
 const cp=coupon&&S.coupons.find(x=>x.code.toUpperCase()===coupon.toUpperCase()&&x.active&&(!x.expires||+new Date(x.expires)>Date.now())&&x.used<x.limit);
 if(cp&&subtotal>=cp.min){code=cp.code;discount=Math.min(subtotal,cp.type==='pct'?+(subtotal*cp.value/100).toFixed(2):cp.value)}
 const delivery=c.city==='عمّان'?+S.settings.deliveryAmman:+S.settings.deliveryOther;
 const row={customer_id:c.id,name:c.name,phone:c.phone,city:c.city,address:address||c.addresses[0]||c.city,channel,items,subtotal,discount,coupon:code,delivery,
  total:+(subtotal-discount+delivery).toFixed(2),payment,status:'new',history:[{s:'new',at:iso(Date.now()),by:ME.name}],notes:notes||''};
 const{data,error}=await sb.from('orders').insert(row).select().single();
 if(error){toast('تعذّر إنشاء الطلب',errMsg(error),{tone:'red',icon:'x'});return null}
 const o=MAP.order(data);o._fresh=true;S.orders.push(o);S._cur=maxStr(S._cur,data.updated_at);
 if(code)cp.used++; /* the database also counts the coupon use and lowers the stock */
 items.forEach(i=>{const v=findP(i.pid)?.variants.find(x=>x.sku===i.sku);if(v){const was=v.stock>v.low;v.stock=Math.max(0,v.stock-i.qty);if(was&&v.stock<=v.low)notify('stock',`مخزون منخفض: ${i.name} · ${i.size} (${v.stock})`,i.pid)}});
 notify('order',`طلب جديد #${o.id} من ${c.city} — ${fmt(o.total)} د.أ (${CHANNELS[channel]})`,o.id);
 log(`أضاف طلباً جديداً #${o.id}`);
 DB.save();setTimeout(()=>{delete o._fresh},3000);
 return o;
}
function setStatus(o,s){
 if(o.status===s)return;const prev=o.status;o.status=s;o.history.push({s,at:iso(Date.now()),by:ME.name});
 if(s==='cancelled'&&prev!=='cancelled')o.items.forEach(i=>{const v=findP(i.pid)?.variants.find(x=>x.sku===i.sku);if(v)v.stock+=i.qty});
 W(sb.from('orders').update({status:s,history:o.history}).eq('id',o.id),`تعذّر تحديث الطلب #${o.id}`);
 log(`نقل الطلب #${o.id} إلى «${STATUS[s].t}»`);save();
 toast(`الطلب #${o.id}: ${STATUS[s].t}`,S.settings.autoNotify&&s!=='new'?'أرسل للعميل إشعار واتساب بحالة طلبه من زر «إشعار العميل»':'',{icon:s==='cancelled'?'x':'check',tone:s==='cancelled'?'red':''});
 soft();refreshDrawer();
}
/* ---------- permanent deletion (general manager only) ---------- */
function delErr(e){const m=String(e&&(e.message||e)||'');
 if(/not_allowed|42501|permission denied/i.test(m+(e&&e.code||'')))return 'الحذف متاح للمدير العام فقط';
 if(/PGRST202|Could not find the function|admin_delete/i.test(m+(e&&e.code||'')))return 'ميزة الحذف غير مفعّلة بعد في قاعدة البيانات — شغّل ملف olga_delete_orders.sql مرة واحدة';
 if(/foreign key|23503/i.test(m+(e&&e.code||'')))return 'الطلب مرتبط ببيانات أخرى في قاعدة البيانات ولا يمكن حذفه';
 return errMsg(e)}
function dropOrders(ids,msg){const set=new Set(ids.map(Number));S.orders=S.orders.filter(o=>!set.has(o.id));S.notifs=S.notifs.filter(n=>!(n.type==='order'&&set.has(+n.ref)));
 if(DR&&DR.type==='order'&&set.has(+DR.id))closeAll();
 if(msg&&ME){S.log.unshift({at:iso(Date.now()),who:ME.name,msg});S.log=S.log.slice(0,400)} /* the database writes the same line to the activity log */
 DB.save();renderNav();render()}
async function deleteOrders(ids){const{data,error}=await sb.rpc('admin_delete_orders',{order_ids:ids.map(Number)});if(error)throw error;return data}
async function deleteAllOrders(){const{data,error}=await sb.rpc('admin_delete_all_orders',{confirm:'DELETE_ALL_ORDERS'});if(error)throw error;return data}
/* remove orders that were deleted from another device */
async function pruneDeleted(){if(!S.orders.length)return false;const{data,error}=await sb.from('orders').select('id').range(0,9999);if(error||!data||data.length>=10000)return false;
 const keep=new Set(data.map(r=>+r.id)),gone=S.orders.filter(o=>!keep.has(o.id)).map(o=>o.id);if(!gone.length)return false;
 const set=new Set(gone);S.orders=S.orders.filter(o=>!set.has(o.id));if(DR&&DR.type==='order'&&set.has(+DR.id))closeAll();return true}

/* live: check the database for new or changed orders */
let pollT,polling=false;
function schedulePoll(){clearTimeout(pollT);if(!ME||!S.settings.live)return;pollT=setTimeout(async()=>{await poll();schedulePoll()},20000)}
async function poll(){
 if(polling||!ME)return;polling=true;
 try{
  let q=sb.from('orders').select('*').order('updated_at').limit(500);if(S._cur)q=q.gt('updated_at',S._cur);
  const rows=chk(await q);const pruned=await pruneDeleted();
  if(!rows.length){if(pruned){DB.save();renderNav();if(['home','orders','reports','customers'].includes(route)&&!$('#modal').classList.contains('on'))soft()}return}
  const fresh=[];
  rows.forEach(r=>{S._cur=maxStr(S._cur,r.updated_at);const o=MAP.order(r);const i=S.orders.findIndex(x=>x.id===o.id);if(i<0){o._fresh=true;S.orders.push(o);fresh.push(o)}else S.orders[i]=o});
  const before=lowSet();
  let cq=sb.from('customers').select('*').order('created_at').limit(500);if(S._custCur)cq=cq.gt('created_at',S._custCur);
  const [V,Cu]=await Promise.all([fetchAll('product_variants','sku'),cq.then(chk)]);
  V.forEach(v=>{S.products.forEach(p=>p.variants.forEach(x=>{if(x.sku===v.sku)x.stock=+v.stock||0}))});
  Cu.forEach(c=>{S._custCur=maxStr(S._custCur,c.created_at);if(!findC(c.id))S.customers.push(MAP.cust(c))});
  lowStock().forEach(({p,v})=>{if(!before.has(v.sku))notify('stock',`مخزون منخفض: ${p.name} · ${v.size} (${v.stock})`,p.id)});
  fresh.forEach(o=>notify('order',`طلب جديد #${o.id} من ${o.city} — ${fmt(o.total)} د.أ (${CHANNELS[o.channel]})`,o.id));
  if(fresh.length){chime();const o=fresh[fresh.length-1];toast(fresh.length>1?`${fresh.length} طلبات جديدة`:`طلب جديد #${o.id}`,`${o.name} · ${o.city} · ${fmt(o.total)} د.أ`,{icon:'bell',tone:'gold',act:()=>openOrderFn(o.id)});setTimeout(()=>fresh.forEach(o=>delete o._fresh),3000)}
  DB.save();renderNav();
  if(['home','orders','products'].includes(route)&&!$('#modal').classList.contains('on'))soft();
  refreshDrawer();
 }catch(e){console.warn('poll failed',e)}finally{polling=false}
}
function openOrderFn(id){const o=findO(id);if(o)orderDrawer(o)}

/* ---------- print & export ---------- */
const LOGO=()=>`<svg viewBox="0 0 1260 726" style="width:120px;fill:#1F3A40">${$('#olga-logo').innerHTML}</svg>`;
const PCSS=`*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Readex Pro",Tahoma,sans-serif;color:#24373B;padding:36px;font-size:13px;line-height:1.7}h1{font-weight:300;font-size:28px;color:#1F3A40}h2{font-weight:500;font-size:15px;color:#1F3A40;margin:22px 0 8px}.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #6E8B3A;padding-bottom:16px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#F8F3E5;font-weight:500;text-align:right;padding:8px}td{padding:8px;border-bottom:1px solid #e8e4d8}.num{direction:ltr;unicode-bidi:isolate}.muted{color:#66756F}.tot td{font-weight:600;font-size:15px;border:0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.k{padding:12px;border:1px solid #e8e4d8;border-radius:12px}.k b{display:block;font-size:18px;font-weight:400}.ft{margin-top:30px;text-align:center;color:#66756F;font-size:11px;border-top:1px solid #e8e4d8;padding-top:12px}.label{border:2px dashed #1F3A40;border-radius:16px;padding:24px;max-width:520px;margin:auto}.big{font-size:22px;font-weight:500}.bc{height:56px;margin:16px 0 4px;background:repeating-linear-gradient(90deg,#0E2429 0 2px,transparent 2px 4px,#0E2429 4px 7px,transparent 7px 9px)}svg .ln{fill:none;stroke-width:2.4}svg .ar{opacity:.6}svg .gl{stroke:#e8e4d8}svg .ax{font-size:11px;fill:#66756F}svg .guide,svg .dot{display:none}@media print{body{padding:0}}`;
function printDoc(title,inner){const w=window.open('','_blank');if(!w){toast('اسمح بالنوافذ المنبثقة للطباعة','',{tone:'red',icon:'x'});return}w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600&display=swap"><style>${PCSS}</style></head><body>${inner}<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`);w.document.close()}
function invoiceHTML(o){return `<div class="hd">${LOGO()}<div style="text-align:left"><h1>فاتورة</h1><div class="num">#${o.id}</div><div class="muted">${fdt(o.date)}</div></div></div>
 <div style="display:flex;justify-content:space-between;gap:20px"><div><h2>إلى</h2><b>${esc(o.name)}</b><div class="num">${o.phone}</div><div>${esc(o.address)}</div></div><div><h2>من</h2><b>${esc(S.settings.storeName)}</b><div class="num">+${S.settings.whatsapp}</div><div>صُنع في الأردن</div></div></div>
 <h2>المنتجات</h2><table><tr><th>المنتج</th><th>الحجم</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>${o.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.size)}</td><td class="num">${i.qty}</td><td class="num">${fmt(i.price)}</td><td class="num">${fmt(i.price*i.qty)}</td></tr>`).join('')}
 <tr><td colspan="4">المجموع الفرعي</td><td class="num">${fmt(o.subtotal)}</td></tr>${o.discount?`<tr><td colspan="4">الخصم ${o.coupon?`(${esc(o.coupon)})`:''}</td><td class="num">-${fmt(o.discount)}</td></tr>`:''}<tr><td colspan="4">التوصيل</td><td class="num">${fmt(o.delivery)}</td></tr><tr class="tot"><td colspan="4">الإجمالي (د.أ)</td><td class="num">${fmt(o.total)}</td></tr></table>
 <p style="margin-top:14px">طريقة الدفع: ${payT(o.payment)}</p><div class="ft">شكراً لاختيارك أولغا — منتجات طبيعية مستخلصة من زيوت طبيعية · ${esc(S.settings.email)}</div>`}
function labelHTML(o){return `<div class="label"><div class="hd" style="margin-bottom:14px">${LOGO()}<div class="big num">#${o.id}</div></div><div class="muted">إلى:</div><div class="big">${esc(o.name)}</div><div class="big num">${o.phone}</div><div style="font-size:16px;margin-top:4px">${esc(o.address)}</div><div style="margin-top:12px;display:flex;justify-content:space-between"><span>القطع: <b class="num">${o.items.reduce((s,i)=>s+i.qty,0)}</b></span><span>${o.payment==='cod'?`المبلغ عند الاستلام: <b class="num">${fmt(o.total)}</b> د.أ`:'مدفوع إلكترونياً'}</span></div><div class="bc"></div><div class="num" style="text-align:center;letter-spacing:.4em">OLG${o.id}JO</div><div class="ft">من: ${esc(S.settings.storeName)} · +${S.settings.whatsapp}</div></div>`}
function download(name,content,type){const b=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}
function xls(sections){return '\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body dir="rtl">'+sections.map(s=>`<h3>${esc(s.title)}</h3><table border="1"><tr>${s.head.map(h=>`<th style="background:#1F3A40;color:#fff">${esc(h)}</th>`).join('')}</tr>${s.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table><br>`).join('')+'</body></html>'}
const today=()=>new Date().toISOString().slice(0,10);
const ordRows=L=>L.map(o=>[o.id,fdt(o.date),o.name,o.phone,o.city,CHANNELS[o.channel],o.items.map(i=>`${i.name} ${i.size}×${i.qty}`).join(' | '),fmt(o.subtotal),fmt(o.discount),fmt(o.delivery),fmt(o.total),fmt(oCost(o)),fmt(oSales(o)-oCost(o)),payT(o.payment),STATUS[o.status].t]);
const ORD_HEAD=['رقم الطلب','التاريخ','العميل','الهاتف','المدينة','المصدر','المنتجات','المجموع الفرعي','الخصم','التوصيل','الإجمالي','التكلفة','صافي الربح','الدفع','الحالة'];

/* ---------- actions (event delegation) ---------- */
const ACT={
 closeAll,closeModal,
 delOrder(el){if(!isAdm()){toast('الحذف متاح للمدير العام فقط','',{tone:'red',icon:'lock'});return}const o=findO(el.dataset.id);if(!o)return;
  openModal('حذف الطلب نهائياً',`<div class="del-warn">${ic('alert')}<div><b>سيُحذف الطلب <span class="num">#${o.id}</span> بشكل نهائي ولا يمكن استرجاعه.</b><p>${esc(o.name)} · ${esc(o.city)} · ${fmt(o.total)} د.أ · ${STATUS[o.status].t}</p></div></div>
   <p class="muted sm" style="margin-top:12px">لا يتغيّر المخزون ولا ملف العميل. إن أردت إعادة الكميات إلى المخزون فألغِ الطلب أولاً ثم احذفه.</p>`,
   `<button class="btn btn--danger" data-act="delOrderGo" data-id="${o.id}">${ic('trash')}نعم، احذف نهائياً</button><button class="btn btn--ghost" data-act="closeModal">تراجع</button>`)},
 async delOrderGo(el){if(!isAdm())return;const id=+el.dataset.id;el.disabled=true;el.classList.add('is-busy');
  try{await deleteOrders([id]);closeModal();dropOrders([id],`حذف نهائي للطلب #${id}`);toast(`تم حذف الطلب #${id} نهائياً`,'',{icon:'trash'})}
  catch(e){console.error(e);el.disabled=false;el.classList.remove('is-busy');toast('تعذّر حذف الطلب',delErr(e),{tone:'red',icon:'x'})}},
 delAllOrders(){if(!isAdm()){toast('الحذف متاح للمدير العام فقط','',{tone:'red',icon:'lock'});return}const n=S.orders.length;if(!n){toast('لا توجد طلبات لحذفها');return}
  openModal('حذف جميع الطلبات',`<div class="del-warn">${ic('alert')}<div><b>سيُحذف <span class="num">${fmt0(n)}</span> طلب بشكل نهائي ولا يمكن استرجاعها.</b><p>يشمل ذلك الطلبات من كل القنوات وكل الحالات، وستتأثر التقارير والأرباح المحسوبة منها.</p></div></div>
   <p class="muted sm" style="margin:14px 0 8px">يُنصح بتصدير الطلبات إلى Excel أولاً. للتأكيد اكتب <b style="color:var(--bad)">حذف الكل</b> في الخانة:</p>
   <input class="in" id="delAllIn" autocomplete="off" placeholder="حذف الكل">`,
   `<button class="btn btn--danger" data-act="delAllGo" id="delAllGo" disabled>${ic('trash')}حذف جميع الطلبات نهائياً</button><button class="btn btn--ghost" data-act="exportOrders">${ic('download')}تصدير Excel أولاً</button><button class="btn btn--ghost" data-act="closeModal">تراجع</button>`)},
 async delAllGo(el){if(!isAdm())return;const inp=$('#delAllIn');if(!inp||inp.value.trim()!=='حذف الكل'){inp&&inp.focus();return}
  el.disabled=true;el.classList.add('is-busy');
  try{const r=await deleteAllOrders();const n=r&&r.deleted!=null?+r.deleted:S.orders.length;closeModal();dropOrders(S.orders.map(o=>o.id),`حذف جميع الطلبات نهائياً (${n} طلب)`);toast('تم حذف جميع الطلبات نهائياً',`${fmt0(n)} طلب`,{icon:'trash'})}
  catch(e){console.error(e);el.disabled=false;el.classList.remove('is-busy');toast('تعذّر حذف الطلبات',delErr(e),{tone:'red',icon:'x'})}},
 navToggle(){const o=$('#app').classList.toggle('nav-open');$('#scrim').classList.toggle('on',o)},
 mobSearch(){$('#gsearch').classList.toggle('mob');$('#gq').focus()},
 async logout(){log('تسجيل خروج');DB.save();await new Promise(r=>setTimeout(r,300));await sb.auth.signOut();location.hash='';location.reload()},
 toggleLive(){if(!can('settings')&&ME.role!=='admin'){toast('تغيير هذا الإعداد للمدير فقط','',{tone:'red',icon:'lock'});return}S.settings.live=!S.settings.live;putSetting('store',S.settings);save();schedulePoll();if(S.settings.live)poll();toast(S.settings.live?'الاستقبال اللحظي مفعّل':'تم إيقاف الاستقبال اللحظي')},
 bell(){const p=$('#bellPop');const on=!p.classList.contains('on');$$('.pop').forEach(x=>x.classList.remove('on'));if(!on)return;
  p.innerHTML=`<div class="pop__h">الإشعارات<span class="row" style="gap:4px"><button class="btn btn--sm btn--ghost" data-act="readAll">قراءة الكل</button></span></div>${S.notifs.length?S.notifs.slice(0,20).map(n=>`<button class="pi ${n.read?'':'unread'}" data-act="notifGo" data-id="${n.id}"><span class="ic ${n.type==='stock'?'red':''}">${ic(n.type==='stock'?'alert':'cart')}</span><div><b>${esc(n.text)}</b><small>${ago(n.at)}</small></div></button>`).join(''):empty('لا توجد إشعارات بعد — ستصلك هنا الطلبات الجديدة وتنبيهات المخزون','bell')}`;p.classList.add('on')},
 readAll(){S.notifs.forEach(n=>n.read=true);save();$('#bellPop').classList.remove('on')},
 notifGo(el){const n=S.notifs.find(x=>String(x.id)===el.dataset.id);if(!n)return;n.read=true;save();$('#bellPop').classList.remove('on');if(n.type==='order')openOrderFn(n.ref);else location.hash='#/products'},
 homeRange(el){UI.homeRange=+el.dataset.v;render()},
 newOrder(){newOrderModal()},
 openOrder(el){openOrderFn(el.dataset.id)},
 advance(el){const o=findO(el.dataset.id);const nx=o&&nextStatus(o.status);if(nx)setStatus(o,nx)},
 cancelOrder(el){const o=findO(el.dataset.id);if(o&&confirm(`إلغاء الطلب #${o.id}؟ ستُعاد الكميات للمخزون.`))setStatus(o,'cancelled')},
 saveNotes(el){const o=findO(el.dataset.id);o.notes=$('#oNotes').value;W(sb.from('orders').update({notes:o.notes}).eq('id',o.id));log(`أضاف ملاحظة على الطلب #${o.id}`);save();toast('تم حفظ الملاحظة')},
 printInvoice(el){const o=findO(el.dataset.id);printDoc(`فاتورة #${o.id}`,invoiceHTML(o));log(`طبع فاتورة الطلب #${o.id}`);DB.save()},
 printLabel(el){const o=findO(el.dataset.id);printDoc(`بوليصة شحن #${o.id}`,labelHTML(o));log(`طبع بوليصة شحن الطلب #${o.id}`);DB.save()},
 notifyCust(el){const o=findO(el.dataset.id);const M={new:'استلمنا طلبك وسنبدأ بتجهيزه قريباً',processing:'طلبك قيد التجهيز الآن',shipped:'تم شحن طلبك وهو في الطريق إليك',done:'تم تسليم طلبك، نتمنى أن ينال إعجابك',cancelled:'تم إلغاء طلبك، تواصل معنا لأي استفسار'};
  const msg=`مرحباً ${o.name} 🌿\nطلبك رقم #${o.id} من أولغا: ${M[o.status]}.\nالإجمالي: ${fmt(o.total)} د.أ\nشكراً لاختيارك أولغا.`;window.open(`https://wa.me/962${o.phone.replace(/^0/,'')}?text=${encodeURIComponent(msg)}`,'_blank');log(`أرسل إشعار واتساب للعميل (طلب #${o.id})`);DB.save()},
 ordStatus(el){UI.ordStatus=el.dataset.v;UI.ordLimit=25;render()},
 ordView(el){UI.ordView=el.dataset.v;render()},
 ordMore(){UI.ordLimit+=25;$('#ordList').innerHTML=ordersList()},
 exportOrders(){const L=filteredOrders(UI.ordView==='kanban');download(`olga-orders-${today()}.xls`,xls([{title:'طلبات أولغا',head:ORD_HEAD,rows:ordRows(L)}]),'application/vnd.ms-excel');log('صدّر قائمة الطلبات (Excel)');DB.save();toast('تم تصدير الطلبات',`${L.length} طلب`,{icon:'download'})},
 openCust(el){const c=findC(el.dataset.id);if(c)custDrawer(c)},
 custSeg(el){UI.custSeg=el.dataset.v;UI.custLimit=30;render()},
 custMore(){UI.custLimit+=30;$('#custList').innerHTML=custList()},
 custModal(el){custModal(el.dataset.id)},
 async saveCust(el){const f=$('#custForm');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));const ints=d.interests.split(/[،,]/).map(s=>s.trim()).filter(Boolean);
  let c=el.dataset.id?findC(el.dataset.id):null;el.disabled=true;
  if(c){const addresses=[d.address,...c.addresses.slice(1)];
   const ok=await W(sb.from('customers').update({name:d.name.trim(),phone:d.phone.trim(),city:d.city,skin:d.skin,interests:ints,addresses}).eq('id',c.id),'تعذّر حفظ بيانات العميل');el.disabled=false;if(!ok)return;
   Object.assign(c,{name:d.name.trim(),phone:d.phone.trim(),city:d.city,skin:d.skin,interests:ints,addresses});log(`عدّل بيانات العميل ${c.name}`)}
  else{const{data,error}=await sb.from('customers').insert({name:d.name.trim(),phone:d.phone.trim(),city:d.city,addresses:[d.address||d.city],skin:d.skin,interests:ints,source:'whatsapp'}).select().single();el.disabled=false;
   if(error){toast('تعذّر حفظ العميل',errMsg(error),{tone:'red',icon:'x'});return}
   c=MAP.cust(data);S.customers.push(c);log(`أضاف العميل ${c.name}`)}
  save();closeModal();toast('تم حفظ بيانات العميل');soft();refreshDrawer()},
 saveCustNotes(el){const c=findC(el.dataset.id);c.notes=$('#cNotes').value;W(sb.from('customers').update({notes:c.notes}).eq('id',c.id));log(`حدّث ملاحظات العميل ${c.name}`);save();toast('تم حفظ الملاحظات')},
 exportCust(){const ag=custAgg();download(`olga-customers-${today()}.xls`,xls([{title:'قاعدة عملاء أولغا',head:['الاسم','الهاتف','المدينة','العنوان','نوع البشرة','الاهتمامات','الطلبات','قيمة العميل','الشريحة','عميل منذ'],rows:S.customers.map(c=>{const s=ag[c.id];return[c.name,c.phone,c.city,c.addresses[0],c.skin,c.interests.join('، '),s?.orders||0,fmt(s?.spent||0),SEGS[segOf(s)].t,fdate(c.createdAt)]})}]),'application/vnd.ms-excel');log('صدّر قاعدة العملاء');DB.save();toast('تم تصدير قاعدة العملاء','',{icon:'download'})},
 repPeriod(el){UI.repPeriod=el.dataset.v;render()},
 repExcel(){const D=repData();download(`olga-report-${UI.repPeriod}-${today()}.xls`,xls([
   {title:'ملخص الفترة',head:['المبيعات','التكلفة','صافي الربح','الهامش %','الطلبات','متوسط الطلب'],rows:[[fmt(D.a.sales),fmt(D.a.cost),fmt(D.a.profit),D.a.margin.toFixed(1),D.a.orders,fmt(D.a.aov)]]},
   {title:'حسب الفترة',head:['الفترة','المبيعات','صافي الربح','الطلبات'],rows:D.bk.map((b,i)=>[b.label,fmt(D.ser[i].sales),fmt(D.ser[i].profit),D.ser[i].orders])},
   {title:'المنتجات',head:['المنتج','الحجم','الكمية','المبيعات','التكلفة','الربح','الهامش %'],rows:D.prods.map(p=>[p.name,p.size,p.qty,fmt(p.rev),fmt(p.cost),fmt(p.profit),p.margin.toFixed(1)])},
   {title:'المدن',head:['المدينة','الطلبات','المبيعات'],rows:D.cities.map(c=>[c.city,c.orders,fmt(c.sales)])},
   {title:'القنوات',head:['القناة','الطلبات','المبيعات','الربح'],rows:D.chan.map(c=>[c.name,c.orders,fmt(c.sales),fmt(c.profit)])},
   {title:'الطلبات',head:ORD_HEAD,rows:ordRows(D.cur)}]),'application/vnd.ms-excel');log('صدّر تقرير الأرباح (Excel)');DB.save();toast('تم تصدير التقرير بصيغة Excel','',{icon:'download'})},
 repPDF(){const D=repData();const PL={daily:'يومي — آخر 14 يوماً',weekly:'أسبوعي — آخر 12 أسبوعاً',monthly:'شهري — آخر 6 أشهر'};
  printDoc('تقرير الأرباح — أولغا',`<div class="hd">${LOGO()}<div style="text-align:left"><h1>تقرير الأرباح والمبيعات</h1><div class="muted">${PL[UI.repPeriod]} · ${fdate(Date.now())}</div></div></div>
  <div class="grid">${[['المبيعات',fmt(D.a.sales)],['صافي الربح',fmt(D.a.profit)],['الهامش',D.a.margin.toFixed(1)+'%'],['الطلبات',D.a.orders]].map(([t,v])=>`<div class="k"><span class="muted">${t}</span><b class="num">${v}</b></div>`).join('')}</div>
  <h2>المبيعات والأرباح</h2>${areaChart([{label:'المبيعات',values:D.ser.map(s=>s.sales),color:'#6E8B3A'},{label:'الربح',values:D.ser.map(s=>s.profit),color:'#C6A13F'}],D.bk.map(b=>b.label),{h:240})}
  <h2>المنتجات</h2><table><tr><th>المنتج</th><th>الحجم</th><th>الكمية</th><th>المبيعات</th><th>الربح</th><th>الهامش</th></tr>${D.prods.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.size)}</td><td class="num">${p.qty}</td><td class="num">${fmt(p.rev)}</td><td class="num">${fmt(p.profit)}</td><td class="num">${p.margin.toFixed(0)}%</td></tr>`).join('')}</table>
  <h2>المدن</h2><table><tr><th>المدينة</th><th>الطلبات</th><th>المبيعات</th></tr>${D.cities.map(c=>`<tr><td>${c.city}</td><td class="num">${c.orders}</td><td class="num">${fmt(c.sales)}</td></tr>`).join('')}</table>
  <h2>القنوات</h2><table><tr><th>القناة</th><th>الطلبات</th><th>المبيعات</th><th>الربح</th></tr>${D.chan.map(c=>`<tr><td>${c.name}</td><td class="num">${c.orders}</td><td class="num">${fmt(c.sales)}</td><td class="num">${fmt(c.profit)}</td></tr>`).join('')}</table>
  <div class="ft">لوحة تحكم أولغا · ${esc(ME.name)}</div>`);log('صدّر تقرير الأرباح (PDF)');DB.save()},
 prodCat(el){UI.prodCat=el.dataset.v;render()},
 stk(el){const v=S.products.flatMap(p=>p.variants).find(x=>x.sku===el.dataset.sku);if(!v)return;v.stock=Math.max(0,v.stock+ +el.dataset.d);save();const inp=el.parentElement.querySelector('input');inp.value=v.stock;el.parentElement.classList.toggle('low',v.stock<=v.low);(ACT._pend||(ACT._pend={}))[v.sku]=v;clearTimeout(ACT._st);ACT._st=setTimeout(()=>{const L=Object.values(ACT._pend);ACT._pend={};L.forEach(v=>{W(sb.from('product_variants').update({stock:v.stock}).eq('sku',v.sku),'تعذّر حفظ المخزون');log(`عدّل مخزون ${v.sku} إلى ${v.stock}`)});$('#prodList')&&($('#prodList').innerHTML=prodList())},900)},
 togFeat(el){const p=findP(el.dataset.id);p.featured=!p.featured;W(sb.from('products').update({featured:p.featured}).eq('id',p.id));log(`${p.featured?'ميّز':'ألغى تمييز'} ${p.name}`);save();$('#prodList').innerHTML=prodList()},
 editProd(el){prodModal(el.dataset.id)},
 addVRow(){$('#vrows').insertAdjacentHTML('beforeend',window.__vrow({sku:'',size:'',price:0,cost:0,stock:0,low:10}))},
 rmRow(el){const r=el.closest('[data-v],.irow');if(r&&r.parentElement.children.length>1){r.remove();calcNO()}},
 async saveProd(el){const f=$('#prodForm');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));
  const vars=$$('#vrows [data-v]').map(r=>{const g=n=>r.querySelector(`[name="${n}"]`).value;return{size:g('size').trim(),sku:g('sku').trim(),price:+g('price')||0,cost:+g('cost')||0,stock:Math.max(0,Math.round(+g('stock')||0)),low:Math.max(0,Math.round(+g('low')||0))}}).filter(v=>v.size);
  if(!vars.length){toast('أضف حجماً واحداً على الأقل','',{tone:'red',icon:'x'});return}
  let p=el.dataset.id?findP(el.dataset.id):null;const base=(d.en||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'p'+Date.now().toString(36);
  const id=p?p.id:(findP(base)?base+'-'+Date.now().toString(36):base);
  vars.forEach((v,i)=>{if(!v.sku)v.sku=id+'-'+(i+1)});
  const skus=vars.map(v=>v.sku);
  if(new Set(skus).size!==skus.length){toast('رمز SKU مكرر في الأحجام','',{tone:'red',icon:'x'});return}
  const clash=S.products.find(x=>x.id!==id&&x.variants.some(v=>skus.includes(v.sku)));
  if(clash){toast('رمز SKU مستخدم لمنتج آخر',clash.name,{tone:'red',icon:'x'});return}
  const data={name:d.name.trim(),en:(d.en||'').trim(),cat:d.cat,badge:d.badge||'',cal:d.cal||d.name.trim().split(' ').pop(),acc:d.acc,img:(d.img||'').trim(),desc:d.desc||'',featured:!!d.featured,active:!!d.active,variants:vars};
  const row={id,name:data.name,name_en:data.en,category:data.cat,badge:data.badge,calligraphy:data.cal,accent:data.acc,image_url:data.img,description:data.desc,featured:data.featured,active:data.active};
  if(!p)row.sort_order=S.products.reduce((m,x)=>Math.max(m,x.sort||0),0)+1;
  el.disabled=true;
  const removed=p?p.variants.map(v=>v.sku).filter(k=>!skus.includes(k)):[];
  const ok=await W(sb.from('products').upsert(row),'تعذّر حفظ المنتج')
   &&(!removed.length||(await W(sb.from('variant_costs').delete().in('sku',removed),'تعذّر حذف الحجم')&&await W(sb.from('product_variants').delete().in('sku',removed),'تعذّر حذف الحجم')))
   &&await W(sb.from('product_variants').upsert(vars.map((v,i)=>({sku:v.sku,product_id:id,size:v.size,price:v.price,stock:v.stock,low_stock:v.low,sort_order:i}))),'تعذّر حفظ الأحجام')
   &&await W(sb.from('variant_costs').upsert(vars.map(v=>({sku:v.sku,cost:v.cost}))),'تعذّر حفظ التكلفة');
  el.disabled=false;if(!ok)return;
  if(p){Object.assign(p,data);log(`عدّل المنتج ${p.name}`)}else{S.products.push({id,sort:row.sort_order,...data});log(`أضاف المنتج ${data.name}`)}
  save();closeModal();toast('تم حفظ المنتج',data.name);render()},
 async delProd(el){const p=findP(el.dataset.id);if(!confirm(`حذف «${p.name}» نهائياً؟`))return;const skus=p.variants.map(v=>v.sku);el.disabled=true;
  const ok=(!skus.length||(await W(sb.from('variant_costs').delete().in('sku',skus),'تعذّر حذف المنتج')&&await W(sb.from('product_variants').delete().in('sku',skus),'تعذّر حذف المنتج')))&&await W(sb.from('products').delete().eq('id',p.id),'تعذّر حذف المنتج');
  el.disabled=false;if(!ok)return;
  S.products=S.products.filter(x=>x!==p);log(`حذف المنتج ${p.name}`);save();closeModal();render()},
 mkTab(el){UI.mkTab=el.dataset.v;render()},
 couponModal(el){const i=el.dataset.i;const c=i!==undefined?S.coupons[i]:{code:'',type:'pct',value:10,min:0,limit:100,used:0,expires:iso(Date.now()+30*DAY),active:true,desc:''};const ex=c.expires?String(c.expires).slice(0,10):'';
  openModal(i!==undefined?'تعديل كود خصم':'كود خصم جديد',`<form class="form c2" id="cpForm"><label class="field"><span>الكود</span><input class="in" name="code" required dir="ltr" style="text-transform:uppercase" value="${esc(c.code)}"></label><label class="field"><span>الوصف</span><input class="in" name="desc" value="${esc(c.desc)}"></label><label class="field"><span>نوع الخصم</span><select class="in" name="type">${opt('pct','نسبة مئوية %',c.type)}${opt('fixed','مبلغ ثابت (د.أ)',c.type)}</select></label><label class="field"><span>القيمة</span><input class="in" name="value" type="number" step="0.5" min="0" value="${c.value}"></label><label class="field"><span>الحد الأدنى للطلب (د.أ)</span><input class="in" name="min" type="number" step="0.5" min="0" value="${c.min}"></label><label class="field"><span>عدد مرات الاستخدام</span><input class="in" name="limit" type="number" min="1" value="${c.limit}"></label><label class="field span2"><span>تاريخ الانتهاء</span><input class="in" name="expires" type="date" value="${ex}"></label><span class="muted sm span2">اترك تاريخ الانتهاء فارغاً لكود بلا انتهاء.</span></form>`,
  `<button class="btn btn--olive" data-act="saveCoupon" data-i="${i??''}">${ic('check')}حفظ</button><button class="btn btn--ghost" data-act="closeModal">إلغاء</button>`)},
 async saveCoupon(el){const f=$('#cpForm');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));const i=el.dataset.i;
  const data={code:d.code.toUpperCase().trim(),desc:d.desc,type:d.type,value:+d.value||0,min:+d.min||0,limit:Math.max(1,Math.round(+d.limit||1)),expires:d.expires?iso(d.expires+'T23:59:00'):null};
  if(!data.code){toast('اكتب الكود','',{tone:'red',icon:'x'});return}
  const old=i!==''?S.coupons[i]:null;
  if(S.coupons.some(c=>c.code===data.code&&c!==old)){toast('هذا الكود موجود مسبقاً','',{tone:'red',icon:'x'});return}
  const row={code:data.code,description:data.desc,type:data.type,value:data.value,min_order:data.min,usage_limit:data.limit,expires_at:data.expires};
  el.disabled=true;
  const ok=old?await W(sb.from('coupons').update(row).eq('code',old.code),'تعذّر حفظ الكود'):await W(sb.from('coupons').insert({...row,used:0,active:true}),'تعذّر حفظ الكود');
  el.disabled=false;if(!ok)return;
  if(old)Object.assign(old,data);else S.coupons.unshift({...data,used:0,active:true});
  log(`حفظ كود الخصم ${data.code}`);save();closeModal();toast('تم حفظ الكود',data.code);render()},
 async delCoupon(el){const c=S.coupons[el.dataset.i];if(!confirm(`حذف الكود ${c.code}؟`))return;if(!await W(sb.from('coupons').delete().eq('code',c.code),'تعذّر حذف الكود'))return;S.coupons=S.coupons.filter(x=>x!==c);log(`حذف كود الخصم ${c.code}`);save();render()},
 offerModal(el){const i=el.dataset.i;const o=i!==undefined?S.offers[i]:{name:'',products:[],pct:10,from:iso(Date.now()),to:iso(Date.now()+14*DAY),active:true};const d10=x=>x?String(x).slice(0,10):'';
  openModal(i!==undefined?'تعديل العرض':'عرض موسمي جديد',`<form class="form c2" id="ofForm"><label class="field span2"><span>اسم العرض</span><input class="in" name="name" required value="${esc(o.name)}"></label><label class="field"><span>نسبة الخصم %</span><input class="in" name="pct" type="number" min="1" max="90" value="${o.pct}"></label><span></span><label class="field"><span>من</span><input class="in" name="from" type="date" value="${d10(o.from)}"></label><label class="field"><span>إلى</span><input class="in" name="to" type="date" value="${d10(o.to)}"></label><div class="span2"><span class="muted sm">المنتجات المشمولة</span><div class="tagl" style="margin-top:8px">${S.products.map(p=>`<label class="chk"><input type="checkbox" name="p" value="${p.id}" ${o.products.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</div></div></form>`,
  `<button class="btn btn--olive" data-act="saveOffer" data-i="${i??''}">${ic('check')}حفظ</button><button class="btn btn--ghost" data-act="closeModal">إلغاء</button>`)},
 async saveOffer(el){const f=$('#ofForm');if(!f.reportValidity())return;const fd=new FormData(f);const data={name:String(fd.get('name')).trim(),pct:+fd.get('pct')||0,from:fd.get('from')?iso(fd.get('from')+'T00:00:00'):null,to:fd.get('to')?iso(fd.get('to')+'T23:59:00'):null,products:fd.getAll('p')};
  if(!data.products.length){toast('اختر منتجاً واحداً على الأقل','',{tone:'red',icon:'x'});return}
  const row={name:data.name,pct:data.pct,starts_at:data.from,ends_at:data.to,product_ids:data.products};
  const i=el.dataset.i;el.disabled=true;
  if(i!==''){const o=S.offers[i];const ok=await W(sb.from('offers').update(row).eq('id',o.id),'تعذّر حفظ العرض');el.disabled=false;if(!ok)return;Object.assign(o,data)}
  else{const{data:r,error}=await sb.from('offers').insert({...row,active:true}).select().single();el.disabled=false;if(error){toast('تعذّر حفظ العرض',errMsg(error),{tone:'red',icon:'x'});return}S.offers.unshift(MAP.offer(r))}
  log(`حفظ العرض «${data.name}»`);save();closeModal();toast('تم حفظ العرض');render()},
 async delOffer(el){const o=S.offers[el.dataset.i];if(!confirm(`حذف العرض «${o.name}»؟`))return;if(!await W(sb.from('offers').delete().eq('id',o.id),'تعذّر حذف العرض'))return;S.offers=S.offers.filter(x=>x!==o);log(`حذف العرض «${o.name}»`);save();render()},
 async sendPush(el){const f=$('#pushForm');const d=Object.fromEntries(new FormData(f));if(!d.title.trim()){toast('اكتب عنوان الإشعار','',{tone:'red',icon:'x'});return}
  el.disabled=true;const{data,error}=await sb.from('push_campaigns').insert({title:d.title.trim(),body:d.body.trim(),audience:d.audience,reach:0,opens:0}).select().single();el.disabled=false;
  if(error){toast('تعذّر حفظ الإشعار',errMsg(error),{tone:'red',icon:'x'});return}
  S.pushes.unshift(MAP.push(data));log(`سجّل إشعار «${d.title}» لمستخدمي التطبيق`);save();toast('تم حفظ الإشعار في السجل','',{icon:'send'});render()},
 saveBar(){const f=$('#barForm');S.content.bar=[0,1,2].map(i=>f[`bar${i}`].value.trim()).filter(Boolean);putSetting('content',S.content);log('حدّث رسائل الشريط العلوي للمتجر');save();toast('تم نشر رسائل الشريط العلوي');render()},
 bannerModal(el){const i=el.dataset.i;const b=i!==undefined?S.content.banners[i]:{title:'',sub:'',cta:'تسوّق الآن',active:true};
  openModal(i!==undefined?'تعديل البنر':'بنر جديد',`<form class="form" id="bnForm"><label class="field"><span>العنوان</span><input class="in" name="title" required value="${esc(b.title)}"></label><label class="field"><span>النص الفرعي</span><input class="in" name="sub" value="${esc(b.sub)}"></label><label class="field"><span>نص الزر</span><input class="in" name="cta" value="${esc(b.cta)}"></label></form>`,
  `<button class="btn btn--olive" data-act="saveBanner" data-i="${i??''}">${ic('check')}حفظ</button><button class="btn btn--ghost" data-act="closeModal">إلغاء</button>`)},
 saveBanner(el){const f=$('#bnForm');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));const i=el.dataset.i;if(i!=='')Object.assign(S.content.banners[i],d);else S.content.banners.push({id:'b'+Date.now(),...d,active:true});putSetting('content',S.content);log(`حفظ بنر «${d.title}»`);save();closeModal();toast('تم حفظ البنر');render()},
 delBanner(el){const b=S.content.banners[el.dataset.i];if(!confirm('حذف البنر؟'))return;S.content.banners.splice(el.dataset.i,1);putSetting('content',S.content);log(`حذف بنر «${b.title}»`);save();render()},
 addFaq(){$('#faqList').insertAdjacentHTML('beforeend',`<div class="box" style="margin-bottom:10px" data-faq><input class="in" data-k="q" placeholder="السؤال" style="margin-bottom:8px"><textarea class="in" data-k="a" style="min-height:64px" placeholder="الجواب"></textarea><button class="btn btn--sm btn--danger" style="margin-top:8px" data-act="rmFaq">${ic('trash')}حذف</button></div>`)},
 rmFaq(el){el.closest('[data-faq]').remove()},
 saveShams(){S.shams.knowledge=$('#shKnow').value;S.shams.faq=$$('#faqList [data-faq]').map(b=>({q:b.querySelector('[data-k=q]').value.trim(),a:b.querySelector('[data-k=a]').value.trim()})).filter(f=>f.q);putSetting('shams',S.shams);log('حدّث معلومات شمس');save();toast('تم تحديث معلومات شمس','ستستخدمها في المحادثات القادمة',{icon:'spark'})},
 syncShams(){S.shams.prices={};S.products.forEach(p=>p.variants.forEach(v=>S.shams.prices[v.sku]=v.price));S.shams.syncedAt=iso(Date.now());putSetting('shams',S.shams);log('زامن أسعار شمس مع المتجر');save();toast('تمت مزامنة الأسعار مع شمس','',{icon:'refresh'});render()},
 usrTab(el){UI.usrTab=el.dataset.v;render()},
 staffModal(el){const ed=!!el.dataset.id;const u=ed?S.staff.find(x=>x.id===el.dataset.id):{name:'',email:'',role:'orders',active:true};const self=ed&&u.id===ME.id;
  openModal(ed?'تعديل الحساب':'حساب جديد',`<form class="form c2" id="stForm"><label class="field"><span>الاسم</span><input class="in" name="name" required minlength="2" value="${esc(u.name)}"></label><label class="field"><span>البريد الإلكتروني</span><input class="in" name="email" type="email" required dir="ltr" value="${esc(u.email)}" ${ed?'readonly':''}></label>${!ed||self?`<label class="field"><span>كلمة المرور</span><input class="in" name="pass" type="password" minlength="6" ${ed?'':'required'} dir="ltr" autocomplete="new-password" placeholder="${ed?'اتركها فارغة لعدم التغيير':'6 أحرف على الأقل'}"></label>`:''}<label class="field"><span>الدور</span><select class="in" name="role" ${self?'disabled':''}>${Object.entries(ROLES).map(([k,t])=>opt(k,t,u.role)).join('')}</select></label>${!self?`<label class="chk span2" style="justify-self:start"><input type="checkbox" name="active" ${u.active?'checked':''}>الحساب فعّال</label>`:''}${ed&&!self?`<p class="muted sm span2">لتغيير كلمة مرور هذا الموظف يمكنه استخدام «نسيت كلمة المرور» أو من صفحة Authentication في Supabase.</p>`:''}${!ed?`<p class="muted sm span2">سيُنشأ حساب دخول بهذا البريد وكلمة المرور. إذا كان تأكيد البريد مفعّلاً في Supabase فسيصل للموظف رابط تأكيد قبل أول دخول.</p>`:''}</form>`,
  `<button class="btn btn--olive" data-act="saveStaff" data-id="${u.id||''}">${ic('check')}حفظ</button><button class="btn btn--ghost" data-act="closeModal">إلغاء</button>`)},
 async saveStaff(el){const f=$('#stForm');if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));const u=el.dataset.id?S.staff.find(x=>x.id===el.dataset.id):null;const self=u&&u.id===ME.id;
  const email=(u?u.email:d.email).trim().toLowerCase();
  if(!u&&S.staff.some(x=>x.email.toLowerCase()===email)){toast('البريد مستخدم لحساب آخر','',{tone:'red',icon:'x'});return}
  el.disabled=true;let signErr=null;
  try{
   if(!u){const tmp=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'olga-admin-signup'}});
    const r=await tmp.auth.signUp({email,password:d.pass,options:{data:{name:d.name.trim()}}});if(r.error)signErr=r.error}
   const role=self?ME.role:d.role,active=self?true:!!d.active;
   const{error}=await sb.rpc('admin_save_staff',{p_email:email,p_name:d.name.trim(),p_role:role,p_active:active});
   if(error){const m=String(error.message||'');
    toast('تعذّر حفظ الحساب',/user_not_found/.test(m)?(signErr?`تعذّر إنشاء حساب الدخول: ${errMsg(signErr)} — أنشئ المستخدم من Authentication في Supabase ثم أضفه هنا`:'لا يوجد حساب دخول بهذا البريد'):/cannot_change_self/.test(m)?'لا يمكنك تغيير دورك أو إيقاف حسابك':errMsg(error),{tone:'red',icon:'x'});return}
   if(self&&d.pass){const r=await sb.auth.updateUser({password:d.pass});if(r.error){toast('تم حفظ الاسم لكن تعذّر تغيير كلمة المرور',errMsg(r.error),{tone:'red',icon:'x'})}}
   await DB.load();closeModal();toast('تم حفظ الحساب',u?'':'يمكن للموظف الآن الدخول بالبريد وكلمة المرور');render();
  }finally{el.disabled=false}},
 exportLog(){download(`olga-activity-${today()}.xls`,xls([{title:'سجل العمليات',head:['الوقت','المستخدم','العملية'],rows:S.log.map(l=>[fdt(l.at),l.who,l.msg])}]),'application/vnd.ms-excel')},
 saveSettings(){const d=Object.fromEntries(new FormData($('#setForm')));Object.assign(S.settings,{...d,deliveryAmman:+d.deliveryAmman||0,deliveryOther:+d.deliveryOther||0});putSetting('store',S.settings);log('حدّث إعدادات المتجر');save();toast('تم حفظ الإعدادات')},
 backup(){const{notifs,_cur,_custCur,...data}=S;download(`olga-admin-backup-${today()}.json`,JSON.stringify(data,null,1),'application/json');toast('تم تنزيل النسخة الاحتياطية','',{icon:'download'})},
 async reloadData(el){el.disabled=true;try{await DB.load();DB.loadNotifs();render();toast('تم تحديث البيانات')}catch(e){toast('تعذّر تحديث البيانات',errMsg(e),{tone:'red',icon:'x'})}finally{el.disabled=false}},
 addIRow(){$('#irows').insertAdjacentHTML('beforeend',irow());calcNO()},
 async saveNewOrder(el){const f=$('#noForm');const d=Object.fromEntries(new FormData(f));
  const items=$$('#irows .irow').map(r=>{const sku=r.querySelector('select').value,q=+r.querySelector('input').value||0;const p=S.products.find(x=>x.variants.some(v=>v.sku===sku));const v=p&&p.variants.find(x=>x.sku===sku);return v&&q>0?{sku,pid:p.id,name:p.name,size:v.size,qty:q,price:v.price,cost:v.cost}:null}).filter(Boolean);
  if(!items.length){toast('أضف منتجاً واحداً على الأقل','',{tone:'red',icon:'x'});return}
  if(!d.cid&&(!d.name.trim()||!d.phone.trim())){toast('أدخل اسم العميل ورقم هاتفه','',{tone:'red',icon:'x'});return}
  el.disabled=true;const o=await createOrder({cid:d.cid||null,name:d.name,phone:d.phone,city:d.city,address:d.address,channel:d.channel,payment:d.payment,items,coupon:d.coupon.trim(),notes:d.notes});el.disabled=false;
  if(!o)return;save();closeModal();toast(`تم إنشاء الطلب #${o.id}`,`${fmt(o.total)} د.أ`,{act:()=>openOrderFn(o.id)});soft()}
};
const irow=()=>`<div class="irow"><select class="in">${S.products.filter(p=>p.active).flatMap(p=>p.variants.map(v=>`<option value="${v.sku}">${esc(p.name)} — ${esc(v.size)} — ${fmt(v.price)} د.أ${v.stock<=0?' (نفد)':''}</option>`)).join('')}</select><input class="in num" type="number" min="1" value="1"><button type="button" class="ib" data-act="rmRow">${ic('trash')}</button></div>`;
function newOrderModal(){
 openModal('طلب جديد (هاتف / واتساب)',`<form class="form c2" id="noForm">
  <label class="field span2"><span>العميل</span><select class="in" name="cid" id="noCid"><option value="">+ عميل جديد</option>${[...S.customers].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(c=>`<option value="${c.id}">${esc(c.name)} — ${c.phone}</option>`).join('')}</select></label>
  <div class="span2 form c2" id="noNew"><label class="field"><span>الاسم</span><input class="in" name="name"></label><label class="field"><span>الهاتف</span><input class="in" name="phone" dir="ltr" placeholder="07XXXXXXXX"></label><label class="field"><span>المدينة</span><select class="in" name="city">${CITIES.map(c=>opt(c,c,'عمّان')).join('')}</select></label><label class="field"><span>العنوان</span><input class="in" name="address"></label></div>
  <label class="field"><span>المصدر</span><select class="in" name="channel">${Object.entries(CHANNELS).map(([k,t])=>opt(k,t,'whatsapp')).join('')}</select></label>
  <label class="field"><span>الدفع</span><select class="in" name="payment">${opt('cod','الدفع عند الاستلام','cod')}${opt('cliq','تحويل CliQ','cod')}${opt('wallet','محفظة إلكترونية','cod')}${opt('card','دفع إلكتروني (بطاقة)','cod')}</select></label>
  <div class="span2"><span class="muted sm">المنتجات</span><div id="irows" style="margin-top:8px">${irow()}</div><button type="button" class="btn btn--sm btn--cream" data-act="addIRow">${ic('plus')}إضافة منتج</button></div>
  <label class="field"><span>كود خصم</span><input class="in" name="coupon" dir="ltr" style="text-transform:uppercase" placeholder="OLGA10"></label>
  <label class="field"><span>ملاحظات</span><input class="in" name="notes"></label>
  <div class="span2 box"><div class="lines" id="noSum"></div></div></form>`,
 `<button class="btn btn--olive" data-act="saveNewOrder">${ic('check')}إنشاء الطلب</button><button class="btn btn--ghost" data-act="closeModal">إلغاء</button>`);
 calcNO();
}
function calcNO(){const f=$('#noForm');if(!f)return;const cid=f.cid.value;$('#noNew').style.display=cid?'none':'';
 let sub=0;$$('#irows .irow').forEach(r=>{const v=S.products.flatMap(p=>p.variants).find(x=>x.sku===r.querySelector('select').value);sub+=(v?.price||0)*(+r.querySelector('input').value||0)});
 const city=cid?findC(cid)?.city:f.city.value;const del=city==='عمّان'?+S.settings.deliveryAmman:+S.settings.deliveryOther;
 const cp=S.coupons.find(x=>x.code===f.coupon.value.trim().toUpperCase()&&x.active&&(!x.expires||+new Date(x.expires)>Date.now())&&x.used<x.limit);const dis=cp&&sub>=cp.min?(cp.type==='pct'?sub*cp.value/100:cp.value):0;
 $('#noSum').innerHTML=`<div><span class="muted">المجموع الفرعي</span><span>${JD(sub)}</span></div>${dis?`<div><span class="muted">خصم ${cp.code}</span><span style="color:var(--bad)">− ${JD(dis)}</span></div>`:''}<div><span class="muted">التوصيل (${city})</span><span>${JD(del)}</span></div><div class="tot"><span>الإجمالي</span><span>${JD(sub-dis+del)}</span></div>`}

/* ---------- global listeners ---------- */
document.addEventListener('click',e=>{
 const a=e.target.closest('[data-act]');
 if(!e.target.closest('.pop')&&!e.target.closest('#bellBtn')&&!e.target.closest('#gsearch'))$$('.pop').forEach(p=>p.classList.remove('on'));
 if(!a)return;const fn=ACT[a.dataset.act];if(!fn)return;
 if(a.tagName==='A'&&a.getAttribute('href')?.startsWith('#/')===false)return;
 if(a.tagName==='BUTTON'||a.tagName==='TR'||a.tagName==='DIV')e.preventDefault();
 fn(a,e);
});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.id==='delAllIn'){const b=$('#delAllGo');if(b)b.disabled=t.value.trim()!=='حذف الكل'}
 if(t.dataset.ui){UI[t.dataset.ui]=t.value;const k=t.dataset.ui;
  if(k.startsWith('ord')){UI.ordLimit=25;$('#ordList').innerHTML=ordersList();afterRender($('#ordList'))}
  else if(k.startsWith('cust')){UI.custLimit=30;$('#custList').innerHTML=custList()}
  else if(k.startsWith('prod')){$('#prodList').innerHTML=prodList()}}
 if(t.dataset.live==='push'){$('#pnT').textContent=$('#pushForm').title.value;$('#pnB').textContent=$('#pushForm').body.value}
 if(t.closest('#noForm'))calcNO();
 if(t.closest('#barForm')){$('#barPrev').textContent=t.value}
 if(t.id==='gq')gsearch(t.value);
});
document.addEventListener('change',e=>{
 const t=e.target,k=t.dataset.chg;if(t.closest('#noForm'))calcNO();if(!k)return;
 if(k==='stockSet'){const v=S.products.flatMap(p=>p.variants).find(x=>x.sku===t.dataset.sku);v.stock=Math.max(0,Math.round(+t.value||0));W(sb.from('product_variants').update({stock:v.stock}).eq('sku',v.sku),'تعذّر حفظ المخزون');log(`عدّل مخزون ${v.sku} إلى ${v.stock}`);save();$('#prodList').innerHTML=prodList()}
 else if(k==='togActive'){const p=findP(t.dataset.id);p.active=t.checked;W(sb.from('products').update({active:p.active}).eq('id',p.id));log(`${p.active?'أظهر':'أخفى'} ${p.name} في المتجر`);save();toast(p.active?'المنتج ظاهر في المتجر':'تم إخفاء المنتج من المتجر',p.name);$('#prodList').innerHTML=prodList()}
 else if(k==='togCoupon'){const c=S.coupons[t.dataset.i];c.active=t.checked;W(sb.from('coupons').update({active:c.active}).eq('code',c.code));log(`${c.active?'فعّل':'أوقف'} الكود ${c.code}`);save()}
 else if(k==='togOffer'){const o=S.offers[t.dataset.i];o.active=t.checked;W(sb.from('offers').update({active:o.active}).eq('id',o.id));log(`${o.active?'فعّل':'أوقف'} العرض «${o.name}»`);save();render()}
 else if(k==='togBanner'){const b=S.content.banners[t.dataset.i];b.active=t.checked;putSetting('content',S.content);log(`${b.active?'أظهر':'أخفى'} بنر «${b.title}»`);save();render()}
 else if(k==='perm'){S.perms[t.dataset.r][t.dataset.m]=t.value;putSetting('perms',S.perms);log(`غيّر صلاحية ${ROLES[t.dataset.r]} على «${MODULES.find(m=>m.id===t.dataset.m).t}» إلى ${PERM_T[t.value]}`);save();toast('تم تحديث الصلاحيات')}
 else if(k==='setFlag'){S.settings[t.dataset.k]=t.checked;putSetting('store',S.settings);save();if(t.dataset.k==='live'){schedulePoll();if(t.checked)poll()}}
});
/* kanban drag & drop */
document.addEventListener('dragstart',e=>{const c=e.target.closest?.('.kcard');if(!c)return;e.dataTransfer.setData('text/plain',c.dataset.id);e.dataTransfer.effectAllowed='move';c.classList.add('drag')});
document.addEventListener('dragend',e=>{e.target.closest?.('.kcard')?.classList.remove('drag');$$('.kcol.over').forEach(c=>c.classList.remove('over'))});
document.addEventListener('dragover',e=>{const col=e.target.closest?.('.kcol');if(!col)return;e.preventDefault();col.classList.add('over')});
document.addEventListener('dragleave',e=>{const col=e.target.closest?.('.kcol');if(col&&!col.contains(e.relatedTarget))col.classList.remove('over')});
document.addEventListener('drop',e=>{const col=e.target.closest?.('.kcol');if(!col)return;e.preventDefault();col.classList.remove('over');const o=findO(e.dataTransfer.getData('text/plain'));if(o&&o.status!==col.dataset.s&&canEdit('orders'))setStatus(o,col.dataset.s)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();$('#gq').focus()}});
window.addEventListener('hashchange',()=>{if(ME){closeAll();render();scrollTo(0,0)}});

function gsearch(q){const p=$('#gqPop');q=q.trim().toLowerCase();if(!q){p.classList.remove('on');return}
 const qo=q.replace('#','');
 const os=can('orders')?S.orders.filter(o=>String(o.id).includes(qo)||o.name.toLowerCase().includes(q)||o.phone.includes(q)).slice(-5).reverse():[];
 const cs=can('customers')?S.customers.filter(c=>c.name.toLowerCase().includes(q)||c.phone.includes(q)).slice(0,5):[];
 const ps=can('products')?S.products.filter(x=>x.name.toLowerCase().includes(q)||x.en.toLowerCase().includes(q)).slice(0,4):[];
 p.innerHTML=(os.length?`<div class="pop__g">الطلبات</div>${os.map(o=>`<button class="pi" data-act="openOrder" data-id="${o.id}"><span class="ic">${ic('cart')}</span><div><b>#${o.id} · ${esc(o.name)}</b><small>${fdate(o.date)} · ${fmt(o.total)} د.أ · ${STATUS[o.status].t}</small></div></button>`).join('')}`:'')
 +(cs.length?`<div class="pop__g">العملاء</div>${cs.map(c=>`<button class="pi" data-act="openCust" data-id="${c.id}"><span class="ic">${ic('users')}</span><div><b>${esc(c.name)}</b><small class="num">${c.phone} · ${c.city}</small></div></button>`).join('')}`:'')
 +(ps.length?`<div class="pop__g">المنتجات</div>${ps.map(x=>`<a class="pi" href="#/products"><span class="ic">${ic('cube')}</span><div><b>${esc(x.name)}</b><small>${x.variants.map(v=>v.size).join(' · ')}</small></div></a>`).join('')}`:'')
 ||empty('لا توجد نتائج');p.classList.add('on')}

/* ---------- responsive tables: label every cell with its column title ---------- */
function labelTables(){
 $$('table.tbl').forEach(t=>{
  const fresh=t.querySelectorAll('td:not([data-w])');if(!fresh.length)return;
  const hr=t.tHead&&t.tHead.rows[t.tHead.rows.length-1],heads=[];
  if(hr)[...hr.cells].forEach(c=>{const tx=c.textContent.trim();for(let k=0;k<(c.colSpan||1);k++)heads.push(tx)});
  [...t.tBodies,...(t.tFoot?[t.tFoot]:[])].forEach(sec=>[...sec.rows].forEach(r=>{let col=0;[...r.cells].forEach(c=>{const span=c.colSpan||1;
   if(c.tagName==='TD'&&!c.dataset.w){c.dataset.w=1;const w=document.createElement('span');w.className='tdv';while(c.firstChild)w.appendChild(c.firstChild);c.appendChild(w);if(span===1&&heads[col])c.dataset.label=heads[col]}
   col+=span})}));
 });
}
let LT=0;new MutationObserver(()=>{if(!LT)LT=requestAnimationFrame(()=>{LT=0;labelTables()})}).observe(document.body,{childList:true,subtree:true});
$('#nav').addEventListener('click',e=>{if(e.target.closest('a'))closeAll()});
matchMedia('(min-width:1025px)').addEventListener('change',e=>{if(e.matches&&$('#app').classList.contains('nav-open'))closeAll()});

/* ---------- auth & boot ---------- */
function showApp(){
 $('#login').classList.add('hide');$('#app').classList.remove('hide');document.body.classList.remove('locked');
 $('#uchip').innerHTML=`<div class="meta"><b>${esc(ME.name)}</b><small>${ROLES[ME.role]}</small></div>${avatar(ME.name,'dk')}<button class="ib sm" data-act="logout" title="تسجيل الخروج">${ic('logout')}</button>`;
 render();schedulePoll();
}
/* signed in with Supabase Auth → check the staff role, load the data, open the panel */
async function enter(user){
 const{data:role,error}=await sb.rpc('current_staff_role');
 if(error)throw error;
 if(!role)return false;
 ME={id:user.id,name:user.email,email:user.email,role,active:true};
 await DB.load();
 if(!S.staff.some(u=>u.id===ME.id))S.staff.push(ME);
 DB.loadNotifs();
 sb.rpc('touch_last_seen').then(()=>{});
 return true;
}
function setBusy(on){const b=$('#loginBtn');if(!b)return;b.disabled=on;b.textContent=on?'جارٍ الدخول…':'دخول إلى اللوحة'}
function showLogin(){
 $('#loginForm').onsubmit=async e=>{e.preventDefault();const f=e.target;$('#loginErr').textContent='';setBusy(true);
  try{
   const{data,error}=await sb.auth.signInWithPassword({email:f.email.value.trim().toLowerCase(),password:f.pass.value});
   if(error){$('#loginErr').textContent=/confirm/i.test(error.message)?'يجب تأكيد البريد الإلكتروني أولاً من الرابط المرسل إليك':/Invalid login/i.test(error.message)?'البريد الإلكتروني أو كلمة المرور غير صحيحة':errMsg(error);return}
   if(!await enter(data.user)){await sb.auth.signOut();$('#loginErr').textContent='هذا الحساب ليس له صلاحية دخول للوحة أو أنه موقوف، تواصل مع المدير';return}
   log('تسجيل دخول');showApp();toast(`أهلاً ${ME.name.split(' ')[0]} 🌿`,ROLES[ME.role]);
  }catch(err){console.error(err);$('#loginErr').textContent='تعذّر تحميل البيانات: '+errMsg(err)}
  finally{setBusy(false)}};
}
showLogin();
(async()=>{
 try{const{data:{session}}=await sb.auth.getSession();
  if(session){setBusy(true);if(await enter(session.user)){showApp();return}await sb.auth.signOut()}}
 catch(err){console.error(err);$('#loginErr').textContent='تعذّر تحميل البيانات: '+errMsg(err)}
 finally{setBusy(false)}
})();
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&ME)location.reload()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ME&&S.settings.live)poll()});
})();
