import * as React from 'react';

import { cn } from '@/lib/utils';

type SlotRootProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

function SlotRoot({ children, className, ...props }: SlotRootProps) {
  if (!React.isValidElement(children)) {
    return null;
  }

  const child = children as React.ReactElement<Record<string, unknown>>;
  const childClassName = typeof child.props.className === 'string' ? child.props.className : '';

  return React.cloneElement(child, {
    ...child.props,
    ...props,
    className: cn(childClassName, className),
  });
}

export { SlotRoot };
