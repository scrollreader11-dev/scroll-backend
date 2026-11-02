import{j as e}from"./datastore-D8dMU_a2.js";import{a as r}from"./glyphs-DZUMdJa2.js";import{h as v,d as Y}from"./reading-list-DOPLsy_V.js";import{g as G,p as R}from"./algebra-CtsY-DbB.js";import{m as M}from"./kinematics-DdCwx9OL.js";let b=null,k=null;function O(n){if(!n||typeof n!="string")return"";let t=n.trim();return(t.includes("/!!/")||t.includes("/n/m/")||t.startsWith("/f/g/"))&&(t=R(t)),(t.startsWith("/storage/")||t.startsWith("/f/g/")||t.startsWith("/!cover!/")||t.startsWith("/f/c/"))&&!t.includes("..")||/^https:\/\//i.test(t)?t:""}async function $(){return b||k||(k=(async()=>{try{const[n,t]=await Promise.all([fetch("/storage/data/collection.json"),fetch(v.apiPlays()).catch(()=>null)]),l=await n.json(),c=Array.isArray(l==null?void 0:l[v.kindG()])?l[v.kindG()]:[];let d={};if(t&&t.ok)try{const s=await t.json();d=s!=null&&s.plays&&typeof s.plays=="object"?s.plays:s||{}}catch{}const h=c.map(s=>{const i=O(s.imageUrl||""),x=String(s.label||"").trim();if(!i||!x)return null;const g=G({label:x,url:s.url||""});return{label:x,imageUrl:i,score:Number(d[g]||0)}}).filter(Boolean);return h.sort((s,i)=>i.score-s.score||s.label.localeCompare(i.label)),b=h.map(({label:s,imageUrl:i})=>({label:s,imageUrl:i})),b}catch{return b=[],[]}finally{k=null}})(),k)}const T=["Warming up the engine","Loading assets","Tip: favorite a game to find it faster","Tip: press F11 for fullscreen","Tip: your saves stay in this browser","Almost there"],N=9,C=6;function F({title:n,onDone:t,minMs:l=2400,beneath:c=!1,ready:d,zIndex:h}){var E;const s=d!==void 0,[i,x]=r.useState(b||[]),[g,A]=r.useState(!1),[z,j]=r.useState(0),[I,L]=r.useState(0);r.useEffect(()=>{let a=!1;return $().then(o=>{a||x(o)}),()=>{a=!0}},[]),r.useEffect(()=>{if(s){const p=window.setInterval(()=>j(m=>m+(92-m)*.06),120);return()=>window.clearInterval(p)}const a=Math.max(400,l),o=performance.now();let f=0;const u=p=>{const m=Math.min(1,(p-o)/a);j((1-Math.pow(1-m,3))*100),m<1&&(f=requestAnimationFrame(u))};return f=requestAnimationFrame(u),()=>cancelAnimationFrame(f)},[l,s]),r.useEffect(()=>{const a=window.setInterval(()=>L(o=>(o+1)%T.length),1700);return()=>window.clearInterval(a)},[]);const w=r.useCallback(()=>{A(a=>a||(window.setTimeout(t,520),!0))},[t]);r.useEffect(()=>{if(s)return;const a=window.setTimeout(()=>w(),Math.max(400,l));return()=>window.clearTimeout(a)},[w,l,s]),r.useEffect(()=>{if(s&&d){j(100);const a=window.setTimeout(()=>w(),250);return()=>window.clearTimeout(a)}},[s,d,w]);const P=(n==null?void 0:n.trim())||v.wordG(),y=r.useMemo(()=>{const a=(n||"").trim().toLowerCase();return a&&i.find(o=>o.label.toLowerCase()===a)||null},[i,n]),W=r.useMemo(()=>{const a=i.slice(0,N*C),o=[];for(let f=0;f<N;f++){const u=[];for(let p=0;p<C;p++){const m=a.length?a[(f+p*N)%a.length]:null;u.push(m||{label:"",imageUrl:""})}o.push(u)}return o},[i]),S=(y==null?void 0:y.imageUrl)||((E=i[0])==null?void 0:E.imageUrl)||"";return e.jsxs(M.div,{className:"shl-root",initial:{opacity:0},animate:{opacity:g?0:1},transition:{duration:g?.5:.35},style:{position:"absolute",inset:0,zIndex:h??(c?0:90),overflow:"hidden",pointerEvents:c?"none":"auto",background:"#05070d",color:"#fff"},children:[S?e.jsx("div",{className:"shl-backdrop",style:{backgroundImage:`url("${S}")`}}):null,e.jsx("div",{className:`shl-stage ${g?"is-exit":""}`,children:e.jsx("div",{className:"shl-wall",children:W.map((a,o)=>e.jsx("div",{className:`shl-col ${o%2?"down":"up"}`,style:{animationDuration:`${30+o*7%16}s`},children:[...a,...a].map((f,u)=>e.jsxs("div",{className:"shl-card",children:[f.label?e.jsx("span",{className:"shl-card-label",children:f.label}):null,f.imageUrl?e.jsx("img",{src:f.imageUrl,alt:"",decoding:"async",onError:p=>{p.target.style.display="none"}}):null]},u))},o))})}),e.jsx("div",{className:"shl-sweep"}),e.jsx("div",{className:"shl-vignette"}),e.jsx("div",{className:"shl-scan"}),e.jsxs("div",{className:`shl-center ${g?"is-exit":""}`,children:[e.jsx("img",{src:Y(),alt:"",className:"shl-logo"}),y?e.jsxs("div",{className:"shl-feature",children:[e.jsx("div",{className:"shl-ring"}),e.jsx("img",{src:y.imageUrl,alt:""})]}):null,e.jsxs("div",{className:"shl-eyebrow",children:[e.jsx("span",{className:"shl-dot"})," NOW LAUNCHING"]}),e.jsx("h1",{className:"shl-title",children:P}),e.jsx("div",{className:"shl-bar",children:e.jsx("div",{className:"shl-fill",style:{width:`${z}%`}})}),e.jsxs("div",{className:"shl-meta",children:[e.jsx("span",{className:"shl-tip",children:T[I]},I),e.jsxs("span",{className:"shl-pct",children:[Math.round(z),"%"]})]}),c?null:e.jsx("button",{type:"button",className:"shl-skip",onClick:w,children:"Skip"})]}),e.jsx("style",{children:`
        .shl-root { font-family: inherit; }
        .shl-backdrop {
          position: absolute; inset: -10%;
          background-size: cover; background-position: center;
          filter: blur(60px) saturate(1.6) brightness(0.55);
          opacity: 0.55;
          animation: shl-zoom 14s ease-in-out infinite alternate;
        }
        .shl-stage {
          position: absolute; inset: 0;
          perspective: 1100px;
          transition: transform .6s cubic-bezier(.6,0,.2,1), opacity .5s ease, filter .5s ease;
        }
        .shl-stage.is-exit { transform: scale(1.25); opacity: 0; filter: blur(6px); }
        .shl-wall {
          position: absolute; left: 50%; top: 50%;
          width: 170vmax; height: 170vmax;
          margin-left: -85vmax; margin-top: -85vmax;
          display: flex; gap: 14px; justify-content: center;
          transform: rotateX(32deg) rotateZ(-16deg);
          transform-style: preserve-3d;
        }
        .shl-col {
          display: flex; flex-direction: column; gap: 14px;
          width: clamp(84px, 7.5vw, 140px); flex: none;
          animation-timing-function: linear; animation-iteration-count: infinite;
          will-change: transform;
        }
        .shl-col.up   { animation-name: shl-up; }
        .shl-col.down { animation-name: shl-down; }
        .shl-card {
          position: relative; aspect-ratio: 3 / 4; border-radius: 14px; overflow: hidden; flex: none;
          background: linear-gradient(150deg, #1e2a4a, #0d1326 60%, #1a1238);
          border: 1px solid rgba(255,255,255,.08);
          box-shadow: 0 30px 60px -20px rgba(0,0,0,.8);
        }
        .shl-card img { position: relative; width: 100%; height: 100%; object-fit: cover; display: block; }
        .shl-card-label {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          padding: 10px; text-align: center; font-size: 12px; font-weight: 800; line-height: 1.15;
          color: rgba(190,210,255,.55); letter-spacing: -.01em; overflow-wrap: anywhere;
        }

        .shl-sweep {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 40%, rgba(120,180,255,.10) 50%, transparent 60%);
          background-size: 250% 100%;
          animation: shl-sweep 4.5s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        .shl-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 50% 46% at 50% 50%, rgba(5,7,13,.9) 0%, rgba(5,7,13,.55) 45%, rgba(5,7,13,.05) 80%),
            linear-gradient(to bottom, rgba(5,7,13,.85), transparent 22%, transparent 78%, rgba(5,7,13,.9));
        }
        .shl-scan {
          position: absolute; inset: 0; pointer-events: none; opacity: .06;
          background: repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 3px);
        }

        .shl-center {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 14px; padding: 24px; text-align: center;
          transition: transform .5s cubic-bezier(.6,0,.2,1), opacity .4s ease;
          animation: shl-rise .7s cubic-bezier(.2,.9,.2,1) both;
        }
        .shl-center.is-exit { transform: scale(.92); opacity: 0; }
        .shl-logo {
          position: absolute; top: 22px; left: 50%; transform: translateX(-50%);
          width: 34px; height: 34px; object-fit: contain;
          filter: drop-shadow(0 0 14px rgba(80,160,255,.7));
        }
        .shl-feature {
          position: relative; width: clamp(96px, 12vw, 140px); aspect-ratio: 3 / 4;
          margin-bottom: 6px;
          animation: shl-float 3.2s ease-in-out infinite alternate;
        }
        .shl-feature img {
          position: relative; width: 100%; height: 100%; object-fit: cover;
          border-radius: 18px; display: block;
          box-shadow: 0 25px 60px -10px rgba(40,120,255,.55);
        }
        .shl-ring {
          position: absolute; inset: -3px; border-radius: 21px;
          background: conic-gradient(from 0deg, #3b82f6, #22d3ee, #a855f7, #3b82f6);
          animation: shl-spin 3s linear infinite;
          filter: blur(.5px);
        }
        .shl-ring::after {
          content: ""; position: absolute; inset: -14px; border-radius: 30px;
          background: inherit; filter: blur(22px); opacity: .55;
        }
        .shl-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 700; letter-spacing: .32em;
          color: rgba(160,200,255,.85);
        }
        .shl-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #22d3ee;
          box-shadow: 0 0 10px #22d3ee; animation: shl-blink 1.1s ease-in-out infinite;
        }
        .shl-title {
          margin: 0; max-width: min(820px, 92vw);
          font-size: clamp(30px, 5.6vw, 68px); font-weight: 800; line-height: 1.02;
          letter-spacing: -0.035em;
          background: linear-gradient(90deg, #fff 0%, #9cc8ff 30%, #fff 50%, #c4a8ff 70%, #fff 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: shl-text 5s linear infinite;
          filter: drop-shadow(0 6px 30px rgba(60,140,255,.35));
          overflow-wrap: anywhere;
        }
        .shl-bar {
          position: relative; width: min(360px, 78vw); height: 6px; margin-top: 10px;
          border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        }
        .shl-fill {
          position: relative; height: 100%; border-radius: inherit;
          background: linear-gradient(90deg, #3b82f6, #22d3ee, #a855f7);
          box-shadow: 0 0 16px rgba(34,211,238,.8);
          transition: width .1s linear;
        }
        .shl-fill::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent);
          background-size: 40% 100%; background-repeat: no-repeat;
          animation: shl-shine 1.2s linear infinite;
        }
        .shl-meta {
          width: min(360px, 78vw); display: flex; justify-content: space-between;
          font-size: 12px; color: rgba(200,215,240,.7);
        }
        .shl-tip { animation: shl-tipin .4s ease both; }
        .shl-pct { font-variant-numeric: tabular-nums; font-weight: 700; color: rgba(230,240,255,.9); }
        .shl-skip {
          margin-top: 12px; padding: 9px 22px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 700; color: #fff;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
          backdrop-filter: blur(10px);
          transition: background .2s, transform .15s, box-shadow .2s;
        }
        .shl-skip:hover { background: rgba(59,130,246,.35); box-shadow: 0 0 24px rgba(59,130,246,.5); transform: translateY(-1px); }

        @keyframes shl-up    { from { transform: translateY(0); }    to { transform: translateY(-50%); } }
        @keyframes shl-down  { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        @keyframes shl-zoom  { from { transform: scale(1); } to { transform: scale(1.15); } }
        @keyframes shl-sweep { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
        @keyframes shl-spin  { to { transform: rotate(360deg); } }
        @keyframes shl-float { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-8px) rotate(2deg); } }
        @keyframes shl-blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        @keyframes shl-text  { to { background-position: -250% 0; } }
        @keyframes shl-shine { from { background-position: -40% 0; } to { background-position: 140% 0; } }
        @keyframes shl-tipin { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes shl-rise  { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }

        @media (prefers-reduced-motion: reduce) {
          .shl-col, .shl-backdrop, .shl-sweep, .shl-ring, .shl-feature, .shl-title, .shl-fill::after { animation: none !important; }
        }
      `})]})}const U=1500,H=15e3;function Z(n,t=!0){const[l,c]=r.useState("loading"),d=r.useRef(0),h=r.useRef(!1);return r.useEffect(()=>{c("loading"),d.current=Date.now(),h.current=!1;const i=setTimeout(()=>c("ready"),H);return()=>clearTimeout(i)},[n]),{unlocked:!0,phase:l,finishLoading:()=>{if(h.current)return;h.current=!0;const i=Date.now()-d.current;i>=U?c("ready"):setTimeout(()=>c("ready"),U-i)},hadAd:!1}}function J(n){const t=n==null?void 0:n.phase,l=typeof(n==null?void 0:n.title)=="string"?n.title:void 0,[c,d]=r.useState(!1);return r.useEffect(()=>{t==="loading"&&d(!1)},[t]),c?null:e.jsx(F,{title:l,ready:t==="ready",zIndex:2147483e3,onDone:()=>d(!0)})}export{F as G,J as I,Z as u};
