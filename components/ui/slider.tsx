"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import type * as React from "react";

import { cn } from "../../lib/utils";

function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className=""
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className=""
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        className=""
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
