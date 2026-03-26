const { test, expect } = require("@playwright/test");

const STORY_CODES = [
  "01 / Overview",
  "02 / Orchestrate",
  "03 / Security",
  "04 / Delivery",
  "05 / Edge",
  "06 / Build"
];

async function scrollCardToFocusLine(page, index) {
  await page.locator(".story-card").nth(index).evaluate((element, focusRatio) => {
    const rect = element.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - window.innerHeight * focusRatio + 32;
    window.scrollTo(0, targetY);
  }, 0.43);
  await page.waitForTimeout(180);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
  });
});

function headerLink(page, label) {
  return page.locator(".header-nav").getByRole("link", { name: label, exact: true });
}

test("primary navigation lands on the expected sections", async ({ page }) => {
  const navTargets = [
    ["Architecture", "#stack"],
    ["Capabilities", "#capabilities"],
    ["Delivery", "#flow"],
    ["Stack", "#surface"],
    ["Contexts", "#sectors"]
  ];

  for (const [label, selector] of navTargets) {
    await headerLink(page, label).click();
    await expect.poll(async () => {
      return page.locator(selector).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= -24 && rect.top <= window.innerHeight * 0.35;
      });
    }).toBe(true);
  }
});

test("architecture narrative progresses in order while scrolling", async ({ page }) => {
  await headerLink(page, "Architecture").click();

  await expect(page.locator("#scene-code")).toHaveText(STORY_CODES[0]);

  const scrollBounds = await page.locator("#stack .story-steps").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      start: window.scrollY,
      end: window.scrollY + rect.bottom - window.innerHeight * 0.42
    };
  });

  const seenCodes = [(await page.locator("#scene-code").textContent()).trim()];
  for (let y = scrollBounds.start + 110; y <= scrollBounds.end; y += 110) {
    await page.evaluate((targetY) => window.scrollTo(0, targetY), y);
    await page.waitForTimeout(90);
    seenCodes.push((await page.locator("#scene-code").textContent()).trim());
  }

  const uniqueCodes = [...new Set(seenCodes)];
  const numericOrder = uniqueCodes.map((code) => Number.parseInt(code, 10));

  expect(uniqueCodes[0]).toBe(STORY_CODES[0]);
  expect(numericOrder).toEqual([...numericOrder].sort((left, right) => left - right));

  for (const code of STORY_CODES) {
    expect(uniqueCodes).toContain(code);
  }
});

test("story cards and stack controls drive the live topology highlight", async ({ page }) => {
  await expect(page.locator(".system-shell .orbit-node")).toHaveCount(5);

  await scrollCardToFocusLine(page, 0);
  await expect(page.locator(".system-shell")).toHaveAttribute("data-highlight", "overview");

  await page.locator('.system-shell .orbit-node[data-scene="delivery"]').click();
  await expect(page.locator(".system-shell")).toHaveAttribute("data-highlight", "delivery");
  await expect(page.locator("#system-core-label")).toHaveText("04 / Delivery");

  await page.locator(".story-card").nth(3).click();
  await expect(page.locator(".system-shell")).toHaveAttribute("data-highlight", "delivery");
  await expect(page.locator("#scene-code")).toHaveText("04 / Delivery");

  await page.locator(".tech-group").filter({ hasText: "Edge + AI" }).getByRole("button", { name: "Jetson", exact: true }).hover();
  await expect(page.locator(".system-shell")).toHaveAttribute("data-highlight", "edge");
  await expect(page.locator(".orbit-node.is-highlighted")).toHaveCount(1);

  await page.getByRole("button", { name: "Embedded hardening path" }).click();
  await expect(page.locator(".system-shell")).toHaveAttribute("data-highlight", "security");
});

test("each architecture card can take focus and activate its matching layer", async ({ page }) => {
  await headerLink(page, "Architecture").click();

  for (let index = 0; index < STORY_CODES.length; index += 1) {
    await scrollCardToFocusLine(page, index);
    await expect.poll(async () => {
      return page.locator(".story-card").nth(index).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 72 && rect.bottom <= window.innerHeight - 24;
      });
    }).toBe(true);
    await page.locator(".story-card").nth(index).focus();
    await expect(page.locator("#scene-code")).toHaveText(STORY_CODES[index]);
  }
});
