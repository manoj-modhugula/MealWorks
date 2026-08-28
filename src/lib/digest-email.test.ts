import { describe, expect, it } from "vitest";
import {
  buildDigestEmail,
  glanceDate,
  platesFromCombos,
  scoreRingPng,
  trayLine,
} from "./digest-email";

const payload = {
  date: "2026-08-28",
  verdict: "great",
  headline: "A strong board today",
  summary: "Plenty you can eat.",
  score: 82,
  plates: [
    {
      meal: "breakfast" as const,
      items: ["Scrambled Eggs", "Mango Turmeric Crush"],
    },
    {
      meal: "lunch" as const,
      items: ["Pollo a la Brasa", "Sofrito Rice"],
    },
  ],
};

describe("platesFromCombos", () => {
  it("takes breakfast and lunch ideas only, max three names", () => {
    expect(
      platesFromCombos([
        { title: "Breakfast idea", items: ["Eggs", "Yogurt", "Fruit", "Extra"] },
        { title: "Lunch idea", items: ["Pollo"] },
        { title: "Salad bowl", items: ["Lettuce"] },
      ])
    ).toEqual([
      { meal: "breakfast", items: ["Eggs", "Yogurt", "Fruit"] },
      { meal: "lunch", items: ["Pollo"] },
    ]);
  });
});

describe("glanceDate", () => {
  it("is a single short line", () => {
    expect(glanceDate("2026-08-28")).toBe("Fri 28 Aug");
  });
});

describe("trayLine", () => {
  it("packs a tray when there are plates", () => {
    expect(trayLine(true, "Manoj")).toBe("I packed you a tray, Manoj.");
  });

  it("says so when the tray is empty", () => {
    expect(trayLine(false, "Manoj")).toBe(
      "I couldn’t find a tray, Manoj. Peek the board."
    );
  });
});

describe("scoreRingPng", () => {
  it("is a png of the circular score ring", async () => {
    const png = await scoreRingPng(82);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(png.length).toBeGreaterThan(200);
  });
});

describe("buildDigestEmail", () => {
  const mailP = buildDigestEmail({
    userName: "Manoj",
    payload,
    appUrl: "http://localhost:3000",
  });

  it("uses plain words in the subject", async () => {
    const mail = await mailP;
    expect(mail.subject).toBe("Your tray · 82");
    expect(mail.subject).not.toMatch(/pip/i);
  });

  it("puts the plate on the left of the glance card, with a score ring", async () => {
    const mail = await mailP;
    const firstCard = mail.html.indexOf("border-radius:18px");
    const tray = mail.html.indexOf("cid:tray");
    const ring = mail.html.indexOf("cid:ring");
    const secondCard = mail.html.indexOf("border-radius:18px", firstCard + 1);
    expect(firstCard).toBeGreaterThan(-1);
    expect(tray).toBeGreaterThan(firstCard);
    expect(tray).toBeLessThan(secondCard);
    expect(ring).toBeGreaterThan(tray);
    expect(ring).toBeLessThan(secondCard);
    expect(mail.html).toMatch(/cid:tray[\s\S]*cid:ring/);
    expect(mail.html).not.toContain("conic-gradient");
  });

  it("is a glance card plus breakfast and lunch, no Skip, no mystery names", async () => {
    const mail = await mailP;
    expect(mail.html).toContain("Fri 28 Aug");
    expect(mail.html).toContain("82");
    expect(mail.html).toContain("Breakfast");
    expect(mail.html).toContain("Scrambled Eggs");
    expect(mail.html).toContain("Lunch");
    expect(mail.html).toContain("Pollo a la Brasa");
    expect(mail.html).toContain("See the board");
    expect(mail.html).not.toMatch(/Skip/i);
    expect(mail.html).not.toMatch(/Pip/i);
    expect(mail.html).not.toContain("http://localhost:3000/pip.png");
    expect(mail.text).toContain("I packed you a tray, Manoj.");
    expect(mail.text).not.toMatch(/Skip/i);
    expect(mail.text).not.toMatch(/Pip/i);
    expect(mail.attachments?.map((a) => a.cid)).toEqual(["tray", "ring"]);
  });
});
