'use client';

import {
  Select as MantineSelect,
  type ComboboxItem,
  type ComboboxLikeRenderOptionInput,
} from '@mantine/core';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type SelectAlign = 'start' | 'center' | 'end';

type SelectItemRecord = {
  className?: string;
  disabled?: boolean;
  label: string;
  node: React.ReactNode;
  value: string;
};

type SelectContextValue = {
  align: SelectAlign;
  defaultValue?: string;
  disabled?: boolean;
  items: SelectItemRecord[];
  name?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  setAlign: (align: SelectAlign) => void;
  setItems: (items: SelectItemRecord[]) => void;
  value?: string;
};

type SelectProps<TValue extends string = string> = {
  children?: React.ReactNode;
  defaultValue?: TValue;
  disabled?: boolean;
  name?: string;
  onValueChange?: (value: TValue) => void;
  required?: boolean;
  value?: TValue;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error(`${component} must be used inside Select`);
  }
  return context;
}

function getTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextContent).join(' ');
  }

  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return getTextContent(props.children);
  }

  return '';
}

function getSelectValuePlaceholder(node: React.ReactNode): string | undefined {
  let placeholder: string | undefined;

  React.Children.forEach(node, (child) => {
    if (placeholder || !React.isValidElement(child)) {
      return;
    }

    const props = child.props as { children?: React.ReactNode; placeholder?: React.ReactNode };
    if (props.placeholder !== undefined) {
      placeholder = getTextContent(props.placeholder).trim();
      return;
    }

    placeholder = getSelectValuePlaceholder(props.children);
  });

  return placeholder;
}

function getSelectItems(node: React.ReactNode): SelectItemRecord[] {
  const items: SelectItemRecord[] = [];

  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    const props = child.props as {
      children?: React.ReactNode;
      className?: string;
      disabled?: boolean;
      textValue?: string;
      value?: string;
    };

    if (typeof props.value === 'string') {
      const label = props.textValue ?? getTextContent(props.children).replace(/\s+/g, ' ').trim();
      items.push({
        className: props.className,
        disabled: props.disabled,
        label: label || props.value,
        node: props.children,
        value: props.value,
      });
      return;
    }

    items.push(...getSelectItems(props.children));
  });

  return items;
}

function itemsEqual(current: SelectItemRecord[], next: SelectItemRecord[]) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((item, index) => {
    const nextItem = next[index];
    return (
      item.value === nextItem.value &&
      item.label === nextItem.label &&
      item.disabled === nextItem.disabled &&
      item.className === nextItem.className
    );
  });
}

function Select<TValue extends string = string>({
  children,
  defaultValue,
  disabled,
  name,
  onValueChange,
  required,
  value,
}: SelectProps<TValue>) {
  const [items, setItemsState] = React.useState<SelectItemRecord[]>([]);
  const [align, setAlign] = React.useState<SelectAlign>('center');

  const setItems = React.useCallback((nextItems: SelectItemRecord[]) => {
    setItemsState((currentItems) =>
      itemsEqual(currentItems, nextItems) ? currentItems : nextItems
    );
  }, []);

  const context = React.useMemo<SelectContextValue>(
    () => ({
      align,
      defaultValue,
      disabled,
      items,
      name,
      onValueChange: onValueChange as ((value: string) => void) | undefined,
      required,
      setAlign,
      setItems,
      value,
    }),
    [align, defaultValue, disabled, items, name, onValueChange, required, setItems, value]
  );

  return (
    <SelectContext.Provider value={context}>
      <div data-slot="select" className="contents">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function SelectValue({ placeholder }: { placeholder?: React.ReactNode }) {
  return (
    <span
      data-slot="select-value"
      className="hidden"
      data-placeholder={getTextContent(placeholder)}
    />
  );
}

function getComboboxPosition(align: SelectAlign) {
  if (align === 'start') {
    return 'bottom-start' as const;
  }

  if (align === 'end') {
    return 'bottom-end' as const;
  }

  return 'bottom' as const;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  disabled,
  ...props
}: Omit<React.ComponentPropsWithoutRef<'input'>, 'defaultValue' | 'onChange' | 'size' | 'value'> & {
  children?: React.ReactNode;
  size?: 'sm' | 'default';
}) {
  const context = useSelectContext('SelectTrigger');
  const itemByValue = React.useMemo(
    () => new Map(context.items.map((item) => [item.value, item])),
    [context.items]
  );
  const data = React.useMemo(
    () =>
      context.items.map((item) => ({
        disabled: item.disabled,
        label: item.label,
        value: item.value,
      })),
    [context.items]
  );

  return (
    <MantineSelect
      allowDeselect={false}
      checkIconPosition="right"
      className={className}
      classNames={{
        dropdown:
          'z-50 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10',
        input: cn(
          'flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          className
        ),
        option:
          'rounded-md text-sm data-combobox-disabled:pointer-events-none data-combobox-disabled:opacity-50',
      }}
      comboboxProps={{
        position: getComboboxPosition(context.align),
        withinPortal: true,
      }}
      data={data}
      data-size={size}
      data-slot="select-trigger"
      defaultValue={context.defaultValue}
      disabled={context.disabled || disabled}
      name={context.name}
      onChange={(nextValue) => {
        if (nextValue !== null) {
          context.onValueChange?.(nextValue);
        }
      }}
      placeholder={getSelectValuePlaceholder(children)}
      renderOption={(input: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
        const item = itemByValue.get(input.option.value);
        return (
          <span className={cn('flex w-full items-center justify-between gap-2', item?.className)}>
            <span className="flex items-center gap-2">{item?.node ?? input.option.label}</span>
            {input.checked && <CheckIcon className="size-4" />}
          </span>
        );
      }}
      required={context.required}
      rightSection={
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      }
      value={context.value}
      withCheckIcon={false}
      {...props}
    />
  );
}

function SelectContent({
  align = 'center',
  children,
}: {
  align?: SelectAlign;
  children?: React.ReactNode;
  className?: string;
  position?: 'item-aligned' | 'popper';
}) {
  const { setAlign, setItems } = useSelectContext('SelectContent');
  const items = React.useMemo(() => getSelectItems(children), [children]);

  React.useEffect(() => {
    setAlign(align);
    setItems(items);
  }, [align, items, setAlign, setItems]);

  return null;
}

function SelectLabel({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function SelectItem(_props: {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  textValue?: string;
  value: string;
}) {
  return null;
}

function SelectSeparator() {
  return null;
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 hidden cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </div>
  );
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 hidden cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
