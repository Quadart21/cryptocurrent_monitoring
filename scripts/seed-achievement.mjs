import fs from "fs";

const p = ".data/store.json";
const s = JSON.parse(fs.readFileSync(p, "utf8"));
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.3 7L12 16.8 5.7 21 8 14 2 9.2h7.6L12 2z"/></svg>';

if (!Array.isArray(s.achievements)) s.achievements = [];

let ach = s.achievements.find((a) => a.id === "ach_star");
if (!ach) {
  ach = {
    id: "ach_star",
    name: "Топ",
    description: "Отмеченный администратором обменник",
    svg,
    createdAt: new Date().toISOString(),
  };
  s.achievements.push(ach);
} else {
  ach.svg = svg;
  ach.name = ach.name || "Топ";
  ach.description =
    ach.description || "Отмеченный администратором обменник";
}

for (const ex of s.exchangers) {
  if (!Array.isArray(ex.achievementIds)) ex.achievementIds = [];
  if (!ex.achievementIds.includes(ach.id)) ex.achievementIds.push(ach.id);
}

fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log(
  "ok",
  s.exchangers.map((e) => ({ name: e.name, ach: e.achievementIds })),
  s.achievements.map((a) => a.id + ":" + a.name),
);
