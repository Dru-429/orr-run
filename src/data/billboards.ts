export type Billboard = {
  id: string;
  name: string;
  distanceFromStart: number;
  image: string;
};

// These are the existing fourteen route-side boards. Their route station,
// display name and artwork are edited here; placement geometry is derived from
// distanceFromStart by the existing hoarding placement logic.
export const billboards: Billboard[] = [
  {id: 'game-hoarding-01', name: 'Dhruv Sahoo', distanceFromStart: 400, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-02', name: 'GitHub Wrapped', distanceFromStart: 1200, image: '/branding/github wrapped.png'},
  {id: 'game-hoarding-03', name: 'Dhruv Sahoo', distanceFromStart: 2000, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-04', name: 'GitHub Wrapped', distanceFromStart: 2800, image: '/branding/github wrapped.png'},
  {id: 'game-hoarding-05', name: 'Dhruv Sahoo', distanceFromStart: 3600, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-06', name: 'GitHub Wrapped', distanceFromStart: 4400, image: '/branding/github wrapped.png'},
  {id: 'game-hoarding-07', name: 'Dhruv Sahoo', distanceFromStart: 5200, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-08', name: 'GitHub Wrapped', distanceFromStart: 6000, image: '/branding/github wrapped.png'},
  {id: 'game-hoarding-09', name: 'Dhruv Sahoo', distanceFromStart: 6800, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-10', name: 'GitHub Wrapped', distanceFromStart: 7600, image: '/branding/github wrapped.png'},
  {id: 'game-hoarding-11', name: 'Dhruv Sahoo', distanceFromStart: 8400, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-12', name: 'GitHub Wrapped', distanceFromStart: 9200, image: '/branding/github wrapped.png'},
  {id: 'game-hoarding-13', name: 'Dhruv Sahoo', distanceFromStart: 10000, image: '/branding/dhruv sahoo.png'},
  {id: 'game-hoarding-14', name: 'GitHub Wrapped', distanceFromStart: 10800, image: '/branding/github wrapped.png'},
];

export const billboardById = new Map(billboards.map(billboard => [billboard.id, billboard]));

export function getBillboard(id: string): Billboard {
  const billboard = billboardById.get(id);
  if (!billboard) throw new Error(`Unknown billboard id: ${id}`);
  return billboard;
}

export function billboardIndex(id: string): number {
  return billboards.findIndex(billboard => billboard.id === id);
}
