import { hexToLab, labToHex, lightenLab, mixLab } from "@/lib/color";

export interface HijabStudyProps {
  colour: string;
  name?: string;
  finish?: string;
  skin?: string;
  className?: string;
}

/**
 * A fashion-illustration study, not a face render. Used where no camera is
 * available and as the landing-page object.
 */
export function HijabStudy({
  colour,
  name = "Saffron",
  finish = "Satin",
  skin = "#B98663",
  className,
}: HijabStudyProps) {
  const uid = colour.replace("#", "").toLowerCase();
  const base = hexToLab(colour);
  const light = labToHex(lightenLab(base, 9));
  const lighter = labToHex(lightenLab(base, 18));
  const dark = labToHex(lightenLab(base, -11));
  const deeper = labToHex(lightenLab(base, -22));
  const inner = labToHex(mixLab(base, { l: 22, a: base.a * 0.6, b: base.b * 0.6 }, 0.45));
  const skinLab = hexToLab(skin);
  const skinLight = labToHex(lightenLab(skinLab, 7));
  const skinShade = labToHex(lightenLab(skinLab, -9));

  return (
    <svg
      className={className ?? "study-svg"}
      viewBox="0 0 480 620"
      role="img"
      aria-label={`Illustration of a ${name.toLowerCase()} hijab in ${finish.toLowerCase()} finish`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="38%" cy="24%" r="86%">
          <stop offset="0%" stopColor="#FBF7EF" />
          <stop offset="58%" stopColor="#EADFCF" />
          <stop offset="100%" stopColor="#D9CAB5" />
        </radialGradient>
        <linearGradient id={`fabric-${uid}`} x1="0%" y1="0%" x2="84%" y2="100%">
          <stop offset="0%" stopColor={lighter} />
          <stop offset="28%" stopColor={light} />
          <stop offset="62%" stopColor={colour} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`fabric-shade-${uid}`} x1="20%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor={colour} stopOpacity="0" />
          <stop offset="70%" stopColor={deeper} stopOpacity="0.22" />
          <stop offset="100%" stopColor={deeper} stopOpacity="0.38" />
        </linearGradient>
        <radialGradient id={`face-${uid}`} cx="42%" cy="36%" r="72%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="68%" stopColor={skin} />
          <stop offset="100%" stopColor={skinShade} />
        </radialGradient>
        <linearGradient id={`neck-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={skinShade} />
          <stop offset="100%" stopColor={skin} />
        </linearGradient>
        <mask id={`opening-${uid}`}>
          <rect width="480" height="620" fill="white" />
          <path
            d="M240 142c48 0 78 36 82 94 3 48-11 96-38 121-11 11-30 18-44 18s-33-7-44-18c-27-25-41-73-38-121 4-58 34-94 82-94Z"
            fill="black"
          />
        </mask>
        <clipPath id={`hijab-${uid}`}>
          <path d="M240 62c-84 0-140 54-150 136-8 66 14 112 0 182-15 76-28 160 2 240h296c30-80 17-164 2-240-14-70 8-116 0-182-10-82-66-136-150-136Z" />
        </clipPath>
        <filter id={`soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="480" height="620" fill={`url(#bg-${uid})`} />
      <path d="M0 480c92-34 170-24 240-4 86 24 158 20 240-12v156H0Z" fill="#D4C4AE" opacity="0.5" />

      {/* neck and shoulders */}
      <path d="M206 342h68v94h-68z" fill={`url(#neck-${uid})`} />
      <path d="M72 620c8-102 62-152 134-178h68c72 26 126 76 134 178Z" fill={inner} />
      <path d="M72 620c8-102 62-152 134-178h68c72 26 126 76 134 178Z" fill={`url(#fabric-shade-${uid})`} opacity="0.5" />

      {/* face */}
      <path
        d="M240 142c48 0 78 36 82 94 3 48-11 96-38 121-11 11-30 18-44 18s-33-7-44-18c-27-25-41-73-38-121 4-58 34-94 82-94Z"
        fill={`url(#face-${uid})`}
      />
      <path
        d="M240 142c48 0 78 36 82 94 3 48-11 96-38 121-11 11-30 18-44 18s-33-7-44-18c-27-25-41-73-38-121 4-58 34-94 82-94Z"
        fill="none"
        stroke={skinShade}
        strokeOpacity="0.25"
        strokeWidth="1"
      />

      {/* minimal features */}
      <g stroke="#4A2C22" strokeLinecap="round" fill="none">
        <path d="M186 243c10-8 25-8 35 0" strokeWidth="2.6" opacity="0.72" />
        <path d="M259 243c10-8 25-8 35 0" strokeWidth="2.6" opacity="0.72" />
        <path d="M193 266c9-6 20-6 29 0-9 8-20 8-29 0Z" fill="#F7F0E7" fillOpacity="0.96" strokeWidth="1.4" />
        <path d="M258 266c9-6 20-6 29 0-9 8-20 8-29 0Z" fill="#F7F0E7" fillOpacity="0.96" strokeWidth="1.4" />
        <circle cx="207.5" cy="266" r="5" fill="#3A2118" stroke="none" />
        <circle cx="272.5" cy="266" r="5" fill="#3A2118" stroke="none" />
        <circle cx="209" cy="264" r="1.4" fill="#FFFDF8" stroke="none" />
        <circle cx="274" cy="264" r="1.4" fill="#FFFDF8" stroke="none" />
        <path d="M190 262c11-8 24-7 35-1" strokeWidth="1.9" opacity="0.66" />
        <path d="M255 261c12-6 25-7 35 1" strokeWidth="1.9" opacity="0.66" />
        <path d="M188 261c-2-3-3-5-2-7" strokeWidth="1.6" opacity="0.6" />
        <path d="M292 261c2-3 3-5 2-7" strokeWidth="1.6" opacity="0.6" />
        <path d="M240 278c-2 12-4 22-2 27 2 4 7 5 11 3" strokeWidth="1.5" opacity="0.48" />
        <path d="M224 332c5-4 11-6 16-6s11 2 16 6" strokeWidth="1.5" opacity="0.52" />
        <path d="M224 332c10-3 22-3 32 0-10 9-22 9-32 0Z" fill="#8E4A42" fillOpacity="0.68" stroke="none" />
        <path d="M229 335c7-2 15-2 22 0" strokeWidth="0.9" opacity="0.4" />
        <ellipse cx="205" cy="296" rx="13" ry="7" fill="#B4554A" fillOpacity="0.16" stroke="none" />
        <ellipse cx="275" cy="296" rx="13" ry="7" fill="#B4554A" fillOpacity="0.16" stroke="none" />
        <circle cx="240" cy="282" r="2.2" fill="#FFFDF8" fillOpacity="0.32" stroke="none" />
        <ellipse cx="240" cy="231" rx="22" ry="8" fill="#FFFDF8" fillOpacity="0.07" stroke="none" />
      </g>

      {/* hijab */}
      <g>
        <path
          d="M240 62c-84 0-140 54-150 136-8 66 14 112 0 182-15 76-28 160 2 240h296c30-80 17-164 2-240-14-70 8-116 0-182-10-82-66-136-150-136Z"
          fill={`url(#fabric-${uid})`}
          mask={`url(#opening-${uid})`}
        />
        <g mask={`url(#opening-${uid})`}>
          <path
            d="M240 62c-84 0-140 54-150 136-8 66 14 112 0 182-15 76-28 160 2 240h296c30-80 17-164 2-240-14-70 8-116 0-182-10-82-66-136-150-136Z"
            fill={`url(#fabric-shade-${uid})`}
          />
          <g clipPath={`url(#hijab-${uid})`}>
            <path
              d="M102 118c46-42 104-46 138-46 36 0 92 6 138 46"
              fill="none"
              stroke={lighter}
              strokeOpacity="0.5"
              strokeWidth="2"
            />
            <g fill="none" strokeLinecap="round">
              <path d="M136 80c-24 70-28 168-12 262-16 92-24 186-8 286" stroke={deeper} strokeOpacity="0.14" strokeWidth="10" />
              <path d="M180 70c-18 82-22 180-8 278-14 94-16 184-4 280" stroke={lighter} strokeOpacity="0.18" strokeWidth="6" />
              <path d="M300 70c18 82 22 180 8 278 14 94 16 184 4 280" stroke={deeper} strokeOpacity="0.16" strokeWidth="12" />
              <path d="M344 80c24 70 28 168 12 262 16 92 24 186 8 286" stroke={lighter} strokeOpacity="0.2" strokeWidth="5" />
              <path d="M126 96c-16 74-18 160-6 250-12 90-18 178-10 274" stroke={deeper} strokeOpacity="0.1" strokeWidth="3" />
              <path d="M354 96c16 74 18 160 6 250 12 90 18 178 10 274" stroke={deeper} strokeOpacity="0.1" strokeWidth="3" />
            </g>
            <ellipse cx="240" cy="438" rx="88" ry="26" fill={deeper} opacity="0.2" filter={`url(#soft-${uid})`} />
          </g>
        </g>
        {/* inner hem shadow */}
        <path
          d="M240 142c48 0 78 36 82 94 3 48-11 96-38 121-11 11-30 18-44 18s-33-7-44-18c-27-25-41-73-38-121 4-58 34-94 82-94Z"
          fill="none"
          stroke={deeper}
          strokeOpacity="0.42"
          strokeWidth="5"
        />
        <path
          d="M240 148c44 0 72 34 76 88 3 44-10 89-35 113-10 10-27 16-41 16s-31-6-41-16c-25-24-38-69-35-113 4-54 32-88 76-88Z"
          fill="none"
          stroke={lighter}
          strokeOpacity="0.28"
          strokeWidth="1"
        />
        {/* pin */}
        <circle cx="342" cy="306" r="6" fill="#C9A45C" />
        <circle cx="342" cy="306" r="2.2" fill="#8B6A2F" />
      </g>
    </svg>
  );
}
