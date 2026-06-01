'use client';

import * as React from 'react';
import {
  ScrollArea as MantineScrollArea,
  type ScrollAreaProps as MantineScrollAreaProps,
} from '@mantine/core';

import { cn } from '@/lib/utils';

function ScrollArea({
  className,
  children,
  onScroll,
  onScrollCapture,
  viewportProps,
  ...props
}: React.ComponentProps<'div'> & MantineScrollAreaProps) {
  const mergedViewportProps = {
    ...viewportProps,
    'data-slot': 'scroll-area-viewport',
    onScroll: (event: React.UIEvent<HTMLDivElement>) => {
      viewportProps?.onScroll?.(event);
      onScroll?.(event);
    },
    onScrollCapture: (event: React.UIEvent<HTMLDivElement>) => {
      viewportProps?.onScrollCapture?.(event);
      onScrollCapture?.(event);
    },
  };

  return (
    <MantineScrollArea
      data-slot="scroll-area"
      type="auto"
      className={cn('relative', className)}
      viewportProps={mergedViewportProps}
      {...props}
    >
      {children}
    </MantineScrollArea>
  );
}

function ScrollBar({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="scroll-area-scrollbar" className={cn('hidden', className)} {...props} />;
}

export { ScrollArea, ScrollBar };
