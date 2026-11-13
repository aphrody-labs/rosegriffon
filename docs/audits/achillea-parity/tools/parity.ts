// Achilléa legacy-parity pixel diff.
//
//   bun docs/audits/achillea-parity/tools/parity.ts <label> <route...>
//
// <route> is a legacy Angular path ("" = home, "ranked/tiers", ...). The legacy
// build (served by serve-legacy.ts, default http://localhost:4300) is captured
// at a 1216 px viewport so that its `main.outlet-wrapper` has the same width as
// the port's `.achillea-scope` inside the Rose Griffon shell at 1440 px.
// Both crops are top-left aligned, padded with black to the larger size, and a
// pixel counts as different when |dR|+|dG|+|dB| > 30. Output, half-scale PNGs:
//   docs/audits/achillea-parity/<label>/<route>.{legacy,port,diff}.png
//   docs/audits/achillea-parity/<label>/results.json
import { launch } from "./cdp";

const [label, ...routes] = process.argv.slice(2);
if (!label || routes.length === 0)
  throw new Error("usage: parity.ts <label> <route...>");
const LEG = process.env.LEG ?? "http://localhost:4300";
const NEW = process.env.NEW ?? "http://localhost:3311/achillea";
const H = Number(process.env.H ?? 1400);
const WAIT = Number(process.env.WAIT ?? 9000);
const outdir = `${import.meta.dir}/../${label}`;

const c = await launch(Number(process.env.CDP_PORT ?? 9335));

async function grab(url: string, sel: string, vw: number): Promise<string> {
  await c.send("Emulation.setDeviceMetricsOverride", {
    width: vw,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await c.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await c.send("Page.navigate", { url });
  await Bun.sleep(WAIT);
  await c.evaluate("document.fonts.ready.then(()=>1)");
  await c.evaluate(
    "(()=>{document.querySelectorAll('nextjs-portal').forEach(e=>e.remove());return 1})()",
  );
  const r = await c.evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height}})()`,
  );
  if (!r) throw new Error(`no ${sel} on ${url}`);
  const shot = await c.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: r.x,
      y: r.y,
      width: Math.min(r.w, 1440),
      height: Math.min(r.h, H),
      scale: 1,
    },
  });
  return shot.data as string;
}

const results: Record<string, number> = {};
for (const route of routes) {
  const name = route === "" ? "home" : route.replace(/[/:?=]/g, "_");
  const a = await grab(
    `${LEG}/${route}`,
    process.env.LSEL ?? "main.outlet-wrapper",
    1216,
  );
  const b = await grab(
    `${NEW}${route ? `/${route}` : ""}`,
    process.env.NSEL ?? ".achillea-scope",
    1440,
  );
  await c.send("Page.navigate", { url: "about:blank" });
  await Bun.sleep(300);
  const out = await c.evaluate(`(async()=>{
    const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s});
    const [A,B]=await Promise.all([load('${a}'),load('${b}')]);
    const w=Math.max(A.width,B.width),h=Math.max(A.height,B.height);
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');
    x.fillStyle='#000';x.fillRect(0,0,w,h);x.drawImage(A,0,0);const da=x.getImageData(0,0,w,h);
    x.fillRect(0,0,w,h);x.drawImage(B,0,0);const db=x.getImageData(0,0,w,h);
    const o=x.createImageData(w,h);let n=0;
    for(let i=0;i<da.data.length;i+=4){
      const d=Math.abs(da.data[i]-db.data[i])+Math.abs(da.data[i+1]-db.data[i+1])+Math.abs(da.data[i+2]-db.data[i+2]);
      if(d>30){n++;o.data[i]=255;o.data[i+3]=255}else{const g=da.data[i]*.3;o.data[i]=o.data[i+1]=o.data[i+2]=g;o.data[i+3]=255}
    }
    x.putImageData(o,0,0);
    const half=img=>{const k=document.createElement('canvas');k.width=Math.ceil(img.width/2);k.height=Math.ceil(img.height/2);
      k.getContext('2d').drawImage(img,0,0,k.width,k.height);return k.toDataURL('image/png').split(',')[1]};
    return {pct:n/(w*h)*100,A:half(A),B:half(B),D:half(cv)}})()`);
  await Bun.write(`${outdir}/${name}.legacy.png`, Buffer.from(out.A, "base64"));
  await Bun.write(`${outdir}/${name}.port.png`, Buffer.from(out.B, "base64"));
  await Bun.write(`${outdir}/${name}.diff.png`, Buffer.from(out.D, "base64"));
  results[name] = Number(out.pct.toFixed(2));
  console.log(`${name}\t${results[name]}%`);
}
const file = `${outdir}/results.json`;
const previous = (await Bun.file(file).exists())
  ? await Bun.file(file).json()
  : {};
await Bun.write(
  file,
  `${JSON.stringify({ ...previous, ...results }, null, 2)}\n`,
);
c.close();
process.exit(0);
