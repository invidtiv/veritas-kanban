import {
  NumberInput as MantineNumberInput,
  type NumberInputProps as MantineNumberInputProps,
} from '@mantine/core';

import { cn } from '@/lib/utils';

function NumberInput({ className, size = 'xs', radius = 'md', ...props }: MantineNumberInputProps) {
  return (
    <MantineNumberInput
      data-slot="number-input"
      size={size}
      radius={radius}
      className={cn('w-full', className)}
      {...props}
    />
  );
}

export { NumberInput };
