/**
 * Morning digest: two small cards — date + score ring, then breakfast/lunch.
 */

import path from "path";
import sharp from "sharp";

export type DigestPlate = {
  meal: "breakfast" | "lunch";
  items: string[];
};

export type DigestEmailPayload = {
  date: string;
  verdict: string;
  headline: string;
  summary: string;
  score: number;
  plates: DigestPlate[];
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function glanceDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} ${MONTHS[mo - 1]}`;
}

export function platesFromCombos(
  combos: { title: string; items?: string[] }[] | undefined
): DigestPlate[] {
  const out: DigestPlate[] = [];
  const slots: { title: string; meal: DigestPlate["meal"] }[] = [
    { title: "Breakfast idea", meal: "breakfast" },
    { title: "Lunch idea", meal: "lunch" },
  ];
  for (const slot of slots) {
    const hit = combos?.find((c) => c.title === slot.title);
    const items = (hit?.items || []).map((n) => String(n).trim()).filter(Boolean).slice(0, 3);
    if (items.length) out.push({ meal: slot.meal, items });
  }
  return out;
}

export function trayLine(hasPlates: boolean, name: string): string {
  const who = name.trim() || "there";
  if (!hasPlates) {
    return `I couldn’t find a tray, ${who}. Peek the board.`;
  }
  return `I packed you a tray, ${who}.`;
}

const RING_PX = 72;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
}

function scoreRingSvg(score: number): string {
  const pct = clampScore(score);
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const ink = pct >= 70 ? "#2563eb" : pct >= 40 ? "#9a6700" : "#3a3a3c";
  const px = RING_PX * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="7"/>
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"/>
  <text x="50" y="58" text-anchor="middle" font-size="26" font-weight="650" fill="#111111" font-family="Georgia, 'Times New Roman', serif">${pct}</text>
</svg>`;
}

/** Same arc as the Today ring, as a PNG so mail apps actually show it. */
export async function scoreRingPng(score: number): Promise<Buffer> {
  return sharp(Buffer.from(scoreRingSvg(score))).png().toBuffer();
}

function scoreRingHtml(score: number): string {
  const pct = clampScore(score);
  return `<img src="cid:ring" width="${RING_PX}" height="${RING_PX}" alt="${pct}" style="display:block;border:0;width:${RING_PX}px;height:${RING_PX}px;">`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MEAL_LABEL: Record<DigestPlate["meal"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
};

function plateText(plates: DigestPlate[]) {
  if (!plates.length) return "";
  return plates
    .map((p) => {
      const names = p.items.map((n) => `  · ${n}`).join("\n");
      return `${MEAL_LABEL[p.meal]}\n${names}`;
    })
    .join("\n\n");
}

function mealBlock(plate: DigestPlate) {
  const rows = plate.items
    .map(
      (n) =>
        `<tr><td style="padding:0 0 6px;font-size:15px;line-height:1.35;color:#1a1714;">${escapeHtml(n)}</td></tr>`
    )
    .join("");
  return `<tr><td style="padding:14px 0 6px;font-size:12px;font-weight:700;color:#8a8178;">${MEAL_LABEL[plate.meal]}</td></tr>${rows}`;
}

export async function buildDigestEmail(opts: {
  userName?: string;
  payload: DigestEmailPayload;
  appUrl?: string;
}) {
  const { payload } = opts;
  const name = opts.userName?.trim() || "there";
  const base = (
    opts.appUrl ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const todayUrl = `${base}/today`;
  const plates = payload.plates || [];
  const hasPlates = plates.some((p) => p.items.length > 0);
  const line = trayLine(hasPlates, name);
  const dateLine = glanceDate(payload.date);
  const score = Math.round(Number(payload.score) || 0);

  const subject = `Your tray · ${score}`;

  const text = [
    line,
    ``,
    `${dateLine}  ·  ${score}`,
    ``,
    hasPlates ? plateText(plates) : "",
    `See the board: ${todayUrl}`,
  ]
    .filter((row) => row !== "")
    .join("\n");

  const trayInner = hasPlates
    ? plates.map(mealBlock).join("")
    : `<tr><td style="padding:4px 0 8px;font-size:15px;line-height:1.45;color:#5c534a;">I couldn’t find a tray.</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1714;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e8;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="360" cellpadding="0" cellspacing="0" style="max-width:360px;width:100%;background:#fffaf3;border:1px solid #eadfce;border-radius:18px;">
          <tr>
            <td style="padding:16px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" width="80" style="width:80px;padding:0 12px 0 0;">
                    <img src="cid:tray" width="72" height="72" alt="" style="display:block;border:0;width:72px;height:72px;border-radius:16px;">
                  </td>
                  <td valign="middle" style="padding:0;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:0 0 6px;font-size:14px;color:#5c534a;">${escapeHtml(dateLine)}</td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 8px;">${scoreRingHtml(score)}</td>
                      </tr>
                      <tr>
                        <td style="padding:0;font-size:15px;line-height:1.35;color:#1a1714;">${escapeHtml(line)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="360" cellpadding="0" cellspacing="0" style="max-width:360px;width:100%;background:#fffaf3;border:1px solid #eadfce;border-radius:18px;margin-top:12px;">
          <tr>
            <td style="padding:8px 22px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${trayInner}
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:14px;"><a href="${escapeHtml(todayUrl)}" style="color:#1a1714;text-decoration:none;font-weight:600;">See the board →</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    text,
    html,
    attachments: [
      {
        filename: "tray.png",
        path: path.join(process.cwd(), "public", "pip.png"),
        cid: "tray",
      },
      {
        filename: "ring.png",
        content: await scoreRingPng(score),
        cid: "ring",
        contentType: "image/png",
      },
    ],
  };
}
