'use client';;
import * as React from 'react';
import { motion, isMotionComponent } from 'motion/react';
import { cn } from '@/lib/utils';

const motionComponents = new Map();

function getMotionComponent(type) {
  if (isMotionComponent(type)) return type;
  if (!motionComponents.has(type)) {
    motionComponents.set(type, motion.create(type));
  }
  return motionComponents.get(type);
}

function mergeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref).current = node;
      }
    });
  };
}

function mergeProps(childProps, slotProps) {
  const merged = { ...childProps, ...slotProps };

  if (childProps.className || slotProps.className) {
    merged.className = cn(
      childProps.className,
      slotProps.className,
    );
  }

  if (childProps.style || slotProps.style) {
    merged.style = {
      ...(childProps.style),
      ...(slotProps.style),
    };
  }

  return merged;
}

function Slot(
  {
    children,
    ref,
    ...props
  }
) {
  if (!React.isValidElement(children)) return null;

  const Base = getMotionComponent(children.type);

  const { ref: childRef, ...childProps } = children.props;

  const mergedProps = mergeProps(childProps, props);

  // The module-level cache preserves component identity for each child type.
  // eslint-disable-next-line react-hooks/static-components
  return (<Base {...mergedProps} ref={mergeRefs(childRef, ref)} />);
}

export { Slot };
