import { test, expect, type APIRequestContext } from '@playwright/test';
import { PlantPage } from '../pages';

type PopularPlant = {
  id: string;
  name: string;
  unitsSold: number;
};

type PopularList = {
  days: number;
  items: PopularPlant[];
};

async function fetchPopular(
  request: APIRequestContext,
  limit = 5,
): Promise<PopularPlant[]> {
  const response = await request.get('/api/popular', { params: { limit: String(limit) } });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as PopularList;
  return body.items;
}

function expectedOnPage(items: PopularPlant[], currentId: string): PopularPlant[] {
  return items.filter((item) => item.id !== currentId).slice(0, 4);
}

// executed — plant page Popular section vs GET /api/popular, exclude current, follow link

test('plant page Popular section matches API after excluding current plant', { tag: '@e2e' }, async ({
  page,
  request,
}) => {
  const plantId = 'pl-zz';
  const apiItems = await fetchPopular(request, 5);
  const expected = expectedOnPage(apiItems, plantId);
  expect(expected.length).toBeGreaterThan(0);

  const plant = new PlantPage(page);
  await plant.goto(plantId);

  await expect(plant.popularHeading).toBeVisible();
  await expect(plant.popularItems).toHaveCount(expected.length);

  for (let i = 0; i < expected.length; i += 1) {
    const item = expected[i];
    const row = plant.popularItems.nth(i);
    await expect(row).toContainText(item.name);
    await expect(row).toContainText(`${item.unitsSold} sold this month`);
    await expect(plant.popularLink(item.name)).toHaveAttribute('href', `/plants/${item.id}`);
  }

  await expect(plant.popularRegion).not.toContainText('ZZ Plant');
});

test('opening the #1 popular plant omits it and still shows up to four others', { tag: '@e2e' }, async ({
  page,
  request,
}) => {
  const apiItems = await fetchPopular(request, 5);
  expect(apiItems.length).toBeGreaterThan(0);
  const top = apiItems[0];
  const expected = expectedOnPage(apiItems, top.id);

  const plant = new PlantPage(page);
  await plant.goto(top.id);

  await expect(plant.popularHeading).toBeVisible();
  await expect(plant.popularItems).toHaveCount(expected.length);
  await expect(plant.popularRegion.getByRole('link', { name: top.name })).toHaveCount(0);

  for (let i = 0; i < expected.length; i += 1) {
    await expect(plant.popularItems.nth(i)).toContainText(expected[i].name);
    await expect(plant.popularItems.nth(i)).toContainText(`${expected[i].unitsSold} sold this month`);
  }
});

test('following a popular link lands on that plant page', { tag: '@e2e' }, async ({ page, request }) => {
  test.fail(true, 'F-21: popular link updates URL but plant page stays on the previous plant');
  const plantId = 'pl-snake';
  const apiItems = await fetchPopular(request, 5);
  const expected = expectedOnPage(apiItems, plantId);
  expect(expected.length).toBeGreaterThan(0);
  const target = expected[0];

  const plant = new PlantPage(page);
  await plant.goto(plantId);
  await expect(plant.popularHeading).toBeVisible();

  await plant.popularLink(target.name).click();
  await expect(page).toHaveURL(new RegExp(`/plants/${target.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: target.name })).toBeVisible();
});
