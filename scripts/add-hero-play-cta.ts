import { readFileSync, writeFileSync } from "node:fs";

let src = readFileSync("apps/rg-website/src/components/home/LandingHero.tsx", "utf8");

if (!src.includes("import Link from")) {
  src = src.replace('import Image from "next/image";', 'import Image from "next/image";\nimport Link from "next/link";');
}

const mobileSearch = "<GlobalSearch isMobileHero />\n            </div>";
const mobilePlayCta = `<GlobalSearch isMobileHero />
            </div>
            <div className="mt-3 w-full max-w-[300px]">
              <Link href="/play" className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-linear-to-r from-[#F07D7D] to-[#F4D03F] text-black font-black text-sm uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition">
                Jouer à IEVR Web
              </Link>`;

if (!src.includes('href="/play"')) {
  src = src.replace(mobileSearch, mobilePlayCta);

  const desktopSearch = "<GlobalSearch isHero />\n          </div>";
  const desktopPlayCta = `<GlobalSearch isHero />
          </div>
          <div className="flex items-center gap-3 animate-[fadeSlideUp_0.6s_ease-out_1s_both]">
            <Link href="/play" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#F07D7D] to-[#F4D03F] text-black font-black text-sm uppercase tracking-wider shadow-xl hover:brightness-110 active:scale-95 transition">
              Jouer à IEVR dans le navigateur
            </Link>
            <span className="text-xs text-white/50 font-medium">100% WebAssembly Rust · 60 FPS</span>
          </div>`;
  src = src.replace(desktopSearch, desktopPlayCta);

  writeFileSync("apps/rg-website/src/components/home/LandingHero.tsx", src);
  console.log("Added /play CTA buttons to LandingHero");
} else {
  console.log("LandingHero already has /play");
}
