import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import { Button } from "../src/components/button";
import { Badge } from "../src/components/badge";
import { breakpointForWidth } from "../src/hooks/use-mobile";
import { classifyWidth } from "@aphrody/m3-tokens/breakpoints";

test("Base UI button retains semantic button and disabled behavior during SSR", () => {
  const html = renderToStaticMarkup(
    createElement(Button, { disabled: true, children: "Save" }),
  );
  expect(html).toContain("<button");
  expect(html).toContain("disabled");
  expect(html).toContain("Save");
  expect(html).not.toContain("<button><button");
});

test("asChild preserves the consumer element without a nested button", () => {
  const html = renderToStaticMarkup(
    createElement(
      Button,
      { asChild: true },
      createElement("a", { href: "/reader" }, "Read"),
    ),
  );
  expect(html).toContain('href="/reader"');
  expect(html).toContain("Read");
  expect(html).not.toContain("<button");
});

test("badge keeps its content and responsive classes share the canonical owner", () => {
  const html = renderToStaticMarkup(createElement(Badge, {}, "Ready"));
  expect(html).toContain("Ready");
  expect(html).toContain('data-slot="badge"');
  expect(breakpointForWidth).toBe(classifyWidth);
});

test("asChild accepts a Flight lazy child from a Server Component (home page SSR)", () => {
  // react-server-dom passes elements from a Server Component to a client component as
  // `react.lazy` nodes whose payload is a thenable chunk; Children.only used to reject them.
  const link = createElement(
    "a",
    { href: "/projets" },
    "Voir tous les projets",
  );
  const chunk = Object.assign(Promise.resolve(link), {
    status: "fulfilled",
    value: link,
  });
  const lazyChild = {
    $$typeof: Symbol.for("react.lazy"),
    _payload: chunk,
    _init: () => link,
  } as unknown as ReactNode;
  const html = renderToStaticMarkup(
    createElement(Button, { asChild: true, variant: "outline" }, lazyChild),
  );
  expect(html).toContain('href="/projets"');
  expect(html).toContain("Voir tous les projets");
  expect(html).toContain('data-slot="button"');
  expect(html).not.toContain("<button");
});

test("asChild resolves a synchronous lazy node through its initializer", () => {
  const link = createElement("a", { href: "/wiki" }, "Wiki");
  const lazyChild = {
    $$typeof: Symbol.for("react.lazy"),
    _payload: { status: "resolved" },
    _init: () => link,
  } as unknown as ReactNode;
  expect(
    renderToStaticMarkup(createElement(Button, { asChild: true }, lazyChild)),
  ).toContain('href="/wiki"');
});

test("asChild still rejects several children", () => {
  expect(() =>
    renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true },
        createElement("a"),
        createElement("a"),
      ),
    ),
  ).toThrow();
});
