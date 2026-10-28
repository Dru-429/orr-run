export type Billboard = {
  id: string;
  name: string;
  distanceFromStart: number;
  image: string;
};

const BRANDING = {
  dhruv: {name: 'Dhruv Sahoo', image: '/branding/dhruv_sahoo.png'},
  wrapped: {name: 'GitHub Wrapped', image: '/branding/github_wrapped.png'},
  adSpace: {name: 'Ad Space', image: '/branding/ad_space.png'},
  adSpace2: {name: 'Ad Space 2', image: '/branding/ad_space_2.png'},
} as const;

// These are the twenty route-side boards. Their route station, display name and
// artwork are edited here; placement geometry is derived from distanceFromStart
// by the existing hoarding placement logic. Gaps start at ~250 and grow to ~850,
// so boards are densest near the start of the route.
const layout: {distanceFromStart: number; brand: keyof typeof BRANDING}[] = [
  {distanceFromStart: 400, brand: 'dhruv'},
  {distanceFromStart: 650, brand: 'wrapped'},
  {distanceFromStart: 950, brand: 'adSpace'},
  {distanceFromStart: 1250, brand: 'dhruv'},
  {distanceFromStart: 1600, brand: 'adSpace2'},
  {distanceFromStart: 2000, brand: 'wrapped'},
  {distanceFromStart: 2400, brand: 'dhruv'},
  {distanceFromStart: 2850, brand: 'adSpace'},
  {distanceFromStart: 3350, brand: 'wrapped'},
  {distanceFromStart: 3850, brand: 'adSpace2'},
  {distanceFromStart: 4400, brand: 'dhruv'},
  {distanceFromStart: 5000, brand: 'wrapped'},
  {distanceFromStart: 5600, brand: 'adSpace'},
  {distanceFromStart: 6250, brand: 'dhruv'},
  {distanceFromStart: 6900, brand: 'adSpace2'},
  {distanceFromStart: 7650, brand: 'wrapped'},
  {distanceFromStart: 8400, brand: 'dhruv'},
  {distanceFromStart: 9150, brand: 'adSpace'},
  {distanceFromStart: 9950, brand: 'wrapped'},
  {distanceFromStart: 10800, brand: 'adSpace2'},
];

export const billboards: Billboard[] = layout.map(({distanceFromStart, brand}, i) => ({
  id: `game-hoarding-${String(i + 1).padStart(2, '0')}`,
  name: BRANDING[brand].name,
  distanceFromStart,
  image: BRANDING[brand].image,
}));

export const billboardById = new Map(billboards.map(billboard => [billboard.id, billboard]));

export function getBillboard(id: string): Billboard {
  const billboard = billboardById.get(id);
  if (!billboard) throw new Error(`Unknown billboard id: ${id}`);
  return billboard;
}

export function billboardIndex(id: string): number {
  return billboards.findIndex(billboard => billboard.id === id);
}