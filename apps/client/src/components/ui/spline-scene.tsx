"use client";

import { Suspense, lazy } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

type SplineSceneProps = {
  scene: string;
  className?: string;
};

export const SplineScene = ({ scene, className }: SplineSceneProps) => (
  <Suspense
    fallback={
      <div className="flex h-full w-full items-center justify-center">
        <span className="loader" />
      </div>
    }
  >
    <Spline scene={scene} className={className} />
  </Suspense>
);
