'use client';

import { Children, isValidElement, type ReactNode } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
};

/** Shared themed select, with keyboard navigation, typeahead and form support. */
export default function Select({ children, className = '', id, 'aria-label': label, ...props }: Props) {
  const options = Children.toArray(children).filter(isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>);
  const placeholder = options.find(option => option.props.value === '')?.props.children ?? 'Select an option';
  return <SelectPrimitive.Root {...props}>
    <SelectPrimitive.Trigger id={id} aria-label={label} className={`input select-trigger ${className}`}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon className="select-chevron"><ChevronDown size={16} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="select-content" position="popper" sideOffset={7} collisionPadding={12} onKeyDown={event => event.stopPropagation()}>
        <SelectPrimitive.ScrollUpButton className="select-scroll"><ChevronUp size={16} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="select-viewport">
          {options.filter(option => option.props.value !== '').map((option, index) => {
            const value = String(option.props.value ?? option.props.children);
            return <SelectPrimitive.Item key={value || index} value={value} disabled={option.props.disabled} className="select-item">
              <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="select-check"><Check size={16} /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>;
          })}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="select-scroll"><ChevronDown size={16} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
