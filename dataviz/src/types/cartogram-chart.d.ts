declare module 'cartogram-chart' {
  export default class Cartogram {
    constructor(element?: HTMLElement | null);
    width(value: number): this;
    height(value: number): this;
    topoJson(value: any): this;
    topoObjectName(value: string): this;
    projection(value: any): this;
    iterations(value: number): this;
    value(accessor: number | string | ((feature: any) => number)): this;
    color(accessor: string | ((feature: any) => string)): this;
    label(accessor: string | ((feature: any) => string)): this;
    valFormatter(fn: (value: number) => string): this;
    units(units: string): this;
  }
}

declare module 'topojson-server' {
  import type { GeometryCollection, FeatureCollection } from 'geojson';
  import type { Topology } from 'topojson-specification';

  export function topology(
    objects: Record<string, FeatureCollection | GeometryCollection>,
    quantization?: number
  ): Topology;
}
