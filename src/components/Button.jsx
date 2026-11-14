import React from 'react';

// Choose a semantic variant; page classes may control layout, never action colors.
export default function Button({variant = 'primary', className = '', children, ...props}) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props}>{children}</button>;
}
