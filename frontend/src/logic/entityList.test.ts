import { entity } from "./fixtures";
import { kindCounts, listEntities } from "./entityList";

const pedro = entity({
  id: "e_003",
  name: "Pedro Nogueira",
  emails: ["pedro.nogueira@caravela.io"],
  mentions: [
    { signal_id: "s_001", surface: "Pedro Nogueira" },
    { signal_id: "s_007", surface: "Pedro do comercial" },
  ],
});
const translog = entity({
  id: "e_002",
  name: "Translog",
  kind: "ORGANIZATION",
  aliases: ["Trans Log"],
  mentions: [{ signal_id: "s_001", surface: "Translog" }],
});
const luiz = entity({
  id: "e_005",
  name: "Luiz Barreto",
  mentions: [{ signal_id: "s_001", surface: "Luiz Barreto" }],
});
const all = [translog, pedro, luiz];

test("lists every kind in alphabetical order", () => {
  const listed = listEntities({ entities: all, kind: "all", query: "" });
  expect(listed.map((item) => item.name)).toEqual(["Luiz Barreto", "Pedro Nogueira", "Translog"]);
});

test("sorts ignoring case and accents", () => {
  const names = ["Rodobrás", "agencia Lume", "Álvaro", "Banco Aurora"].map((name, index) =>
    entity({ id: `e_${String(index)}`, name }),
  );
  const listed = listEntities({ entities: names, kind: "all", query: "" });
  expect(listed.map((item) => item.name)).toEqual([
    "agencia Lume",
    "Álvaro",
    "Banco Aurora",
    "Rodobrás",
  ]);
});

test("filters by kind", () => {
  const listed = listEntities({ entities: all, kind: "ORGANIZATION", query: "" });
  expect(listed.map((item) => item.id)).toEqual(["e_002"]);
});

test("combines kind filter with the search query", () => {
  expect(listEntities({ entities: all, kind: "PERSON", query: "trans" })).toEqual([]);
  const found = listEntities({ entities: all, kind: "all", query: "trans log" });
  expect(found.map((item) => item.id)).toEqual(["e_002"]);
});

test("counts entities per kind for the filter labels", () => {
  expect(kindCounts(all)).toEqual({ all: 3, PERSON: 2, ORGANIZATION: 1 });
});
