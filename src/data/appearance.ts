/** Hand-authored visual observations. Geometry remains the ODbL map extract.
 * Inferences are explicit: a modeled facade is not a claim of a current survey.
 */
export const APPEARANCE:Record<string,{palette:'glass'|'cream'|'shop'|'adobe'|'silver'|'sattva'|'green-glass';height?:number;name?:string;notes:string;reference:string;confidence:'observed'|'approximate'}>={
 '609637726':{palette:'glass',name:'Manipal Hospitals',notes:'April 2026 hospital-frontage view: blue glazing with pale vertical cladding and Manipal Hospitals wordmark. Height and entrance layout remain approximate.',reference:'https://www.google.com/maps/@?api=1&map_action=pano&pano=T9cxPbaOzrIr0KWkEO1K-w&heading=196.5&pitch=0&fov=100',confidence:'observed'},
 '381171222':{palette:'adobe',name:'Adobe · Prestige Platina Block 1',notes:'Blue glazing, pale vertical edge panels, horizontal floor bands, red Adobe signage. Geometry and 10 levels from OSM; simplified facade.',reference:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.9438,77.6976&heading=285&pitch=8&fov=90',confidence:'observed'},
 '381171221':{palette:'glass',name:'Prestige Platina Block 2',notes:'Set-back block; identity from OSM. Exact current facade not verified.',reference:'https://www.openstreetmap.org/way/381171221',confidence:'approximate'},
 '148325529':{palette:'silver',name:'JP Morgan · Prestige Tech Park',notes:'OSM office name. Does not represent the new Embassy TechVillage campus. Height and current branding uncertain.',reference:'https://www.openstreetmap.org/way/148325529',confidence:'approximate'},
 '380782190':{palette:'silver',height:18,notes:'Pale vertical piers and blue reflective glazing visible across the carriageway near 12.94141,77.69642. Estimated height.',reference:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.9414,77.69635&heading=178&pitch=0&fov=90',confidence:'observed'},
 '199853340':{palette:'cream',height:21,notes:'Hotel identity mapped as Octave; approximate storeys, not surveyed height.',reference:'https://www.openstreetmap.org/way/199853340',confidence:'approximate'},
 '431536369':{palette:'sattva',notes:'March 2026 side views at 750–825 m: white vertical panels, horizontal glazing, red and blue accent strips; SATTVA sign visible at 800 m. Storeys are mapped; height uses an estimated floor-to-floor conversion.',reference:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.9443409,77.6977975&heading=108.7&pitch=0&fov=100',confidence:'observed'},
 '1066506638':{palette:'green-glass',notes:'March/April 2026 views at 525–575 m show IndiQube: pale rectangular frame, green glazing and rooftop canopy. Height is approximate.',reference:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.942288,77.6968748&heading=119.6&pitch=0&fov=100',confidence:'observed'},
};
export const INFRASTRUCTURE={
 underpass:{from:138.56,to:207.35,depth:4.2,wallFinish:'blue-white vertical bands',reference:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.938237,77.694004&heading=45&pitch=0&fov=100',imageDate:'2025-12',heightConfidence:'approximate'},
 workZone:{from:840,to:950,offset:5,barrierWidth:.5,reference:'https://www.openstreetmap.org/way/1508372367',notes:'Mapped elevated station under construction. Individual barrier positions are illustrative.'},
};
