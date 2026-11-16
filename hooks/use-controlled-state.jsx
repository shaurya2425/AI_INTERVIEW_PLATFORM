import * as React from 'react';

export function useControlledState(props) {
  const { value, defaultValue, onChange } = props;

  const [state, setInternalState] = React.useState(value !== undefined ? value : (defaultValue));

  const setState = React.useCallback(
    (next, ...args) => {
      setInternalState(next);
      onChange?.(next, ...args);
    },
    [onChange],
  );

  return [value !== undefined ? value : state, setState];
}
