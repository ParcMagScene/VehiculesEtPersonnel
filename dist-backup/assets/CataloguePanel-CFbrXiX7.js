const o="chargement://load";function a(n){return`${o}?reservation_id=${encodeURIComponent(n)}`}function c(n){const e=JSON.stringify(n);return`${o}?equipment=${encodeURIComponent(e)}`}function l(n){const e=document.createElement("a");e.href=n,e.style.display="none",document.body.appendChild(e);let t=!1;const i=setTimeout(()=>{t||(console.warn("Application Chargement 3D non détectée"),alert(`L'application Chargement 3D ne semble pas installée.

URL générée :
`+n+`

Copiez cette URL et ouvrez-la dans l'application Chargement.`)),document.body.removeChild(e)},2e3),r=()=>{t=!0,clearTimeout(i),window.removeEventListener("blur",r)};window.addEventListener("blur",r),e.click()}function d(n){if(!n)return"—";try{const e=typeof n=="string"?JSON.parse(n):n;return e.w&&e.h&&e.d?`${e.w} × ${e.h} × ${e.d} cm`:e.length&&e.width&&e.height?`${e.length} × ${e.width} × ${e.height} cm`:JSON.stringify(e)}catch{return"—"}}export{a,c as b,d as f,l as o};
//# sourceMappingURL=CataloguePanel-CFbrXiX7.js.map
