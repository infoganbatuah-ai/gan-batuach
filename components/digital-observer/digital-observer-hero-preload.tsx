"use client";

import ReactDOM from "react-dom";

const digitalObserverHeroImage = "/assets/digital-observer/home-camera-grid.jpg";

export function DigitalObserverHeroPreload() {
  ReactDOM.preload(digitalObserverHeroImage, {
    as: "image",
    fetchPriority: "high",
  });

  return null;
}
