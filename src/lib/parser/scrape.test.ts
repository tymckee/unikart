import { describe, it, expect } from "vitest";
import { amazonAsin, walmartItemId } from "./scrape";

describe("amazonAsin", () => {
  it("reads a clean /dp/ URL", () => {
    expect(amazonAsin("https://www.amazon.com/dp/B0FS74YSX4")).toBe("B0FS74YSX4");
    expect(amazonAsin("https://www.amazon.com/dp/B0FS74YSX4/ref=sr_1_2")).toBe(
      "B0FS74YSX4",
    );
  });

  it("reads /gp/product/ and /gp/aw/d/ URLs", () => {
    expect(amazonAsin("https://www.amazon.com/gp/product/B09XS7JWHH/")).toBe(
      "B09XS7JWHH",
    );
    expect(amazonAsin("https://www.amazon.com/gp/aw/d/B0CFPJYX7P?psc=1")).toBe(
      "B0CFPJYX7P",
    );
  });

  it("decodes the ASIN buried in a sponsored-ad /sspa/click link", () => {
    // The exact shape a Sponsored Products result hands you: the real ASIN is
    // URL-encoded inside the `url=` query param. This is the screenshot bug.
    const sspa =
      "https://www.amazon.com/sspa/click?ie=UTF8&spc=MTo0MzM5&url=%2FScale-Ultra-BodyScan-Smart-Handle%2Fdp%2FB0FS74YSX4%2Fref%3Dsr_1_2_sspa%3Fcrid%3D37G6RRKPKATVS&qualifier=1";
    expect(amazonAsin(sspa)).toBe("B0FS74YSX4");
  });

  it("does not invent an ASIN when there isn't one", () => {
    expect(amazonAsin("https://www.amazon.com/s?k=wyze+smart+scale")).toBe(null);
    expect(amazonAsin("https://a.co/d/abc123")).toBe(null);
  });

  it("uppercases a lowercased ASIN", () => {
    expect(amazonAsin("https://www.amazon.com/dp/b0fs74ysx4")).toBe("B0FS74YSX4");
  });
});

describe("walmartItemId", () => {
  it("reads the trailing item id from /ip/<slug>/<id>", () => {
    expect(
      walmartItemId(
        "https://www.walmart.com/ip/onn-65-Class-4K-UHD-Roku-Smart-TV/476550098",
      ),
    ).toBe("476550098");
  });

  it("reads /ip/<id> with no slug", () => {
    expect(walmartItemId("https://www.walmart.com/ip/5037331008")).toBe("5037331008");
  });

  it("ignores query/hash after the id", () => {
    expect(
      walmartItemId("https://www.walmart.com/ip/Some-Product/123456789?from=search"),
    ).toBe("123456789");
  });

  it("returns null when there is no item id", () => {
    expect(walmartItemId("https://www.walmart.com/browse/tvs/3944_1060825")).toBe(
      null,
    );
    expect(walmartItemId("https://www.walmart.com/")).toBe(null);
  });
});
