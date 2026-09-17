import type { ButtonHTMLAttributes } from 'react';
import LoadingSpinner from './LoadingSpinner';

export type ActionButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  primary:
    'bg-gray-900 text-white hover:bg-gray-700 focus-visible:ring-gray-900 disabled:bg-gray-400',
  secondary:
    'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-900 disabled:text-gray-400',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:bg-red-300',
  ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-900 disabled:text-gray-400',
};

const SIZE_CLASSES: Record<ActionButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  /** Disables the button and shows an inline spinner. */
  isLoading?: boolean;
}

/**
 * Standard button for all features: a native <button> (keyboard accessible
 * by default) with shared variant/size classes and an optional inline
 * spinner. Deliberately minimal — extend with a variant, not a wrapper.
 */
const ActionButton = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ActionButtonProps) => (
  <button
    type={type}
    disabled={disabled || isLoading}
    className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    {...rest}
  >
    {isLoading ? <LoadingSpinner size="sm" /> : null}
    {children}
  </button>
);

export default ActionButton;
