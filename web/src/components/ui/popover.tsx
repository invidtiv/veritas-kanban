import * as React from 'react';
import { Popover as MantinePopover, type PopoverProps as MantinePopoverProps } from '@mantine/core';

import { cn } from '@/lib/utils';

type PopoverProps = Omit<MantinePopoverProps, 'opened' | 'defaultOpened' | 'onChange'> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Popover({
  open,
  defaultOpen,
  onOpenChange,
  offset = 4,
  radius = 'md',
  shadow = 'md',
  withinPortal = true,
  ...props
}: PopoverProps) {
  return (
    <MantinePopover
      opened={open}
      defaultOpened={defaultOpen}
      onChange={onOpenChange}
      offset={offset}
      radius={radius}
      shadow={shadow}
      withinPortal={withinPortal}
      {...props}
    />
  );
}

function PopoverTrigger({
  asChild: _asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  return <MantinePopover.Target>{children}</MantinePopover.Target>;
}

type PopoverContentProps = React.ComponentProps<typeof MantinePopover.Dropdown> & {
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
};

function PopoverContent({
  className,
  align: _align,
  side: _side,
  sideOffset: _sideOffset,
  ...props
}: PopoverContentProps) {
  return (
    <MantinePopover.Dropdown
      data-slot="popover-content"
      className={cn(
        'z-50 flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden',
        className
      )}
      {...props}
    />
  );
}

function PopoverAnchor({ children }: { children: React.ReactNode }) {
  return <MantinePopover.Target>{children}</MantinePopover.Target>;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-0.5 text-sm', className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <div data-slot="popover-title" className={cn('font-medium', className)} {...props} />;
}

function PopoverDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
