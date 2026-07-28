import "leaflet";

declare module "leaflet" {
  namespace ExtraMarkers {
    interface IconOptions extends L.BaseIconOptions {
      icon?: string;
      markerColor?:
        | "red"
        | "orange-dark"
        | "orange"
        | "yellow-dark"
        | "yellow"
        | "blue-dark"
        | "cyan"
        | "purple"
        | "violet"
        | "pink"
        | "green-dark"
        | "green"
        | "green-light"
        | "black"
        | "white";
      shape?: "circle" | "square" | "star" | "penta";
      prefix?: string;
      extraClasses?: string;
      iconColor?: string;
      iconRotate?: number;
      number?: string;
      svg?: boolean;
    }
    class Icon extends L.Icon {
      constructor(options: IconOptions);
    }
    function icon(options: IconOptions): Icon;
  }
}
