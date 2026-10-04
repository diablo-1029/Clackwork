import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { appPath } from "./appPath";

describe("app paths", () => {
  it("sits at the root locally and under the repository folder on GitHub Pages", () => {
    expect(appPath("/sw.js", "")).toBe("/sw.js");
    expect(appPath("/sw.js", "/Clackwork")).toBe("/Clackwork/sw.js");
    expect(appPath("icons/icon-192.png", "/Clackwork")).toBe("/Clackwork/icons/icon-192.png");
  });
});

describe("install manifest", () => {
  const data = manifest();

  it("opens full screen from the game's own folder", () => {
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe(appPath("/"));
    expect(data.scope).toBe(data.start_url);
  });

  it("offers the icon sizes phones ask for, including a maskable one", () => {
    const icons = data.icons ?? [];
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) expect(icon.src.startsWith(appPath("/icons/"))).toBe(true);
  });
});
