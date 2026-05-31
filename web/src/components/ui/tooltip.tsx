'use client';

import * as React from 'react';
import { Tooltip as MantineTooltip, type TooltipProps as MantineTooltipProps } from '@mantine/core';

import { cn } from '@/lib/utils';

const TooltipDelayContext = React.createContext(0);

type TooltipPart = 'trigger' | 'content';
type TooltipTriggerProps = {
  asChild?: boolean;
  children?: React.ReactNode;
};
type TooltipContentProps = React.ComponentProps<'span'> & {
  side?: MantineTooltipProps['position'];
  sideOffset?: number;
};
type TooltipPartComponent = React.FC<TooltipTriggerProps | TooltipContentProps> & {
  __tooltipPart?: TooltipPart;
};

function isTooltipPart(
  child: React.ReactNode,
  part: TooltipPart
): child is React.ReactElement<TooltipTriggerProps | TooltipContentProps> {
  return React.isValidElement(child) && (child.type as TooltipPartComponent).__tooltipPart === part;
}

function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number;
  children?: React.ReactNode;
}) {
  return (
    <TooltipDelayContext.Provider value={delayDuration}>
      <MantineTooltip.Group openDelay={delayDuration}>{children}</MantineTooltip.Group>
    </TooltipDelayContext.Provider>
  );
}

type TooltipProps = Omit<
  MantineTooltipProps,
  'children' | 'defaultOpened' | 'label' | 'opened' | 'openDelay'
> & {
  children?: React.ReactNode;
  defaultOpen?: boolean;
  delayDuration?: number;
  open?: boolean;
};

function Tooltip({
  children,
  classNames,
  defaultOpen,
  delayDuration,
  offset,
  open,
  position,
  withArrow = true,
  ...props
}: TooltipProps) {
  const providerDelay = React.useContext(TooltipDelayContext);
  const childArray = React.Children.toArray(children);
  const trigger = childArray.find((child) => isTooltipPart(child, 'trigger'));
  const content = childArray.find((child) => isTooltipPart(child, 'content'));
  const triggerChildren = trigger?.props.children;
  const contentProps = content?.props as TooltipContentProps | undefined;
  const classNameMap =
    classNames && typeof classNames === 'object' && !Array.isArray(classNames) ? classNames : {};

  if (!triggerChildren || !contentProps?.children) {
    return <>{children}</>;
  }

  return (
    <MantineTooltip
      data-slot="tooltip"
      defaultOpened={defaultOpen}
      label={contentProps.children}
      offset={contentProps.sideOffset ?? offset ?? 5}
      opened={open}
      openDelay={delayDuration ?? providerDelay}
      position={contentProps.side ?? position ?? 'top'}
      withArrow={withArrow}
      classNames={{
        ...classNameMap,
        tooltip: cn(
          'z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background',
          classNameMap.tooltip,
          contentProps.className
        ),
      }}
      {...props}
    >
      {triggerChildren}
    </MantineTooltip>
  );
}

function TooltipTrigger({ asChild: _asChild, children }: TooltipTriggerProps) {
  return <>{children}</>;
}

TooltipTrigger.__tooltipPart = 'trigger';

function TooltipContent({
  className,
  side: _side,
  sideOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <span
      data-slot="tooltip-content"
      data-side-offset={sideOffset}
      className={cn(
        'z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

TooltipContent.__tooltipPart = 'content';

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
