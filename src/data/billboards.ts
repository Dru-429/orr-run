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
  {id: 'game-hoarding-01', name: 'Antimatter Truck', distanceFromStart: 400, image: '/brandings/antimattr-truck.png'},
  {id: 'game-hoarding-02', name: 'Antimatter White', distanceFromStart: 1200, image: '/brandings/antimattr-white.svg'},
  {id: 'game-hoarding-03', name: 'Antimatter', distanceFromStart: 2000, image: '/brandings/antimattr.svg'},
  {id: 'game-hoarding-04', name: 'Antimatter Truck', distanceFromStart: 2800, image: '/brandings/antimattr-truck.png'},
  {id: 'game-hoarding-05', name: 'Antimatter White', distanceFromStart: 3600, image: '/brandings/antimattr-white.svg'},
  {id: 'game-hoarding-06', name: 'Antimatter', distanceFromStart: 4400, image: '/brandings/antimattr.svg'},
  {id: 'game-hoarding-07', name: 'Antimatter Truck', distanceFromStart: 5200, image: '/brandings/antimattr-truck.png'},
  {id: 'game-hoarding-08', name: 'Antimatter White', distanceFromStart: 6000, image: '/brandings/antimattr-white.svg'},
  {id: 'game-hoarding-09', name: 'Antimatter', distanceFromStart: 6800, image: '/brandings/antimattr.svg'},
  {id: 'game-hoarding-10', name: 'Antimatter Truck', distanceFromStart: 7600, image: '/brandings/antimattr-truck.png'},
  {id: 'game-hoarding-11', name: 'Antimatter White', distanceFromStart: 8400, image: '/brandings/antimattr-white.svg'},
  {id: 'game-hoarding-12', name: 'Antimatter', distanceFromStart: 9200, image: '/brandings/antimattr.svg'},
  {id: 'game-hoarding-13', name: 'Antimatter Truck', distanceFromStart: 10000, image: '/brandings/antimattr-truck.png'},
  {id: 'game-hoarding-14', name: 'Antimatter White', distanceFromStart: 10800, image: '/brandings/antimattr-white.svg'},
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
