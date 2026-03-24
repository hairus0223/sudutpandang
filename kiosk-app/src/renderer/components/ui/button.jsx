import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import React from "react";

const buttonVariants = cva("", {
  variants: {
    variant: {
      default: "primary-button",
      outline: "secondary-button",
      danger: "secondary-button secondary-button--danger",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const Button = React.forwardRef(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? "span" : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

