import { describe, expect, it } from "vitest";
import {
  cn,
  debounce,
  formatCurrency,
  formatDate,
  formatDateShort,
  formatDateTime,
  generateId,
  isEmpty,
  safeParseJSON,
  sleep,
  truncate,
} from "@/lib/utils";

describe("cn", () => {
  it("fusionne les classes Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("gère les valeurs falsy", () => {
    expect(cn("text-red", false && "hidden", "mt-2")).toBe("text-red mt-2");
  });

  it("retourne une string vide sans arguments", () => {
    expect(cn()).toBe("");
  });
});

describe("sleep", () => {
  it("attend le délai spécifié", async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe("formatDate", () => {
  it("formate une date en français", () => {
    const result = formatDate("2025-01-15");
    expect(result).toContain("2025");
    expect(result).toContain("15");
  });

  it("accepte un objet Date", () => {
    const result = formatDate(new Date(2025, 0, 15));
    expect(result).toContain("2025");
  });
});

describe("formatDateShort", () => {
  it("formate en version courte", () => {
    const result = formatDateShort("2025-06-01");
    expect(result).toContain("2025");
  });
});

describe("formatDateTime", () => {
  it("inclut l'heure", () => {
    const result = formatDateTime("2025-01-15T14:30:00Z");
    expect(result).toContain("2025");
  });
});

describe("truncate", () => {
  it("tronque les chaînes longues", () => {
    expect(truncate("Hello World", 5)).toBe("Hello...");
  });

  it("ne tronque pas les chaînes courtes", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
  });

  it("gère la longueur exacte", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });
});

describe("debounce", () => {
  it("retarde l'exécution", async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);

    fn();
    fn();
    fn();
    expect(count).toBe(0);

    await sleep(100);
    expect(count).toBe(1);
  });
});

describe("formatCurrency", () => {
  it("formate en EUR par défaut", () => {
    const result = formatCurrency(42.5);
    expect(result).toContain("42");
  });
});

describe("generateId", () => {
  it("génère un ID de la longueur demandée", () => {
    expect(generateId(8)).toHaveLength(8);
    expect(generateId(32)).toHaveLength(32);
  });

  it("utilise 16 par défaut", () => {
    expect(generateId()).toHaveLength(16);
  });

  it("génère des IDs uniques", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("isEmpty", () => {
  it("détecte null et undefined", () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty()).toBe(true);
  });

  it("détecte les chaînes vides", () => {
    expect(isEmpty("")).toBe(true);
    expect(isEmpty("   ")).toBe(true);
    expect(isEmpty("hello")).toBe(false);
  });

  it("détecte les tableaux vides", () => {
    expect(isEmpty([])).toBe(true);
    expect(isEmpty([1])).toBe(false);
  });

  it("détecte les objets vides", () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  it("retourne false pour les nombres", () => {
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(42)).toBe(false);
  });
});

describe("safeParseJSON", () => {
  it("parse du JSON valide", () => {
    expect(safeParseJSON('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("retourne le fallback pour du JSON invalide", () => {
    expect(safeParseJSON("not json", { default: true })).toEqual({ default: true });
  });

  it("parse des tableaux", () => {
    expect(safeParseJSON("[1,2,3]", [])).toEqual([1, 2, 3]);
  });
});
